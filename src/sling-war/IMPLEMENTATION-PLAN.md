# Sling War — Implementation Plan

## Overview
Two-player turn-based destruction game with trivia. Players build a structure, answer trivia questions during rounds, then sling projectiles at the opponent's heart to destroy it. Played over a video call with the existing Socket.io room system.

## Architecture & Tech Stack
- **Frontend**: Angular, lazy-loaded route at `/sling-war`
- **Physics**: Matter.js (built-in renderer sufficient for MVP)
- **Multiplayer**: Extends existing `SocketService` (server on `:3000`) + existing room create/join
- **State**: Angular signals + RxJS Subjects, same pattern as thewargame subproject
- **Persistence**: localStorage for local preferences only; server-authoritative game state
- **Theme**: Shared CSS tokens for dark mode support

## Room Lifecycle
`waiting` → `building` → `trivia` → `battle` → `finished`

## Room State Extension
The room object gains these fields alongside existing ones:
```ts
type RoomGame = {
  phase: 'waiting' | 'building' | 'trivia' | 'battle' | 'finished';
  layouts: { p1: BlockPlacement[]; p2: BlockPlacement[] };
  p1Ready: boolean;
  p2Ready: boolean;
  triviaTurn: 'p1' | 'p2';     // who is asking
  triviaConfirmed: 'p1' | 'p2' | null;  // who confirmed they asked
  p1Awarded: boolean;           // has p1 been awarded for answering?
  p2Awarded: boolean;
  p1Points: number;
  p2Points: number;
  p1PowerUps: number;
  p2PowerUps: number;
  battleActive: boolean;        // physics simulation started
  battleResult: 'p1_wins' | 'p2_wins' | null;
};
```

## Server Changes (server/index.js)
- Add game room state to the existing room object
- New events:
  - `game:ready` — player signals ready for building
  - `game:layout` — broadcast block placement during building
  - `game:trivia-state` — sync trivia turn order
  - `game:trivia-asked` — confirm "I asked my question"
  - `game:trivia-awarded` — award points to opponent
  - `game:battle-start` — both agree to start battle
  - `game:battle-sync` — physics state sync (positions/rotations)
  - `game:power-up` — spend points on a power-up
  - `game:round-result` — announce round winner
- When both players ready → transition from `waiting` to `building`
- During battle: server forwards physics snapshots at ~30fps
- Heart collision → server declares winner

## File Layout
```
sling-war/
├── IMPLEMENTATION-PLAN.md
├── sling-war.routes.ts
├── sling-war/
│   ├── sling-war.component.ts          (shell — connects socket + game)
│   ├── components/
│   │   ├── lobby/
│   │   │   └── lobby.component.ts      (room join, ready up)
│   │   ├── building/
│   │   │   ├── building.component.ts   (block palette + canvas)
│   │   │   └── block-palette.component.ts (sidebar block types)
│   │   ├── trivia/
│   │   │   └── trivia.component.ts     (question confirmation flow)
│   │   └── battle/
│   │       └── battle.component.ts     (slingshot + physics canvas)
│   ├── services/
│   │   ├── physics.service.ts          (Matter.js init/cleanup, body management)
│   │   ├── state.service.ts            (room state signals, game phase)
│   │   └── build.service.ts            (block placement logic)
│   ├── data/
│   │   ├── block-types.ts              (Wood, Stone, Dynamite definitions)
│   │   ├── power-ups.ts                (Heavy Ammo, Explosive Shot, etc.)
│   │   └── trivia-prompts.ts           (UI text, not questions)
│   └── sling-war.component.scss
└── game.types.ts                       (game type definitions)
```

## Phases

### Phase 1 — Room + Lobby
- Extend `RoomState` type in shared models
- Add game-specific socket events to `SocketService`
- Sling War routing: lazy-loaded route at `/sling-war`
- Lobby component: create/join room, choose player slot, "Ready Up"
- Server: game room state, ready sync, phase transitions

### Phase 2 — Building Mode
- Matter.js engine init in canvas component (static bodies)
- Grid sidebar of block types (Wood, Stone, Dynamite)
- Drag-and-drop blocks onto player's half of canvas
- Heart object at bottom center of each side
- Two-player: blocks placed alternately on same screen
- Both players ready → transition to trivia

### Phase 3 — Trivia Phase
- Angular UI overlay for trivia flow:
  1. "Your turn to ask a question!" → on call, ask
  2. "I asked my question" button
  3. Opposite player sees "Was their answer correct?" [Yes]/[No]
  4. Award point to the asker if yes
- Server orchestrates turn order
- Winner of trivia gets power-up points

### Phase 4 — Battle Mode
- Blocks become dynamic (gravity enabled)
- Slingshot mechanic: drag-back projectile with visible trajectory line
- Spend power-up points on power-ups (Heavy Ammo, Explosive Shot, etc.)
- Server syncs physics at ~30fps to opponent
- Win: heart destroyed (collision listener)
- Round result broadcast, best-of-3 support

### Phase 5 — Polish
- Touch/pointer events for mobile
- Responsive camera fit (PC widescreen vs mobile portrait)
- Sound effects for placement, impact, destruction
- More block types (glass, metal, explosive)
- Replay VFX on heart destruction
- Local best-of-3 rounds mode

## Locked Decisions
- Renderer: Matter.js built-in renderer (no PixiJS for MVP)
- Multiplayer: Socket.io via existing server
- Physics: server-authoritative during battle (physics state relay)
- Trivia: no question bank — player verbal on call, boolean confirmation only
- State: Angular signals + RxJS for local, server-authoritative for sync
