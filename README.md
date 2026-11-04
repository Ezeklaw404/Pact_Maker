# Pact Maker

Stat and XP tracker for tabletop RPGs. The DM sees every player at once, clicks one to focus, and awards XP.

## Run it (Windows)

```
npm install
npm run dev
```

Open the address it prints (usually http://localhost:5173).

Other commands:

- `npm test` runs the tests
- `npm run build` makes a production build in `dist/`
- `npm run preview` serves that build (use this to test the installable/offline version)

## Android backup

Run `npm run dev` or `npm run preview` on the laptop, then open `http://<laptop-ip>:5173` (dev) or `:4173` (preview) on the phone, same Wi-Fi. Data is stored per device, so to move a campaign use menu > Campaigns > Export, then Import on the other device. Live sync comes with multiplayer.

## How it works

- XP: level 0 to 1 costs 10, then 20, 40, 80... (change in `defaults.ts` under `rules`)
- Level label `4.05` = level 4, 5% of the way to 5. Only the whole number counts for rolls and unlocks.
- Modifiers multiply: combat 3x (whole party), favorite stat 2x (that stat and its child secondary stats), misc boost (per player, any multiplier)
- Techniques cap at level 5 (Mastered). Skills grow forever.
- Spendable XP: grant after a session, players spend on secondary stats, skills, techniques (not primary stats)
- Undo/redo (Ctrl+Z / Ctrl+Y) lasts for the session. Everything saves automatically in the browser.

## Code map

- `src/xp.ts` level math and modifiers
- `src/reducer.ts` every change to a campaign (this is what undo/redo and later sync will use)
- `src/defaults.ts` starter stats, races, example Fireball technique
- `src/ui/` screens

## Project Structure

pact-maker/
├── index.html page shell
├── vite.config.ts Vite + PWA + test config
├── public/icon.svg app icon
└── src/
├── main.tsx entry point
├── App.tsx top bar, dashboard grid, opens modals/menu
├── store.ts React hook: current campaign, undo/redo, autosave
├── styles.css all styling (dark theme)
│
├── types.ts data shapes (Campaign, Player, StatDef, AbilityDef…)
├── defaults.ts starter stats/races/abilities, newCampaign()
├── xp.ts level curve, progress, modifiers (the XP math)
├── reducer.ts every change to a campaign, as an Action
├── history.ts undo/redo stacks
├── storage.ts IndexedDB save/load
├── portable.ts export/import campaign JSON
├── dice.ts dice parsing and rolling
│
├── core.test.ts logic tests
└── ui/
├── PlayerCard.tsx dashboard card
├── FocusView.tsx full-screen player view
├── ActionModal.tsx award XP to many players/stats
├── GrantModal.tsx hand out spendable XP
├── Menu.tsx ☰ drawer (campaigns, players, library, rules, log, host)
├── parts.tsx shared bits (Bar, Modal, download)
└── render.test.tsx screen smoke tests
