import { Enemy } from "../entities/enemy";
import { HexBoss } from "../entities/hex-boss";
import { CorpseSystem } from "./corpse-system";
import { DeathParticleSystem } from "../effects/death-particle";
import { Player } from "../entities/player";

export class WorldData {
    static enemies: Enemy[] = [];
    static boss: HexBoss;
    static corpseSystem: CorpseSystem;
    static deathParticles: DeathParticleSystem;
    static player: Player;
}