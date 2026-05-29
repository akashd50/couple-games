import { Container, Graphics } from 'pixi.js';
import { ArenaConsts, MinionConsts } from '../constants';
import type { Enemy } from './enemy';
import { HitInfo } from "./attacks";
import { Entity } from "./entity";

// ── Shared interface ──────────────────────────────────────────────────────────

/**
 * Common interface implemented by every Minion variant (Minion / KnightMinion
 * and ChaserMinion).  World and MinionSystem use this so they never need to
 * import concrete subclasses.
 */
export abstract class Minion extends Entity {
    level: number = 0;

    constructor(parent: Container) {
        super(parent);
    }

    abstract kill(): void;

    abstract takeDamage(amount: number): void;

    abstract checkHit(enemy: Enemy, hitInfo: HitInfo): void;

    abstract update(dt: number, summX: number, summY: number, enemies: Enemy[]): number;

    abstract destroy(): void;

    abstract get isDead(): boolean;
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
export class KnightMinion extends Minion {
    /** Base damage per sword hit (level-scaled). */
    private readonly _damage: number;

    private state = MinionState.WANDER;
    private attackTimer = 0;
    private swingTimer = 0;
    private target: Enemy | null = null;

    // ── Wander state ──────────────────────────────────────────────────────────
    private wanderOffsetX = 0;
    private wanderOffsetY = 0;
    private wanderLingerTimer = 0;

    // ── Pixi ─────────────────────────────────────────────────────────────────
    private readonly bodyGfx: Graphics;
    private readonly swingGfx: Graphics;
    private readonly flashGfx: Graphics;
    private readonly hpBarGfx: Graphics;

    constructor(parent: Container, x: number, y: number, level: number) {
        super(parent);
        this.position.set(x, y);
        this.level = level;

        const hp = MinionConsts.BASE_HP + (level - 1) * MinionConsts.HP_PER_LEVEL;
        const dmg = MinionConsts.ATTACK_DAMAGE + (level - 1) * MinionConsts.DAMAGE_PER_LEVEL;
        this._hp = hp;
        this._maxHp = hp;
        this._damage = dmg;
        this.radius = MinionConsts.BASE_RADIUS;

        // ── Containers ─────────────────────────────────────────────────────
        this.container.label = 'minion';
        this.container.position.set(x, y);
        parent.addChild(this.container);

        // Sword swing arc (drawn behind the body; static shape, rotated at strike)
        this.swingGfx = new Graphics();
        this.swingGfx.alpha = 0;
        this.container.addChild(this.swingGfx);
        this.drawSwingArcShape();

        // Square body
        this.bodyGfx = new Graphics();
        this.bodyGfx
            .rect(-this.radius, -this.radius, this.radius * 2, this.radius * 2)
            .fill({ color: MinionConsts.COLOR })
            .rect(-this.radius, -this.radius, this.radius * 2, this.radius * 2)
            .stroke({ color: MinionConsts.OUTLINE_COLOR, width: 1.5 });
        this.container.addChild(this.bodyGfx);

        // White flash overlay
        this.flashGfx = new Graphics();
        this.flashGfx.rect(-this.radius, -this.radius, this.radius * 2, this.radius * 2).fill({ color: 0xffffff });
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

    // ── Public ────────────────────────────────────────────────────────────────

    /**
     * Check whether this KnightMinion can land a sword strike on `enemy` this tick.
     *
     * Only fires when:
     *   - This minion is alive and in ATTACK state targeting `enemy`
     *   - The enemy is within ATTACK_RANGE
     *   - The attack cooldown has expired
     *
     * Damage and knockback are accumulated into `hitInfo` so World can apply them
     * through the standard pipeline (enemy.takeDamage, player lifesteal, etc.).
     */
    checkHit(enemy: Enemy, hitInfo: HitInfo): void {
        if (this._hp <= 0 || this.state !== MinionState.ATTACK || this.target !== enemy) return;

        const td = this.position.to(enemy.getPosition());
        const tdist = Math.hypot(td.x, td.y);
        const engageDistance = MinionConsts.ATTACK_RANGE + enemy.getRadius() + this.getRadius();

        if (tdist > engageDistance || this.attackTimer > 0) return;

        // In range and cooldown ready — sword strike
        this.attackTimer = MinionConsts.ATTACK_COOLDOWN;
        const nx = tdist > 0.01 ? td.x / tdist : 0;
        const ny = tdist > 0.01 ? td.y / tdist : 0;
        hitInfo.addDamage(this._damage);
        hitInfo.addKnockback(nx * MinionConsts.ATTACK_KNOCKBACK, ny * MinionConsts.ATTACK_KNOCKBACK);

        // Trigger swing arc VFX
        this.swingTimer = MinionConsts.SWING_DURATION;
        this.swingGfx.rotation = this.bodyGfx.rotation;
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
                const d = this.position.to(enemy.getPosition());
                const dist = Math.hypot(d.x, d.y);
                if (dist < this.radius + enemy.getRadius()) {
                    // Minion takes contact damage (sets iframes)
                    const minionDmg = Math.max(1, Math.round(
                        enemy.contactDamage * MinionConsts.CONTACT_DAMAGE_MULT));
                    this.takeDamage(minionDmg);

                    // Reciprocal: enemy takes damage + knockback away from minion
                    const nx = dist > 0.001 ? d.x / dist : 1;
                    const ny = dist > 0.001 ? d.y / dist : 0;
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
            const d = Math.hypot(...this.position.to(enemy.getPosition()).list());
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
            const td = this.position.to(this.target.getPosition());
            const tdist = Math.hypot(td.x, td.y);
            const engageDistance = MinionConsts.ATTACK_RANGE + this.target.getRadius() + this.getRadius();

            if (tdist > engageDistance) {
                // Approach target
                if (tdist > 0.01) {
                    moveX = td.x / tdist;
                    moveY = td.y / tdist;
                }
            }
            // Sword strike is handled in checkHit() so it flows through the
            // standard HitInfo pipeline (enemy.takeDamage + Summoner lifesteal).

            // Face target
            if (Math.abs(td.x) + Math.abs(td.y) > 0.01) {
                this.bodyGfx.rotation = Math.atan2(td.y, td.x);
            }
        } else {
            // ── WANDER: roam within the Summoner's summon zone ────────────
            const distToSumm = Math.hypot(summX - this.position.x, summY - this.position.y);

            if (distToSumm > MinionConsts.LEASH_DISTANCE) {
                // Too far — sprint directly back to Summoner
                const sdx = summX - this.position.x;
                const sdy = summY - this.position.y;
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
                const wdx = targetX - this.position.x;
                const wdy = targetY - this.position.y;
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
        this.position.add(moveX * MinionConsts.SPEED * dt, moveY * MinionConsts.SPEED * dt);
        const r = this.getRadius();
        this.position.set(Math.max(r, Math.min(ArenaConsts.SIZE - r, this.position.x)), Math.max(r, Math.min(ArenaConsts.SIZE - r, this.position.y)));
        this.updateContainerPosition();
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
