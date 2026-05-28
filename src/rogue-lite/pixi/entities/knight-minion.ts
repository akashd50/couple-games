import { Container, Graphics } from 'pixi.js';
import { ArenaConsts, MinionConsts } from '../constants';
import type { Enemy } from './enemy';
import { HitInfo } from "./attacks";

// ── Shared interface ──────────────────────────────────────────────────────────

/**
 * Common interface implemented by every Minion variant (Minion / KnightMinion
 * and ChaserMinion).  World and MinionSystem use this so they never need to
 * import concrete subclasses.
 */
export interface IMinionLike {
    posX: number;
    posY: number;
    readonly isDead: boolean;
    readonly radius: number;
    readonly level: number;
    readonly hp: number;
    readonly maxHp: number;

    kill(): void;

    takeDamage(amount: number): void;

    checkHit(enemy: Enemy, hitInfo: HitInfo): void;

    update(dt: number, summX: number, summY: number, enemies: Enemy[]): number;

    destroy(): void;
}

// ── Internal state ────────────────────────────────────────────────────────────

const enum MinionState {
    WANDER,
    ATTACK,
}

/**
 * Knight-type friendly minion raised from Tank / boss corpses.
 *
 * Stats scale with spawn level:
 *   HP  = BASE_HP  + (level−1) × HP_PER_LEVEL
 *   Dmg = ATTACK_DAMAGE + (level−1) × DAMAGE_PER_LEVEL
 *
 * AI:
 *   WANDER → Roams randomly within the Summoner's summon zone (WANDER_RADIUS
 *            expressed as an offset from the Summoner's position so the zone
 *            follows the Summoner).  Switches to ATTACK when an enemy enters
 *            FOLLOW_RANGE.  Leashes back if it drifts > LEASH_DISTANCE.
 *   ATTACK → Approaches and strikes the target on ATTACK_COOLDOWN with a sword
 *            swing (gold arc VFX).  Returns to WANDER when the target dies or
 *            escapes FOLLOW_RANGE × 1.2.
 *
 * Contact damage is bidirectional (gated by iframes).
 * The HP bar is always visible.
 * Damage dealt (swing + contact) is returned from update() for lifesteal.
 */
export class KnightMinion implements IMinionLike {
    posX: number;
    posY: number;

    readonly level: number;

    private _hp: number;
    private readonly _maxHp: number;

    /** Base damage per sword hit (level-scaled). */
    private readonly _damage: number;

    private state = MinionState.WANDER;
    private attackTimer = 0;
    private swingTimer = 0;
    private iframes = 0;
    private target: Enemy | null = null;

    // ── Wander state ──────────────────────────────────────────────────────────
    private wanderOffsetX = 0;
    private wanderOffsetY = 0;
    private wanderLingerTimer = 0;

    // ── Pixi ─────────────────────────────────────────────────────────────────
    private readonly container: Container;
    private readonly bodyGfx: Graphics;
    private readonly swingGfx: Graphics;
    private readonly flashGfx: Graphics;
    private readonly hpBarGfx: Graphics;

    constructor(parent: Container, x: number, y: number, level: number) {
        this.posX = x;
        this.posY = y;
        this.level = level;

        const hp = MinionConsts.BASE_HP + (level - 1) * MinionConsts.HP_PER_LEVEL;
        const dmg = MinionConsts.ATTACK_DAMAGE + (level - 1) * MinionConsts.DAMAGE_PER_LEVEL;
        this._hp = hp;
        this._maxHp = hp;
        this._damage = dmg;

        // ── Containers ─────────────────────────────────────────────────────
        this.container = new Container();
        this.container.label = 'minion';
        this.container.position.set(x, y);
        parent.addChild(this.container);

        const r = MinionConsts.BASE_RADIUS;

        // Sword swing arc (drawn behind the body; static shape, rotated at strike)
        this.swingGfx = new Graphics();
        this.swingGfx.alpha = 0;
        this.container.addChild(this.swingGfx);
        this.drawSwingArcShape();

        // Square body
        this.bodyGfx = new Graphics();
        this.bodyGfx
            .rect(-r, -r, r * 2, r * 2)
            .fill({ color: MinionConsts.COLOR })
            .rect(-r, -r, r * 2, r * 2)
            .stroke({ color: MinionConsts.OUTLINE_COLOR, width: 1.5 });
        this.container.addChild(this.bodyGfx);

        // White flash overlay
        this.flashGfx = new Graphics();
        this.flashGfx.rect(-r, -r, r * 2, r * 2).fill({ color: 0xffffff });
        this.flashGfx.alpha = 0;
        this.container.addChild(this.flashGfx);

        // HP bar (always visible)
        this.hpBarGfx = new Graphics();
        this.container.addChild(this.hpBarGfx);

        this.pickNewWanderTarget();
        this.drawHpBar();
    }

    // ── Getters ──────────────────────────────────────────────────────────────

    get isDead(): boolean {
        return this._hp <= 0;
    }

    get hp(): number {
        return this._hp;
    }

    get maxHp(): number {
        return this._maxHp;
    }

    get radius(): number {
        return MinionConsts.BASE_RADIUS;
    }

    // ── Public ────────────────────────────────────────────────────────────────

    checkHit(enemy: Enemy, hitInfo: HitInfo) {

    }


    /** Force-kill (used when the Summoner's cap is exceeded). */
    kill(): void {
        this._hp = 0;
    }

    /** Receive contact damage from an enemy (gated by iframes). */
    takeDamage(amount: number): void {
        if (this._hp <= 0 || this.iframes > 0) return;
        this._hp = Math.max(0, this._hp - amount);
        this.iframes = MinionConsts.IFRAMES;
        this.flashGfx.alpha = 1;
        this.drawHpBar();
    }

    /**
     * Advance this minion by one sim step.
     *
     * @param dt       Fixed sim delta (seconds).
     * @param summX    Summoner world X.
     * @param summY    Summoner world Y.
     * @param enemies  All alive enemy instances (regular + boss).
     * @returns  Total HP damage dealt to enemies this tick (for lifesteal).
     */
    update(dt: number, summX: number, summY: number, enemies: Enemy[]): number {
        if (this._hp <= 0) return 0;

        // ── Timers ─────────────────────────────────────────────────────────
        this.attackTimer = Math.max(0, this.attackTimer - dt);

        if (this.swingTimer > 0) {
            this.swingTimer = Math.max(0, this.swingTimer - dt);
            this.swingGfx.alpha = this.swingTimer / MinionConsts.SWING_DURATION;
        } else {
            this.swingGfx.alpha = 0;
        }

        if (this.iframes > 0) {
            this.iframes = Math.max(0, this.iframes - dt);
            this.flashGfx.alpha = this.iframes / MinionConsts.IFRAMES;
        } else {
            this.flashGfx.alpha = 0;
        }

        // ── Enemy contact — bidirectional (gated by minion iframes) ───────
        let damageDealt = 0;
        if (this.iframes <= 0) {
            for (const enemy of enemies) {
                if (enemy.isDead) continue;
                const dx = enemy.posX - this.posX;
                const dy = enemy.posY - this.posY;
                const dist = Math.hypot(dx, dy);
                if (dist < this.radius + enemy.radius) {
                    // Minion takes contact damage (sets iframes)
                    const minionDmg = Math.max(1, Math.round(
                        enemy.contactDamage * MinionConsts.CONTACT_DAMAGE_MULT));
                    this.takeDamage(minionDmg);

                    // Reciprocal: enemy takes damage + knockback away from minion
                    const nx = dist > 0.001 ? dx / dist : 1;
                    const ny = dist > 0.001 ? dy / dist : 0;
                    const enemyDmg = Math.max(1, Math.round(
                        this._damage * MinionConsts.CONTACT_ENEMY_DAMAGE_MULT));
                    enemy.takeDamage(
                        enemyDmg,
                        nx * MinionConsts.CONTACT_ENEMY_KNOCKBACK,
                        ny * MinionConsts.CONTACT_ENEMY_KNOCKBACK,
                    );
                    damageDealt += enemyDmg;
                    break; // one contact event per iframes window
                }
            }
        }

        if (this._hp <= 0) return damageDealt;

        // ── Find nearest alive enemy ───────────────────────────────────────
        let nearestEnemy: Enemy | null = null;
        let nearestDist = Infinity;
        for (const enemy of enemies) {
            if (enemy.isDead) continue;
            const d = Math.hypot(enemy.posX - this.posX, enemy.posY - this.posY);
            if (d < nearestDist) {
                nearestDist = d;
                nearestEnemy = enemy;
            }
        }

        // ── State transitions ──────────────────────────────────────────────
        if (this.state === MinionState.WANDER &&
            nearestEnemy !== null &&
            nearestDist < MinionConsts.FOLLOW_RANGE) {
            this.state = MinionState.ATTACK;
            this.target = nearestEnemy;
        } else if (this.state === MinionState.ATTACK &&
            (!this.target || this.target.isDead ||
                nearestDist > MinionConsts.FOLLOW_RANGE * 1.2)) {
            this.state = MinionState.WANDER;
            this.target = null;
            this.pickNewWanderTarget();
        }

        if (this.state === MinionState.ATTACK) {
            this.target = nearestEnemy;
        }

        // ── Movement & combat ──────────────────────────────────────────────
        let moveX = 0;
        let moveY = 0;

        if (this.state === MinionState.ATTACK && this.target) {
            const tdx = this.target.posX - this.posX;
            const tdy = this.target.posY - this.posY;
            const tdist = Math.hypot(tdx, tdy);
            const engageDistance = MinionConsts.ATTACK_RANGE + this.target.radius + this.radius;

            if (tdist > engageDistance) {
                // Approach target
                if (tdist > 0.01) {
                    moveX = tdx / tdist;
                    moveY = tdy / tdist;
                }
            } else if (this.attackTimer <= 0) {
                // In range — sword strike
                this.attackTimer = MinionConsts.ATTACK_COOLDOWN;
                const nx = tdist > 0.01 ? tdx / tdist : 0;
                const ny = tdist > 0.01 ? tdy / tdist : 0;
                this.target.takeDamage(
                    this._damage,
                    nx * MinionConsts.ATTACK_KNOCKBACK,
                    ny * MinionConsts.ATTACK_KNOCKBACK,
                );
                damageDealt += this._damage;

                // Trigger swing arc VFX
                this.swingTimer = MinionConsts.SWING_DURATION;
                this.swingGfx.rotation = this.bodyGfx.rotation;
            }

            // Face target
            if (Math.abs(tdx) + Math.abs(tdy) > 0.01) {
                this.bodyGfx.rotation = Math.atan2(tdy, tdx);
            }
        } else {
            // ── WANDER: roam within the Summoner's summon zone ────────────
            const distToSumm = Math.hypot(summX - this.posX, summY - this.posY);

            if (distToSumm > MinionConsts.LEASH_DISTANCE) {
                // Too far — sprint directly back to Summoner
                const sdx = summX - this.posX;
                const sdy = summY - this.posY;
                moveX = sdx / distToSumm;
                moveY = sdy / distToSumm;
                this.bodyGfx.rotation = Math.atan2(sdy, sdx);
            } else if (this.wanderLingerTimer > 0) {
                // Idle briefly at wander target
                this.wanderLingerTimer = Math.max(0, this.wanderLingerTimer - dt);
            } else {
                // Move toward wander target (offset relative to Summoner)
                const targetX = summX + this.wanderOffsetX;
                const targetY = summY + this.wanderOffsetY;
                const wdx = targetX - this.posX;
                const wdy = targetY - this.posY;
                const wdist = Math.hypot(wdx, wdy);

                if (wdist < MinionConsts.WANDER_ARRIVE_DIST) {
                    this.pickNewWanderTarget();
                } else {
                    moveX = wdx / wdist;
                    moveY = wdy / wdist;
                    this.bodyGfx.rotation = Math.atan2(wdy, wdx);
                }
            }
        }

        // ── Physics ────────────────────────────────────────────────────────
        this.posX += moveX * MinionConsts.SPEED * dt;
        this.posY += moveY * MinionConsts.SPEED * dt;

        const r = this.radius;
        this.posX = Math.max(r, Math.min(ArenaConsts.SIZE - r, this.posX));
        this.posY = Math.max(r, Math.min(ArenaConsts.SIZE - r, this.posY));

        this.container.position.set(this.posX, this.posY);
        return damageDealt;
    }

    destroy(): void {
        this.container.destroy({ children: true });
    }

    // ── Private ──────────────────────────────────────────────────────────────

    /**
     * Choose a new random wander destination as an offset from the Summoner's
     * position, then start a short idle pause at the target.
     */
    private pickNewWanderTarget(): void {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * MinionConsts.WANDER_RADIUS;
        this.wanderOffsetX = Math.cos(angle) * dist;
        this.wanderOffsetY = Math.sin(angle) * dist;
        this.wanderLingerTimer =
            MinionConsts.WANDER_LINGER_MIN +
            Math.random() * (MinionConsts.WANDER_LINGER_MAX - MinionConsts.WANDER_LINGER_MIN);
    }

    /** Pre-draw the sword swing arc wedge (pointing right / +X in local space). */
    private drawSwingArcShape(): void {
        const g = this.swingGfx;
        const r = MinionConsts.ATTACK_RANGE;
        const half = MinionConsts.SWING_HALF_ANGLE;
        // Fan polygon: origin → arc edge points → back to origin (auto-closed by poly)
        const pts: number[] = [0, 0];
        const steps = 10;
        for (let i = 0; i <= steps; i++) {
            const a = -half + (i / steps) * (half * 2);
            pts.push(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.poly(pts).fill({ color: MinionConsts.SWING_COLOR });
    }

    /** Redraw the HP bar. Background track always visible. */
    private drawHpBar(): void {
        const g = this.hpBarGfx;
        g.clear();

        const barW = 22;
        const barH = 2;
        const barX = -barW / 2;
        const barY = -MinionConsts.BASE_RADIUS - 6;

        g.rect(barX, barY, barW, barH).fill({ color: 0x220033 });
        const fillW = Math.max(0, (this._hp / this._maxHp) * barW);
        if (fillW > 0) {
            g.rect(barX, barY, fillW, barH).fill({ color: MinionConsts.OUTLINE_COLOR });
        }
    }
}
