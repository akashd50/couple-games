Rogue-Lite Multiplayer .IO Game Architecture & Design
This document outlines the foundation for a browser-based, multiplayer rogue-lite game using Angular, Phaser 3, and an
authoritative Node.js server.

1. Game Library Selection
   Since you are using Angular, you want a canvas/WebGL library that plays nicely with components and handles 2D physics
   and rendering smoothly on both mobile and PC browsers.
   Engine: Phaser 3 (or PixiJS).
   Why Phaser 3? It has built-in physics engines (Arcade Physics is perfect for an .io game's circle/rectangle
   collisions), camera systems, and input handling for both touch (mobile) and mouse/keyboard (PC).
   Integration: You will create an Angular component (e.g., <app-game-canvas>) that initializes the Phaser game instance
   in its ngOnInit lifecycle hook and safely destroys it in ngOnDestroy to prevent memory leaks.
2. Server Architecture (Authoritative Model)
   Because your server is authoritative, it must be the single source of truth. The node server will manage the lobby,
   state, and validate all logic to prevent cheating.
   Client to Server (Inputs): The client sends inputs, not raw positions (e.g., {"input": "move_up_left", "attacking":
   true}).
   Server to Client (State): The server sends the game state at a fixed tick rate (e.g., 20 or 30 updates per second).
   State includes player positions, enemy positions, health, and newly spawned objects/corpses.
   Client-Side Prediction: To ensure the game feels responsive, the client moves the player locally as soon as a button
   is pressed. When the server state arrives, the client corrects any discrepancies (Server Reconciliation).
   Interpolation: For enemies and other players, the client shouldn't just snap them to the server's coordinates. It
   should smoothly animate them from their last known position to the new position over a few frames.
3. Class Mechanics & Rogue-lite Upgrades
   Instead of automatic scaling, players gather XP (experience points) dropped by defeated enemies. Upon leveling up,
   the server sends the client a choice of 3 randomized power-ups. The player must select one to define their "build"
   for that run.
   The Knight (Melee Brawler)
   Visual: A circle with a noticeable "shield" or armor layer indicator.
   Attack: A sweeping sword arc in front of the player.
   Example Rogue-lite Upgrades (Choose 1 on Level Up):
   (Possibly one of Gainaable abilities in a rogue-lite fashion) Shockwave Mechanic: Every $N$th attack emits a larger,
   transparent circle expanding outward from the Knight, applying
   heavy knockback to give breathing room when swarmed.
   Wide Cleave: Increases the angle and range of the sword swing.
   Aftershock: The shockwave now deals damage in addition to knockback.
   Juggernaut: Increases maximum health and slightly increases player size/mass, making them harder to push around.
   Flurry: Significantly increases base attack speed.
   The Summoner (Ranged Necromancer)
   Visual: A circle with a darker, glowing core.
   Attack: Shoots small, fast-moving projectile shapes (e.g., tiny triangles).
   Revive Mechanic (The Core Loop): When an enemy dies, the server leaves a "corpse" node on the map for a few seconds.
   The Summoner's secondary ability consumes nearby corpses, turning them into friendly AI units (small squares).
   Example Rogue-lite Upgrades (Choose 1 on Level Up):
   Legion: +1 to maximum minion cap (starts at a low base, e.g., 2).
   Empowered Undead: Minions gain increased base health and damage.
   Explosive Demise: When a minion dies, it explodes, dealing area-of-effect damage to nearby enemies.
   Vampiric Link: A small percentage of damage dealt by minions heals the Summoner.
4. Enemy & Spawner Logic
   The server manages all enemy entity logic. Since there could be dozens of enemies, the AI should be
   lightweight—simple vector math is better than heavy pathfinding algorithms like A* for an MVP.
   Spawners: Invisible nodes on the server map. Every few seconds, they check how many enemies are currently alive in
   their "zone." If it falls below a threshold, they spawn a basic enemy.
   Basic Enemies (Triangles/Squares):
   Behavior: Idle wandering until a player gets within their "aggro radius." Once aggroed, they calculate the vector
   toward the nearest player and move continuously in a straight line toward them.
   Combat: Damage is dealt via collision overlaps. If the bounding box of an enemy intersects a player's bounding box,
   deduct health and apply a slight bounce-back (recoil) effect to both entities so health isn't instantly drained in a
   single frame.
   Boss Encounters: Spawned at specific coordinates (center or corners of the map) at certain time intervals.
   Behavior: Bosses can be massive polygons (e.g., Hexagons). Instead of just chasing the player, their server logic
   triggers predictable, avoidable mechanics, such as periodically stopping to shoot out 8 projectiles in a radial
   burst, or charging in a straight line. Bosses drop massive amounts of XP gems upon death.
