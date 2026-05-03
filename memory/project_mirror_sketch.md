---
name: Mirror Sketch architecture
description: Mirror Sketch — Angular frontend (src/mirror-sketch) + Node Socket.io server (server/), real-time stroke relay protocol, run model
type: project
---

Mirror Sketch is the first game in the couple-games repo. Two players join a room via a 4-char code; one describes a reference image, the other draws on a canvas while strokes stream in real time to the describer's mirror canvas.

**Why:** Project owner wants couple-friendly games where two phones connect via room codes. Readme explicitly calls for Socket.io. Mobile-first; flex layouts everywhere.

**How to apply:**

### File layout
- `server/index.js` — Express + socket.io. In-memory `rooms` Map, no persistence.
- `src/mirror-sketch/`
  - `components/lobby/` — create/join entry point
  - `components/room/` — role picker + game (single component handles all phases via `game.phase()`)
  - `services/socket.service.ts` — typed wrapper, exposes RxJS subjects (`roomState$`, `drawStroke$`, `drawClear$`, `gameStarted$`, `gameReveal$`, `gameReset$`, `peerLeft$`, `connected$`) and Promise-based ack methods
  - `services/game.service.ts` — signal-based local state (`roomCode`, `myId`, `state`, `phase`, plus computed `me`, `peer`, `myRole`, `bothJoined`, `bothChose`, `currentScene`)
  - `directives/draw-canvas.directive.ts` — `[msDrawCanvas]` selector on `<canvas>`. PointerEvents only (works for touch + mouse). DPR-aware via ResizeObserver
  - `models/game.types.ts` — `Role`, `Player`, `RoomState`, `DrawStroke`, `Scene`, `AckResponse`
  - `data/scenes.ts` — 5 inline-SVG reference scenes. `getRandomScene()` / `getSceneById()`
  - `styles/_shared.scss` — design tokens + `@mixin button-primary` / `@mixin button-ghost`
- Routes in `src/app/app.routes.ts`: `/` → `/mirror-sketch`, `/mirror-sketch` (lobby), `/mirror-sketch/room/:code` (room). Lazy-loaded standalone components.

### Socket.io event protocol
Client → server (with ack):
- `room:create {}` → `{ ok, code, you, state }`
- `room:join { code }` → same shape
- `role:choose { role: 'drawer' | 'describer' }` → `{ ok }`
- `game:start { sceneId }` → `{ ok }` (server validates both roles picked)

Client → server (fire-and-forget):
- `draw:stroke <DrawStroke>` — server relays to peers via `socket.to(room).emit` (sender is excluded)
- `draw:clear`, `game:reveal`, `game:reset` — server broadcasts to entire room (including sender)

Server → client:
- `room:state <RoomState>` — broadcast on join/role-change/start/disconnect
- `draw:stroke`, `draw:clear`, `game:started { sceneId }`, `game:reveal`, `game:reset`, `peer:left { id }`

### Drawing coordinate convention
`DrawStroke` carries `{ phase: 'start'|'move'|'end', x, y, color, size, strokeId }`. **`x`, `y` are normalized 0..1** so the describer's mirror canvas can replay strokes at any size. `strokeId` is monotonic per drawer; the directive maintains a `lastPoints` map keyed by `strokeId` to connect line segments. The describer's canvas is mounted with `[interactive]="false"` so the directive does not bind pointer listeners — only `applyStroke()` calls from socket events render.

### Run model
- `npm run dev` runs `npm:server` + `npm:start` via `concurrently`. Socket server on `:3000`, Angular on `:4200`.
- `npm run server` — server alone.
- Frontend `SOCKET_URL` defaults to `http://localhost:3000`. Override at runtime by setting `window.__SOCKET_URL__` (no env-var indirection — set it in `index.html` or before bootstrap if deploying).
- No proxy config; socket.io client uses absolute URL with CORS.

### UI conventions
- Mobile-first. `100dvh` on root containers, `touch-action: none` on canvas, `viewport-fit=cover` + `user-scalable=no` in `index.html`.
- Describer view stacks vertically below 720px, side-by-side above. Drawer toolbar wraps with palette + brush range + clear.
- Color-scheme is light-only. Accent `#7a5cff`, danger `#d6336c`, ok `#2ec27e`. Tokens in `styles/_shared.scss`

### Known limitations
- No persistence: server restart drops all rooms.
- No reconnection logic — disconnect drops the player from the room.
- Mid-stroke canvas resize can momentarily mis-connect a line segment (lastPoints stored in absolute pixels). Acceptable edge case.
- Reference images are static SVGs hard-coded in `data/scenes.ts`. To add scenes, append to `SCENES`.
