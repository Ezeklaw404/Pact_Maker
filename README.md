# Pact Maker

Stat and XP tracker for tabletop RPGs. The DM sees every player at once, clicks one to focus, and awards XP. Players can join from their own devices and watch their sheet update live.

## Run it (Windows)

```
npm install
npm run dev
```

Open the address it prints (usually http://localhost:5173).

Commands:

- `npm run dev` develop with hot reload (port 5173)
- `npm run build` production build into `dist/`
- `npm run host` serve the built app plus the multiplayer relay (port 3000). Run `npm run build` first.
- `npm run preview` serve the built app without multiplayer (test the installable/offline version)
- `npm test` run the tests
- `npm run typecheck` type-check only

## Playing with others

1. `npm run build`, then `npm run host`. The terminal prints the addresses you can share.
2. Open the app at your network address (for example `http://192.168.0.17:3000`), not `localhost`, so the copied link is correct. Allow Node through Windows Firewall on Private networks the first time.
3. Menu > Host > Start hosting. Copy the room code or the join link.
4. Players open the link, or go to `<address>/join` and type the room code and their character's name. Nothing to install.
5. In the Host tab you can assign a character, choose what each player may do (view only, or add XP to their own character), preview exactly what they see, or kick them.

What players see: their own sheet in full, and every other character as name and race only. GM-only sheets (Menu > Players > Add monster) are never sent to players.

Reaching the host:

- Same room or home Wi-Fi: use the network address the terminal prints.
- Radmin VPN: everyone joins your Radmin network and uses your Radmin IP.
- Friends anywhere: a free tunnel such as Cloudflare Tunnel (`cloudflared tunnel --url http://localhost:3000`) gives an https link to share. Not tested with this project yet.

Limits:

- If the host page is refreshed, the room closes and players have to rejoin (their name and code are remembered).
- Campaigns live in the host's browser. Use Menu > Campaigns > Export to back one up or move it to another device, then Import there.

## How it works

- XP: level 0 to 1 costs 10, then 20, 40, 80... (change in `defaults.ts` under `rules`)
- Level label `4.05` = level 4, 5% of the way to 5. Only the whole number counts for rolls and unlocks.
- Modifiers multiply: combat 3x (whole party), favorite stat 2x (that stat and its child secondary stats), misc boost (per player, any multiplier)
- Techniques cap at level 5 (Mastered). Skills grow forever.
- Spendable XP: grant after a session, players spend on secondary stats, skills, techniques (not primary stats)
- Library: click a stat, race, skill or technique to edit or delete it. A stat can't be deleted while a skill or technique is linked to it.
- Rules page: write it in the app or import a .md/.txt file (headings, bullets and paragraphs render).
- Undo/redo (Ctrl+Z / Ctrl+Y) lasts for the session. Everything saves automatically in the browser.

## Code map

- `src/xp.ts` level math and modifiers
- `src/reducer.ts` every change to a campaign (undo/redo and sync both go through this)
- `src/defaults.ts` starter stats, races, example Fireball technique
- `src/view.ts` what each player is allowed to see (the privacy boundary)
- `src/host.ts` what a player may ask for, and the permission checks. Players never send raw actions.
- `src/protocol.ts` message and permission types
- `src/net.ts` WebSocket connection helpers
- `src/useHost.ts`, `src/usePlayer.ts` hosting and joining in React
- `server/host.mjs` serves `dist/` and relays messages. It never reads game data.
- `src/ui/` screens

Data flow: DM action > `dispatch` > reducer > history > autosave. Player request > `host.ts` checks it > reducer > `useHost` sends every player their own filtered view.

## Project structure

```
pact-maker/
├── index.html           page shell
├── vite.config.ts       Vite + PWA + test config
├── public/icon.svg      app icon
├── server/
│   └── host.mjs         static file server + WebSocket relay
└── src/
    ├── main.tsx         entry point (DM app, or the player page at /join)
    ├── App.tsx          top bar, dashboard grid, opens modals/menu
    ├── store.ts         React hook: current campaign, undo/redo, autosave
    ├── styles.css       all styling (dark theme)
    │
    ├── types.ts         data shapes (Campaign, Player, StatDef, AbilityDef...)
    ├── defaults.ts      starter stats/races/abilities, newCampaign()
    ├── xp.ts            level curve, progress, modifiers (the XP math)
    ├── reducer.ts       every change to a campaign, as an Action
    ├── history.ts       undo/redo stacks
    ├── storage.ts       IndexedDB save/load
    ├── portable.ts      export/import campaign JSON
    ├── dice.ts          dice parsing and rolling
    │
    ├── view.ts          per-player filtered view of a campaign
    ├── protocol.ts      permissions and message types
    ├── host.ts          sessions, request parsing, permission checks
    ├── net.ts           WebSocket connection helpers
    ├── useHost.ts       hosting hook (connection, players, sending views)
    ├── usePlayer.ts     joining hook (connection, latest view)
    │
    ├── core.test.ts     logic tests
    ├── view.test.ts     per-player view tests
    ├── host.test.ts     session and permission tests
    └── ui/
        ├── PlayerCard.tsx    dashboard card
        ├── FocusView.tsx     full-screen player view (DM)
        ├── ActionModal.tsx   award XP to many players/stats
        ├── GrantModal.tsx    hand out spendable XP
        ├── Menu.tsx          drawer (campaigns, players, library, rules, log, host)
        ├── JoinApp.tsx       join page for players (/join)
        ├── PlayerScreen.tsx  what a player sees (also the host's preview)
        ├── parts.tsx         shared bits (Bar, Modal, CopyButton, download)
        ├── render.test.tsx   screen smoke tests
        └── player.test.tsx   player screen tests
```
