Game Design Document: The War Game (Working Title)
1. Executive Summary
   The War Game is a web-based Grand Strategy Simulation (GSS) focused on geopolitics, resource management, and global warfare. Players manage a nation’s destiny through a combination of domestic construction, technological research, espionage, and military force. The game features a high-performance interactive world map with detailed provincial-level data for North America in the MVP.

2. Technical Stack (Proposed)
   Framework: Angular (latest version) for UI, state management, and application logic.

Rendering Engine: PixiJS or Phaser. (PixiJS is recommended for high-performance 2D map manipulation and zooming).

Data Handling: GeoJSON for map coordinates; RxJS for the real-time simulation clock and event streams.

Styling: Tailwind CSS or Angular Material for the command consoles.

3. Core Systems & Mechanics
   3.1 Map & Navigation
   Global View: A draggable, zoomable world map using a Canvas-based renderer.

The "Deep Zoom" (MVP Focus):

United States & Canada: These regions are mapped at the sub-national level (States and Provinces).

Major Cities: Distinct coordinates within states/provinces that act as hubs for population and industry.

Interaction: Hover-highlighting for all countries, with detailed tooltips for the US and Canada showing resources and stability.

3.2 Time & Simulation Loop
Real-Time Clock: Displays YYYY-MM-DD.

Speed Controls: Pause, 1x (Slow), 5x (Normal), 20x (Fast).

Tick System: The engine calculates resource generation and intel gathering on a daily "tick."

3.3 Economy & Resource Management
National Resources:

Strategic Minerals: Iron, Coal, Gold, and Rare Earth metals.

Energy: Oil and Gas deposits.

Market Dynamics: A global commodities market where prices fluctuate based on scarcity and war.

Production: Building mines, oil depots, and refineries to increase output.

Trade: Diplomatic trade routes to acquire resources your country lacks.

Money: Players will also have to manage their currency and make sure they are making enough money for the trading and producing items. For things like agency hubs, the amount you invest in upgrading them i.e. their level will determine their efficiency.

3.4 Construction & Infrastructure
Agency System: Players build specialized "Agency Hubs":

Intel Agencies: For spying and counter-espionage.

Research Labs: For tech advancement.

Defense Plants: For weapon and vehicle production.

Military Facilities: Airfields, naval docks, and ICBM silos.

3.5 Espionage & Public Relations
Intel Gathering: Send agents to monitor foreign government planning or domestic public opinion.

Media Manipulation: Use "Media Campaigns" to influence how other countries view you or to suppress domestic unrest.

The "Fog of War": Enemy military movements and resource counts are hidden until sufficient intel is gathered.

3.6 Military & Technology
Tech Tree: Branching paths for Military (Missiles, Stealth, Nukes), Industrial (Mining efficiency), and Fantasy (Experimental energy weapons).

Unit Types:

Conventional: Infantry, Tanks, Planes, Boats.

Strategic: ICBMs, Tactical Nukes.

Combat: Real-time mobilization. Clicking a unit and dragging to a target country or city to initiate a strike or invasion.

4. MVP (Minimum Viable Product) Requirements
   Playable Faction: United States.

Map Detail: Full world map (interactive) with high-detail SVG/Canvas rendering for US (50 states) and Canada (13 provinces/territories).

The "Agency Hub": A UI panel where players can click to "Research" a basic tech or "Build" a basic resource mine.

Clock: Functional speed-controlled date system.

Basic War: Ability to select a "Nuke" or "Air Strike" and click on a Canadian province to see a visual "Explosion" event and a change in diplomatic status.

5. Development Roadmap for Claude (Instructions)
   Phase 1: The Map Foundation

"Build an Angular component using PixiJS to render a world map. Implement zoom and pan. Use GeoJSON to specifically draw the US and Canada with internal state/province borders. Implement a hover-state that highlights the current region."

Phase 2: The Simulation Engine

"Create a singleton service in Angular that manages the game clock. It should emit an event every 'tick' (based on speed settings). Link this to a resource service that increments 'Oil' and 'Gold' based on a static rate."

Phase 3: The Command UI

"Design a dashboard layout with a bottom 'News Ticker' for PR events and a side-panel for 'Agency Management.' Use Angular's reactive forms to handle speed controls and building placement."

Phase 4: Combat & Events

"Implement a simple 'Strike' mechanic. When a player selects a state in Canada and clicks 'Launch Strike,' trigger a visual notification and decrease the 'Public Relations' score between the two nations."

6. Future Expansion (Post-MVP)
   Playable Factions: Expand to UK, China, and Russia.

Fantasy Tier: Transition from modern warfare to orbital lasers and teleportation tech.

Complex Economy: Inflation, debt markets, and trade embargoes affecting resource prices.
