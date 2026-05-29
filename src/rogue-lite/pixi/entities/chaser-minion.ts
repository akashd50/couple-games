import { Container, Graphics } from 'pixi.js';
import { ArenaConsts, ChaserMinionConsts } from '../constants';
import type { Enemy } from './enemy';
import { HitInfo } from "./attacks";
import { Minion } from "./knight-minion";

const enum ChaserMinionState {
    WANDER,
    ATTACK,
}

/**
 * Chaser-type friendly minion raised from Chaser enemy corpses.
 *
 * Visual: bright-blue equilateral triangle (same orientation logic as the
 *         Chaser enemy — points toward its current target).
 *
 * Behaviour:
 *   - No sword swing.  ALL damage is delivered through body contact.
 *   - Charges straight at the nearest enemy once one enters FOLLOW_RANGE.
 *   - Fast (SPEED > KnightMinion), fragile (low HP, short iframes).
 *   - Each contact window deals CONTACT_ENEMY_DAMAGE_MULT × _damage to the
 *     enemy and takes CONTACT_DAMAGE_MULT × enemy.contactDamage itself.
 *   - Short iframes (0.28 s) mean it takes hits in rapid succession and dies
 *     quickly — the "suicide bomber" effect.
 *
 * Wander AI while no enemies are in range:
 *   Same offset-from-Summoner logic as KnightMinion, but with a tighter zone
 *   (WANDER_RADIUS) and almost no idle linger — ChaserMinions are restless.
 *
 * Leash:
 *   If it drifts > LEASH_DISTANCE from the Summoner it ignores the wander
 *   target and beelines straight back.
 *
 * Returns total damage dealt to enemies this tick for Summoner lifesteal.
 */
export class ChaserMinion extends Minion {
    /** Base contact damage per iframes window (level-scaled). */
    private readonly _damage: number;

    private state = ChaserMinionState.WANDER;
    private target: Enemy | null = null;

    // ── Wander state ──────────────────────────────────────────────────────────
    private wanderOffsetX = 0;
    private wanderOffsetY = 0;
    private wanderLingerTimer = 0;

    // ── Pixi ─────────────────────────────────────────────────────────────────
    private readonly bodyGfx: Graphics;
    private readonly flashGfx: Graphics;
    private readonly hpBarGfx: Graphics;

    constructor(parent: Container, x: number, y: number, level: number) {
        super(parent);
        this._position.set(x, y);
        this.level = level;

        const hp = ChaserMinionConsts.BASE_HP + (level - 1) * ChaserMinionConsts.HP_PER_LEVEL;
        const dmg = ChaserMinionConsts.ATTACK_DAMAGE + (level - 1) * ChaserMinionConsts.DAMAGE_PER_LEVEL;
        this._hp = hp;
        this._maxHp = hp;
        this._damage = dmg;
        this._radius = ChaserMinionConsts.BASE_RADIUS;

        // ── Containers ─────────────────────────────────────────────────────
        this._container.label = 'chaser-minion';
        this._container.position.set(x, y);
        parent.addChild(this._container);

        const sqrt3over2 = 0.866;

        // Equilateral triangle pointing right (+X) — rotated to face target at runtime
        const triPts = [
            this._radius, 0,
            -this._radius * 0.5, -this._radius * sqrt3over2,
            -this._radius * 0.5, this._radius * sqrt3over2,
        ];

        this.bodyGfx = new Graphics();
        this.bodyGfx
            .poly(triPts)
            .fill({ color: ChaserMinionConsts.COLOR })
            .poly(triPts)
            .stroke({ color: ChaserMinionConsts.OUTLINE_COLOR, width: 1.5 });
        this._container.addChild(this.bodyGfx);

        // White flash overlay (same triangle shape)
        this.flashGfx = new Graphics();
        this.flashGfx.poly(triPts).fill({ color: 0xffffff });
        this.flashGfx.alpha = 0;
        this._container.addChild(this.flashGfx);

        // HP bar (always visible)
        this.hpBarGfx = new Graphics();
        this._container.addChild(this.hpBarGfx);

        this.pickNewWanderTarget();
        this.drawHpBar();
    }

    // ── Getters ──────────────────────────────────────────────────────────────

    get isDead(): boolean {
        return this._hp <= 0;
    }

    // ── Public ────────────────────────────────────────────────────────────────

    kill(): void {
        this._hp = 0;
    }

    takeDamage(amount: number): void {
        if (this._hp <= 0 || this._iframes > 0) return;
        this._hp = Math.max(0, this._hp - amount);
        this._iframes = ChaserMinionConsts.IFRAMES;
        this.flashGfx.alpha = 1;
        this.drawHpBar();
    }

    checkHit(enemy: Enemy, hitInfo: HitInfo) {
        const d = this._position.to(enemy.getPosition());
        const dist = Math.hypot(d.x, d.y);
        if (dist < this._radius + enemy.getRadius()) {
            // ChaserMinion takes damage (sets iframes — short, so it dies fast)
            const minionDmg = Math.max(1, Math.round(enemy.contactDamage * ChaserMinionConsts.CONTACT_DAMAGE_MULT));
            this.takeDamage(minionDmg);

            // Enemy takes damage + strong knockback away from minion
            const nx = dist > 0.001 ? d.x / dist : 1;
            const ny = dist > 0.001 ? d.y / dist : 0;
            const enemyDmg = Math.max(1, Math.round(this._damage * ChaserMinionConsts.CONTACT_ENEMY_DAMAGE_MULT));
            hitInfo
                .addDamage(enemyDmg)
                .addKnockback(nx * ChaserMinionConsts.CONTACT_ENEMY_KNOCKBACK, ny * ChaserMinionConsts.CONTACT_ENEMY_KNOCKBACK);
        }
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

        // ── Iframes timer ──────────────────────────────────────────────────
        if (this._iframes > 0) {
            this._iframes = Math.max(0, this._iframes - dt);
            this.flashGfx.alpha = this._iframes / ChaserMinionConsts.IFRAMES;
        } else {
            this.flashGfx.alpha = 0;
        }

        if (this._hp <= 0) {
            return 0;
        }

        // ── Find nearest alive enemy ───────────────────────────────────────
        let nearestEnemy: Enemy | null = null;
        let nearestDist = Infinity;
        for (const enemy of enemies) {
            if (enemy.isDead) continue;
            const d = Math.hypot(...this._position.to(enemy.getPosition()).list());
            if (d < nearestDist) {
                nearestDist = d;
                nearestEnemy = enemy;
            }
        }

        // ── State transitions ──────────────────────────────────────────────
        if (this.state === ChaserMinionState.WANDER &&
            nearestEnemy !== null &&
            nearestDist < ChaserMinionConsts.FOLLOW_RANGE) {
            this.state = ChaserMinionState.ATTACK;
            this.target = nearestEnemy;
        } else if (this.state === ChaserMinionState.ATTACK &&
            (!this.target || this.target.isDead ||
                nearestDist > ChaserMinionConsts.FOLLOW_RANGE * 1.2)) {
            this.state = ChaserMinionState.WANDER;
            this.target = null;
            this.pickNewWanderTarget();
        }

        if (this.state === ChaserMinionState.ATTACK) {
            this.target = nearestEnemy;
        }

        // ── Movement ───────────────────────────────────────────────────────
        let moveX = 0;
        let moveY = 0;

        if (this.state === ChaserMinionState.ATTACK && this.target) {
            // Sprint directly at the target — the only "attack" is collision
            const td = this._position.to(this.target.getPosition());
            const tdist = Math.hypot(td.x, td.y);
            if (tdist > 0.01) {
                moveX = td.x / tdist;
                moveY = td.y / tdist;
                this.bodyGfx.rotation = Math.atan2(td.y, td.x);
            }
        } else {
            // ── WANDER: tight orbit around the Summoner's position ────────
            const distToSumm = Math.hypot(summX - this._position.x, summY - this._position.y);

            if (distToSumm > ChaserMinionConsts.LEASH_DISTANCE) {
                // Leash — beeline back to Summoner
                const sdx = summX - this._position.x;
                const sdy = summY - this._position.y;
                moveX = sdx / distToSumm;
                moveY = sdy / distToSumm;
                this.bodyGfx.rotation = Math.atan2(sdy, sdx);
            } else if (this.wanderLingerTimer > 0) {
                this.wanderLingerTimer = Math.max(0, this.wanderLingerTimer - dt);
            } else {
                const targetX = summX + this.wanderOffsetX;
                const targetY = summY + this.wanderOffsetY;
                const wdx = targetX - this._position.x;
                const wdy = targetY - this._position.y;
                const wdist = Math.hypot(wdx, wdy);

                if (wdist < ChaserMinionConsts.WANDER_ARRIVE_DIST) {
                    this.pickNewWanderTarget();
                } else {
                    moveX = wdx / wdist;
                    moveY = wdy / wdist;
                    this.bodyGfx.rotation = Math.atan2(wdy, wdx);
                }
            }
        }

        // ── Physics ────────────────────────────────────────────────────────
        this._position.add(moveX * ChaserMinionConsts.SPEED * dt, moveY * ChaserMinionConsts.SPEED * dt);
        const r = this._radius;
        this._position.set(Math.max(r, Math.min(ArenaConsts.SIZE - r, this._position.x)), Math.max(r, Math.min(ArenaConsts.SIZE - r, this._position.y)))
        this.updateContainerPosition();
        return 0;
    }

    destroy(): void {
        this._container.destroy({ children: true });
    }

    // ── Private ──────────────────────────────────────────────────────────────

    private pickNewWanderTarget(): void {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * ChaserMinionConsts.WANDER_RADIUS;
        this.wanderOffsetX = Math.cos(angle) * dist;
        this.wanderOffsetY = Math.sin(angle) * dist;
        this.wanderLingerTimer =
            ChaserMinionConsts.WANDER_LINGER_MIN +
            Math.random() * (ChaserMinionConsts.WANDER_LINGER_MAX - ChaserMinionConsts.WANDER_LINGER_MIN);
    }

    private drawHpBar(): void {
        const g = this.hpBarGfx;
        g.clear();

        const barW = 20;
        const barH = 2;
        const barX = -barW / 2;
        const barY = -ChaserMinionConsts.BASE_RADIUS - 6;

        g.rect(barX, barY, barW, barH).fill({ color: 0x001133 });
        const fillW = Math.max(0, (this._hp / this._maxHp) * barW);
        if (fillW > 0) {
            g.rect(barX, barY, fillW, barH).fill({ color: ChaserMinionConsts.OUTLINE_COLOR });
        }
    }
}
