import { Container, Graphics } from 'pixi.js';
import { ArenaConsts, MinionConsts } from '../constants';
import type { Enemy } from './enemy';

const enum MinionState {
    FOLLOW,
    ATTACK,
}

/**
 * A friendly minion unit raised by the Summoner from enemy corpses.
 *
 * Stats scale with the spawn level (derived from the enemy that was consumed):
 *   - HP  = BASE_HP  + (level−1) × HP_PER_LEVEL
 *   - Dmg = ATTACK_DAMAGE + (level−1) × DAMAGE_PER_LEVEL
 *
 * AI:
 *   FOLLOW → moves toward the Summoner; peels off when an enemy enters
 *            FOLLOW_RANGE.
 *   ATTACK → approaches and strikes the target on ATTACK_COOLDOWN; falls back
 *            to FOLLOW when the target dies or runs out of FOLLOW_RANGE.
 *
 * Damage dealt is returned from update() so World can apply lifesteal.
 */
export class Minion {
    posX: number;
    posY: number;

    readonly level: number;

    private _hp: number;
    private readonly _maxHp: number;

    /** Base damage per hit (level-scaled). */
    private readonly _damage: number;

    private state       = MinionState.FOLLOW;
    private attackTimer = 0;
    private iframes     = 0;
    private target: Enemy | null = null;

    // ── Pixi ─────────────────────────────────────────────────────────────────
    private readonly container: Container;
    private readonly bodyGfx: Graphics;
    private readonly flashGfx: Graphics;
    private readonly hpBarGfx: Graphics;

    constructor(parent: Container, x: number, y: number, level: number) {
        this.posX  = x;
        this.posY  = y;
        this.level = level;

        const hp    = MinionConsts.BASE_HP      + (level - 1) * MinionConsts.HP_PER_LEVEL;
        const dmg   = MinionConsts.ATTACK_DAMAGE + (level - 1) * MinionConsts.DAMAGE_PER_LEVEL;
        this._hp    = hp;
        this._maxHp = hp;
        this._damage = dmg;

        // ── Containers ─────────────────────────────────────────────────────
        this.container = new Container();
        this.container.label = 'minion';
        this.container.position.set(x, y);
        parent.addChild(this.container);

        const r = MinionConsts.BASE_RADIUS;

        // Square body
        this.bodyGfx = new Graphics();
        this.bodyGfx
            .rect(-r, -r, r * 2, r * 2)
            .fill({ color: MinionConsts.COLOR })
            .rect(-r, -r, r * 2, r * 2)
            .stroke({ color: MinionConsts.OUTLINE_COLOR, width: 1.5 });
        this.container.addChild(this.bodyGfx);

        // White flash overlay (same shape)
        this.flashGfx = new Graphics();
        this.flashGfx.rect(-r, -r, r * 2, r * 2).fill({ color: 0xffffff });
        this.flashGfx.alpha = 0;
        this.container.addChild(this.flashGfx);

        // HP bar above the body
        this.hpBarGfx = new Graphics();
        this.container.addChild(this.hpBarGfx);
    }

    // ── Getters ──────────────────────────────────────────────────────────────

    get isDead(): boolean { return this._hp <= 0; }
    get hp(): number      { return this._hp; }
    get maxHp(): number   { return this._maxHp; }
    get radius(): number  { return MinionConsts.BASE_RADIUS; }

    // ── Public ────────────────────────────────────────────────────────────────

    /** Force-kill (used when the Summoner's cap is exceeded). */
    kill(): void {
        this._hp = 0;
    }

    /** Receive contact damage from an enemy (gated by iframes). */
    takeDamage(amount: number): void {
        if (this._hp <= 0 || this.iframes > 0) return;
        this._hp = Math.max(0, this._hp - amount);
        this.iframes = MinionConsts.IFRAMES;
        // Quick flash via alpha (we reset below in update)
        this.flashGfx.alpha = 1;
        this.drawHpBar();
    }

    /**
     * Advance this minion by one sim step.
     *
     * @param dt       Fixed sim delta (seconds).
     * @param summX    Summoner world X.
     * @param summY    Summoner world Y.
     * @param enemies  All alive enemy instances (for targeting & contact).
     * @returns  Total HP damage dealt to enemies this tick (for lifesteal).
     */
    update(dt: number, summX: number, summY: number, enemies: Enemy[]): number {
        if (this._hp <= 0) return 0;

        // ── Timers ─────────────────────────────────────────────────────────
        this.attackTimer = Math.max(0, this.attackTimer - dt);
        if (this.iframes > 0) {
            this.iframes = Math.max(0, this.iframes - dt);
            this.flashGfx.alpha = this.iframes / MinionConsts.IFRAMES;
        } else {
            this.flashGfx.alpha = 0;
        }

        // ── Enemy contact damage (gated by iframes) ───────────────────────
        if (this.iframes <= 0) {
            for (const enemy of enemies) {
                if (enemy.isDead) continue;
                const dx = enemy.posX - this.posX;
                const dy = enemy.posY - this.posY;
                if (Math.hypot(dx, dy) < this.radius + enemy.radius) {
                    const dmg = Math.max(1, Math.round(enemy.contactDamage * MinionConsts.CONTACT_DAMAGE_MULT));
                    this.takeDamage(dmg);
                    break; // one contact per iframes window is enough
                }
            }
        }

        if (this._hp <= 0) return 0;

        // ── Find nearest alive enemy ───────────────────────────────────────
        let nearestEnemy: Enemy | null = null;
        let nearestDist = Infinity;
        for (const enemy of enemies) {
            if (enemy.isDead) continue;
            const d = Math.hypot(enemy.posX - this.posX, enemy.posY - this.posY);
            if (d < nearestDist) { nearestDist = d; nearestEnemy = enemy; }
        }

        // ── State machine ──────────────────────────────────────────────────
        if (this.state === MinionState.FOLLOW &&
            nearestEnemy &&
            nearestDist < MinionConsts.FOLLOW_RANGE) {
            this.state  = MinionState.ATTACK;
            this.target = nearestEnemy;
        } else if (this.state === MinionState.ATTACK &&
            (!this.target || this.target.isDead ||
             nearestDist > MinionConsts.FOLLOW_RANGE * 1.2)) {
            this.state  = MinionState.FOLLOW;
            this.target = null;
        }

        // Always lock onto the closest enemy while in ATTACK mode
        if (this.state === MinionState.ATTACK) {
            this.target = nearestEnemy;
        }

        // ── Movement & combat ──────────────────────────────────────────────
        let moveX = 0;
        let moveY = 0;
        let damageDealt = 0;

        if (this.state === MinionState.ATTACK && this.target) {
            const tdx   = this.target.posX - this.posX;
            const tdy   = this.target.posY - this.posY;
            const tdist = Math.hypot(tdx, tdy);
            const engageDistance = MinionConsts.ATTACK_RANGE + this.target.radius + this.radius;

            if (tdist > engageDistance) {
                // Approach target
                if (tdist > 0.01) { moveX = tdx / tdist; moveY = tdy / tdist; }
            } else if (this.attackTimer <= 0) {
                // In range — strike
                this.attackTimer = MinionConsts.ATTACK_COOLDOWN;
                const nx = tdist > 0.01 ? tdx / tdist : 0;
                const ny = tdist > 0.01 ? tdy / tdist : 0;
                this.target.takeDamage(
                    this._damage,
                    nx * MinionConsts.ATTACK_KNOCKBACK,
                    ny * MinionConsts.ATTACK_KNOCKBACK,
                );
                damageDealt = this._damage;
            }

            // Visual: rotate to face target
            if (Math.abs(tdx) + Math.abs(tdy) > 0.01) {
                this.bodyGfx.rotation = Math.atan2(tdy, tdx);
            }
        } else {
            // Follow Summoner
            const sdx   = summX - this.posX;
            const sdy   = summY - this.posY;
            const sdist = Math.hypot(sdx, sdy);
            const deadband = this.radius * 3; // don't crowd the Summoner
            if (sdist > deadband) {
                moveX = sdx / sdist;
                moveY = sdy / sdist;
                this.bodyGfx.rotation = Math.atan2(sdy, sdx);
            }
        }

        // ── Physics ────────────────────────────────────────────────────────
        this.posX += moveX * MinionConsts.SPEED * dt;
        this.posY += moveY * MinionConsts.SPEED * dt;

        // Arena clamp
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

    private drawHpBar(): void {
        const g = this.hpBarGfx;
        g.clear();
        if (this._hp >= this._maxHp) return;

        const barW = 22;
        const barH = 2;
        const barX = -barW / 2;
        const barY = -MinionConsts.BASE_RADIUS - 6;

        g.rect(barX, barY, barW, barH).fill({ color: 0x220033 });
        const fillW = Math.max(0, (this._hp / this._maxHp) * barW);
        if (fillW > 0) {
            g.rect(barX, barY, fillW, barH).fill({ color: MinionConsts.COLOR });
        }
    }
}
