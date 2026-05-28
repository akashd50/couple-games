import { Container, Graphics } from 'pixi.js';
import type { Vec2 } from '../types';
import { ArenaConsts, DustCloudConsts, KnightConsts, KnightProps, PhysicsConsts, XpGemConsts } from '../constants';
import { Resolver, HitInfo } from './attacks';
import { ShockwaveResolver } from './shockwave-resolver';
import { AftershockResolver } from './aftershock-resolver';
import { AuraResolver } from './aura-resolver';
import { Enemy } from './enemy';
import { Constructor, wrapAngle } from '../common-utils';
import { SwingAttackResolver } from "./swing-resolver";
import { HealTickResolver } from "./heal-tick-resolver";
import { DustCloudSystem } from '../effects/dust-cloud';

/**
 * Abstract base for all player classes.
 *
 * Upgrade-facing mutator API — safe to call from UpgradeDefinition.apply():
 *
 *   addMaxHp(n)                  — Juggernaut: grow max HP and heal immediately
 *   addRadiusBonus(n)            — Juggernaut: grow collision/visual radius
 *   addMagnetRadius(n)           — Magnet: expand XP-gem attraction range
 *   multiplyAttackCooldown(f)    — Flurry: multiply all resolver cooldowns by f
 *   addAttackHalfAngle(delta)    — Wide Cleave: widen attack cone
 *   multiplyAttackRange(factor)  — Wide Cleave: extend attack reach
 *   multiplyIncomingDamage(f)    — Iron Skin: reduce damage taken (f < 1)
 *   addLifestealPct(pct)         — Lifesteal: heal fraction of damage dealt
 *   addShieldReduction(pct)      — Aura Shield: increase shield-side damage block
 *   addKnockbackResist(pct)      — Juggernaut: reduce knockback impulse received
 *   multiplyMovementSpeed(f)     — Juggernaut: scale base movement speed (f < 1)
 *   enableShockwave()            — Shockwave: creates ShockwaveResolver (KnightPlayer)
 *   enableAftershock()           — Aftershock: creates AftershockResolver (KnightPlayer)
 *   enableAura()                 — Aura: creates AuraResolver (KnightPlayer)
 *
 * Attack state is owned entirely by AttackResolver subclasses.  World iterates
 * player.resolvers and handles world-space effects (shockwave physics, aura damage)
 * by checking instanceof for specific resolver types.
 */
export abstract class Player {
    protected readonly container: Container;
    protected readonly backgroundFxContainer: Container;
    protected posX: number;
    protected posY: number;

    // ── Knockback velocity ────────────────────────────────────────────────────
    protected vx = 0;
    protected vy = 0;

    // ── HP ────────────────────────────────────────────────────────────────────
    protected _hp: number;
    protected _maxHp: number;
    /** Remaining invincibility seconds after a hit. */
    protected iframes = 0;

    // ── Attack resolvers ──────────────────────────────────────────────────────
    /** All active attack resolvers.  Iterated for tryAttack / checkHit / update / draw. */
    protected attackResolvers: Resolver[] = [];

    // ── Cached aim angle (set at start of each update()) ─────────────────────
    /** Stored each tick so takeDamage() can determine the shield-facing side. */
    protected _aimAngle = 0;

    // ── Previous-frame position (for effective-speed computation in draw()) ──
    protected _prevPosX: number;
    protected _prevPosY: number;

    // ── Base movement speed (subclasses override in their constructors) ────────
    /**
     * World units / second before any multipliers.
     * KnightPlayer uses KnightConsts.speed; SummonerPlayer uses SummonerConsts.speed.
     * Set by subclass constructor after super() returns.
     */
    protected _baseSpeed = KnightConsts.speed;

    // ── Upgrade-mutable stats ─────────────────────────────────────────────────
    protected _radiusBonus = 0;
    protected _pickupRadius = XpGemConsts.BASE_PICKUP_RADIUS;
    protected _magnetRadius = 0;
    protected _cooldownMult = 1;
    protected _damageMult = 1;
    protected _lifestealPct = 0;
    /**
     * Extra shield-side damage reduction from Aura Shield stacks.
     * Added to SHIELD_BASE_REDUCTION in takeDamage().
     * Capped at 0.75 total extra so the front never becomes immune.
     */
    protected _shieldReduction = 0;
    /**
     * Cumulative knockback resistance (additive per Juggernaut stack, capped 0.85).
     * 0.4 → player receives 60 % of incoming knockback.
     */
    protected _knockbackResist = 0;
    /**
     * Movement speed multiplier — Juggernaut drives this below 1.
     * Stacks multiplicatively (0.9× per stack).
     */
    protected _movementSpeedMult = 1;

    constructor(parent: Container) {
        this.posX = ArenaConsts.SIZE / 2;
        this.posY = ArenaConsts.SIZE / 2;
        this._hp = KnightConsts.hp;
        this._maxHp = KnightConsts.hp;

        // Prev-pos initialised to spawn point; subclasses may adjust in their ctors
        this._prevPosX = this.posX;
        this._prevPosY = this.posY;

        this.container = new Container();
        this.container.label = 'player';
        this.container.position.set(this.posX, this.posY);

        this.backgroundFxContainer = new Container();
        this.backgroundFxContainer.label = "bg_fx";

        parent.addChild(this.container);
        parent.addChild(this.backgroundFxContainer);
    }

    // ── Getters ──────────────────────────────────────────────────────────────

    get backgroundFx(): Container {
        return this.backgroundFxContainer;
    }

    get position(): Vec2 {
        return { x: this.posX, y: this.posY };
    }

    get hp(): number {
        return this._hp;
    }

    get maxHp(): number {
        return this._maxHp;
    }

    get radius(): number {
        return KnightConsts.radius + this._radiusBonus;
    }

    get pickupRadius(): number {
        return this._pickupRadius;
    }

    get magnetRadius(): number {
        return this._magnetRadius;
    }

    get isDead(): boolean {
        return this._hp <= 0;
    }

    /**
     * Read-only view of all active attack resolvers.
     * World iterates this to handle world-space effects from ShockwaveResolver,
     * AftershockResolver, and AuraResolver.
     */
    get resolvers(): readonly Resolver[] {
        return this.attackResolvers;
    }

    // ── Upgrade mutators ─────────────────────────────────────────────────────

    /** Increase max HP and immediately heal the same amount (Juggernaut). */
    addMaxHp(amount: number): void {
        this._maxHp += amount;
        this._hp = Math.min(this._hp + amount, this._maxHp);
    }

    /**
     * Grow collision and visual radius (Juggernaut).
     * Triggers onRadiusChanged() so subclasses can redraw.
     */
    addRadiusBonus(amount: number): void {
        this._radiusBonus += amount;
        this.onRadiusChanged();
    }

    addMagnetRadius(amount: number): void {
        this._magnetRadius += amount;
    }

    /** Multiply incoming damage (Iron Skin — 0.85 per stack). */
    multiplyIncomingDamage(factor: number): void {
        this._damageMult *= factor;
    }

    /** Add lifesteal fraction (Lifesteal — 0.05 per stack). */
    addLifestealPct(pct: number): void {
        this._lifestealPct += pct;
    }

    enableHealTickResolver(val: number): void {
    }

    /**
     * Increase shield-side block (Aura Shield — +0.05 per stack).
     * Capped at 0.75 total extra reduction.
     */
    addShieldReduction(pct: number): void {
        this._shieldReduction = Math.min(0.75, this._shieldReduction + pct);
    }

    /**
     * Add knockback resistance (Juggernaut — +0.20 per stack).
     * Capped at 0.85 so full immunity is never possible.
     */
    addKnockbackResist(pct: number): void {
        this._knockbackResist = Math.min(0.85, this._knockbackResist + pct);
    }

    /** Scale movement speed (Juggernaut — ×0.9 per stack). */
    multiplyMovementSpeed(factor: number): void {
        this._movementSpeedMult *= factor;
    }

    // ── Upgrade enablers (no-ops; KnightPlayer overrides to create resolvers) ─
    // These exist on the base so UpgradeDefinition.apply(player: Player) compiles.
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    enableShockwave(): void {
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    enableAftershock(): void {
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    enableAura(): void {
    }

    // ── Summoner-specific upgrade stubs (no-ops; SummonerPlayer overrides) ───
    // Placed here so UpgradeDefinition.apply(player: Player) compiles without
    // requiring unsafe casts in the upgrade registry.

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    multiplyProjCooldown(_factor: number): void {
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    addProjDamage(_amount: number): void {
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    addMinionCap(_n: number): void {
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    addSummonRadius(_n: number): void {
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    addMinionLifesteal(_pct: number): void {
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    empowerMinions(_factor: number): void {
    }

    // ── Public methods ───────────────────────────────────────────────────────

    getResolver<T extends Resolver>(TargetClass: Constructor<T>): T {
        return this.resolvers.find((resolver): resolver is T => resolver instanceof TargetClass);
    }

    /** Check whether any attack should fire this tick (called once per tick, before update). */
    tryAttack(_dt: number, _aimAngle: number): void {
    }

    /**
     * Simulate one physics step.
     * @param dt       Fixed sim delta (seconds).
     * @param move     Normalised movement vector from input.
     * @param aimAngle Current aim angle (radians).
     */
    update(dt: number, move: Vec2, aimAngle: number): void {
        // Cache aim angle before any logic so takeDamage() can use it this tick
        this._aimAngle = aimAngle;

        if (this.iframes > 0) {
            this.iframes = Math.max(0, this.iframes - dt);
        }

        this.issueUpdate(dt, move, aimAngle);

        // Record pre-move position for per-frame speed computation (used by dust clouds)
        this._prevPosX = this.posX;
        this._prevPosY = this.posY;

        // Knockback decay
        const friction = Math.exp(-PhysicsConsts.KNOCKBACK_FRICTION * dt);
        this.vx *= friction;
        this.vy *= friction;

        // Movement — directional speed bonus when facing the movement direction
        let speedBonus = 0;
        const moveLen = Math.hypot(move.x, move.y);
        if (moveLen > 0.1) {
            const dot = move.x * Math.cos(this._aimAngle) + move.y * Math.sin(this._aimAngle);
            if (dot > 0) speedBonus = dot * KnightConsts.DIRECTIONAL_SPEED_BONUS;
        }
        const effectiveSpeed = this._baseSpeed * this._movementSpeedMult * (1 + speedBonus);

        this.posX += (move.x * effectiveSpeed + this.vx) * dt;
        this.posY += (move.y * effectiveSpeed + this.vy) * dt;

        const r = this.radius;
        this.posX = Math.max(r, Math.min(ArenaConsts.SIZE - r, this.posX));
        this.posY = Math.max(r, Math.min(ArenaConsts.SIZE - r, this.posY));

        this.container.position.set(this.posX, this.posY);

        for (const r of this.attackResolvers) {
            r.update(dt, move, aimAngle);
        }

        this.draw(dt, move, aimAngle);

        // Flash during iframes
        this.container.alpha = this.iframes > 0
            ? (Math.sin(this.iframes * 30) > 0 ? 0.3 : 1.0)
            : 1.0;
    }

    /** Check all active resolvers for a hit against `enemy`. */
    checkHit(enemy: Enemy): HitInfo {
        const hitInfo = new HitInfo();
        for (const r of this.attackResolvers) {
            if (r.hasHitEnemy(enemy)) {
                continue;
            }

            const h = r.checkHit(this, enemy);
            if (h?.success) {
                r.markHitEnemy(enemy);
            }

            hitInfo.add(h);
        }
        return hitInfo;
    }

    /**
     * Heal based on lifesteal applied to `damage`.
     * Called by World whenever the player's attack successfully lands.
     */
    healFromDamageDealt(damage: number): void {
        if (this._lifestealPct <= 0) return;
        this.healBy(damage * this._lifestealPct);
    }


    healBy(recovery: number): void {
        this._hp = Math.min(this._maxHp, this._hp + recovery);
    }

    /**
     * Apply a world-space position delta from the collision-separation pass.
     * Clamps to arena bounds and syncs the sprite immediately so the visual
     * is correct in the same frame.
     */
    nudge(dx: number, dy: number): void {
        const r = this.radius;
        this.posX = Math.max(r, Math.min(ArenaConsts.SIZE - r, this.posX + dx));
        this.posY = Math.max(r, Math.min(ArenaConsts.SIZE - r, this.posY + dy));
        this.container.position.set(this.posX, this.posY);
    }

    /**
     * Apply a hit — only lands if iframes are not active.
     *
     * Damage pipeline:
     *   raw amount
     *     × _damageMult          (Iron Skin — universal reduction)
     *     × (1 − shieldBlock)    (if hit from within SHIELD_ARC_HALF of aim direction)
     *     → round, floor to min 1
     *
     * Knockback is scaled by (1 − _knockbackResist) (Juggernaut).
     *
     * @param amount  HP to remove (before reductions).
     * @param kbx     X knockback impulse (world units/s).  Points away from attacker.
     * @param kby     Y knockback impulse.
     * @returns true if the hit landed.
     */
    takeDamage(amount: number, kbx: number, kby: number): boolean {
        if (this.iframes > 0 || this._hp <= 0) return false;

        // Shield-side check — kbx/kby points away from attacker, so the incoming
        // direction is the opposite.
        let dmgMult = this._damageMult;
        const hitAngle = Math.atan2(-kby, -kbx);
        const angleDiff = Math.abs(wrapAngle(hitAngle - this._aimAngle));
        if (angleDiff <= KnightConsts.SHIELD_ARC_HALF) {
            const block = Math.min(0.85, KnightConsts.SHIELD_BASE_REDUCTION + this._shieldReduction);
            dmgMult *= (1 - block);
        }

        const reduced = Math.max(1, Math.round(amount * dmgMult));
        this._hp = Math.max(0, this._hp - reduced);
        this.iframes = KnightConsts.iframesAfterDamage;

        const resistFactor = Math.max(0, 1 - this._knockbackResist);
        this.vx += kbx * resistFactor;
        this.vy += kby * resistFactor;
        return true;
    }

    destroy(): void {
        this.container.destroy({ children: true });
        this.backgroundFxContainer.destroy({ children: true });
    }

    protected abstract issueUpdate(dt: number, move: Vec2, aimAngle: number): void;

    protected abstract draw(dt: number, move: Vec2, aimAngle: number): void;

    protected onRadiusChanged(): void { /* override in subclass to redraw body */
    }
}

// ── KnightPlayer ─────────────────────────────────────────────────────────────

export class KnightPlayer extends Player {
    /** Stored so it can be redrawn when radius changes (Juggernaut). */
    private body: Graphics;
    /** Shield arc redrawn every sim tick. */
    private readonly arcGfx: Graphics;
    /** Dust-cloud puffs emitted as the Knight walks. */
    private readonly dustSystem: DustCloudSystem;

    constructor(parent: Container) {
        super(parent);

        // Swing resolver is always present; ShockwaveResolver etc. are added on demand.
        this.attackResolvers.push(new SwingAttackResolver(this, KnightConsts.swing));

        this.body = new Graphics();
        this.drawBody();
        this.container.addChild(this.body);

        this.arcGfx = new Graphics();
        this.container.addChild(this.arcGfx);

        this.drawShieldArc(0);

        this.dustSystem = new DustCloudSystem(this.backgroundFxContainer, DustCloudConsts.KNIGHT_COLOR);
    }

    // ── Upgrade enablers ─────────────────────────────────────────────────────

    /**
     * Creates a ShockwaveResolver wired to the SwingAttackResolver.
     * Every 5th sword swing will queue a shockwave for World to consume.
     */
    override enableShockwave(): void {
        if (this.attackResolvers.some(r => r instanceof ShockwaveResolver)) return;
        const swing = this.attackResolvers.find(
            (r): r is SwingAttackResolver => r instanceof SwingAttackResolver,
        );
        if (!swing) throw new Error('KnightPlayer: SwingAttackResolver not found — cannot enable Shockwave');
        this.attackResolvers.push(new ShockwaveResolver(this, swing));
    }

    /**
     * Creates an AftershockResolver wired to the ShockwaveResolver.
     * Requires Shockwave to be enabled first (enforced by UpgradeDefinition.requires).
     */
    override enableAftershock(): void {
        if (this.attackResolvers.some(r => r instanceof AftershockResolver)) return;
        const shockwave = this.attackResolvers.find(
            (r): r is ShockwaveResolver => r instanceof ShockwaveResolver,
        );
        if (!shockwave) throw new Error('KnightPlayer: ShockwaveResolver not found — cannot enable Aftershock');
        this.attackResolvers.push(new AftershockResolver(this, shockwave));
    }

    /**
     * Creates an AuraResolver and inserts its graphics at z-index 0 (behind body).
     */
    override enableAura(): void {
        if (this.attackResolvers.some(r => r instanceof AuraResolver)) return;
        this.attackResolvers.push(new AuraResolver(this, KnightConsts.aura));
    }

    override enableHealTickResolver(val: number): void {
        const r = this.getResolver(HealTickResolver) ?? new HealTickResolver(KnightConsts.healTick, this);
        r.getAdditive().healPerTick += val;
        this.attackResolvers.push(r);
    }

    // ── Core loop ────────────────────────────────────────────────────────────

    override tryAttack(dt: number, aimAngle: number): void {
        for (const r of this.attackResolvers) {
            r.tryAttack(dt, aimAngle);
        }
    }

    protected override issueUpdate(dt: number, move: Vec2, aimAngle: number): void {
    }

    protected override draw(dt: number, move: Vec2, aimAngle: number): void {
        this.drawShieldArc(aimAngle);
        for (const r of this.attackResolvers) {
            r.draw(dt, move, aimAngle);
        }

        // Dust clouds — compute effective speed from actual position delta this tick
        const speed = dt > 0
            ? Math.hypot(this.posX - this._prevPosX, this.posY - this._prevPosY) / dt
            : 0;
        this.dustSystem.update(dt, this.posX, this.posY, speed);
    }

    protected override onRadiusChanged(): void {
        this.drawBody();
    }

    override destroy(): void {
        this.dustSystem.destroy();
        super.destroy();
    }

    // ── Private draw helpers ─────────────────────────────────────────────────

    private drawBody(): void {
        this.body.clear();
        this.body.circle(0, 0, this.radius).fill({ color: KnightConsts.color });
    }

    private drawShieldArc(aimAngle: number): void {
        const g = this.arcGfx;
        g.clear();
        const arcR = this.radius + 6;
        const start = aimAngle - KnightConsts.SHIELD_ARC_HALF;
        const end = aimAngle + KnightConsts.SHIELD_ARC_HALF;
        g.arc(0, 0, arcR, start, end);
        g.stroke({ color: KnightConsts.SHIELD_COLOR, width: 3, alpha: 1 });
    }
}
