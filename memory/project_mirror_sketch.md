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
- `room:settings { spectator }` → `{ ok }` (describer-only — surprise mode toggle)
- `game:start { sceneId }` → `{ ok }` (server validates both roles picked)

Client → server (fire-and-forget):
- `draw:stroke <DrawStroke>` — in spectator mode, relayed to peers; in surprise mode, buffered server-side in `room.strokeHistory` and NOT relayed
- `draw:clear`, `game:reveal`, `game:reset` — server broadcasts to entire room (including sender)

Server → client:
- `room:state <RoomState>` — broadcast on join/role-change/settings-change/start/disconnect. RoomState carries `spectator: boolean`.
- `draw:stroke`, `draw:clear`, `game:started { sceneId, spectator }`, `game:reveal`, `game:reset`, `peer:left { id }`
- `draw:replay <DrawStroke[]>` — emitted only to the describer just before `game:reveal` when `spectator=false`. Carries the full buffered stroke history so the describer can replay the drawing on their (until-now blank) mirror canvas.

### Surprise mode (non-spectator)
Describer toggles "Surprise mode" in lobby → server sets `room.spectator=false`. During play, drawer's strokes are buffered server-side rather than relayed. On reveal, server emits `draw:replay` to the describer's socket id with the full history, then broadcasts `game:reveal`. Client side: `RoomComponent.applyReplay` retries across animation frames until `canvasEl` is mounted and sized (the mirror canvas is only mounted via `mirrorMounted()` once phase is `reveal` for non-spectator mode).

### Drawing coordinate convention
`DrawStroke` carries `{ phase: 'start'|'move'|'end', x, y, color, size, strokeId }`. **`x`, `y` are normalized 0..1** so the describer's mirror canvas can replay strokes at any size. `strokeId` is monotonic per drawer; the directive maintains a `lastPoints` map keyed by `strokeId` to connect line segments. The describer's canvas is mounted with `[interactive]="false"` so the directive does not bind pointer listeners — only `applyStroke()` calls from socket events render.

### Run model
- `npm run dev` runs `npm:server` + `npm:start` via `concurrently`. Socket server on `:3000`, Angular on `:4200`.
- `npm run server` — server alone.
- Frontend `SOCKET_URL` defaults to `http://localhost:3000`. Override at runtime via `window.__SOCKET_URL__`, which is now set by `public/runtime-config.js` (loaded as a `<script src="runtime-config.js">` in `index.html`).
- No proxy config; socket.io client uses absolute URL with CORS.

### Render deployment
- `render.yaml` at repo root defines two services: `couple-games-server` (Node web service, runs `node server/index.js`, free plan, health check `/health`) and `couple-games-web` (static site, builds `npm ci && npm run build:render`, publishes `dist/couple-games/browser`). Both region `oregon`, `NODE_VERSION=20`.
- Cross-service env wiring: server's `ORIGIN` is set from web's host (CORS allow-list, via `fromService`). Web's `SOCKET_URL` is hardcoded to `https://couple-games-server.onrender.com` because `fromService property: host` was returning the bare service name instead of the FQDN.
- `scripts/write-runtime-config.js` reads `process.env.SOCKET_URL` and emits `public/runtime-config.js`. Auto-prepends `https://` when only a hostname is given (Render's `fromService property: host` returns FQDN without scheme).
- `npm run build:render` = write runtime config + `ng build --configuration production`. Used by Render; locally the committed `runtime-config.js` (localhost default) is sufficient for `ng serve`.
- SPA fallback handled by `routes` block in `render.yaml` (`type: rewrite, source: /*, destination: /index.html`). `public/_redirects` is also present as a backup but Render's native `routes` config is what's actually wired.
- Free-tier caveat: Node service idles after 15 min, first connection after idle takes ~30–60s.

### Tabbed canvas board
Both roles share a single `.board` container (`aspect-ratio: 1/1`, `position: relative`) with absolutely-positioned `.board__panel` children that fade via opacity. This keeps every canvas continuously sized so the `ResizeObserver` in `DrawCanvasDirective` works across tab switches. `RoomComponent.activeTab` is `'reference' | 'drawing'`. `showTabs()` is true for describer-during-play (spectator only) and either role at reveal. Default tab on reveal: drawer→reference (the unseen original), describer→drawing (the unseen result). Drawer canvas stays mounted across phases (`interactive` toggled to false on reveal — directive checks the input at event time, not bind time).

### UI conventions
- Mobile-first. `100dvh` on root containers, `touch-action: none` on canvas, `viewport-fit=cover` + `user-scalable=no` in `index.html`.
- Describer view stacks vertically below 720px, side-by-side above. Drawer toolbar wraps with palette + brush range + clear.
- Color-scheme is light-only. Accent `#7a5cff`, danger `#d6336c`, ok `#2ec27e`. Tokens in `styles/_shared.scss`

### Known limitations
- No persistence: server restart drops all rooms.
- No reconnection logic — disconnect drops the player from the room.
- Mid-stroke canvas resize can momentarily mis-connect a line segment (lastPoints stored in absolute pixels). Acceptable edge case.
- Reference images are static SVGs hard-coded in `data/scenes.ts`. To add scenes, append to `SCENES`.
