# Tandem Game

A language-learning game for two people built with React, TypeScript and Vite. Each player is a native speaker of the language the other is learning. You take turns: the game shows a sentence in your own language, you translate it aloud into the language you are learning, and your partner judges it. The app itself does no scoring or judging.

Live site: https://www.malathi.dev/tandem-game/

## How to play

- **On one device:** choose "Play on this device", pick the language each player is learning, then a topic (modal verbs, conjunctions, or your own), and pass the device back and forth.
- **On two devices:** one player chooses "Create a game" and shares the 5-character code, the other chooses "Join a game" and enters it. You say your translations out loud, so be on a call or in the same room.

## Development

```sh
npm install
npm run dev      # dev server with hot reload (http://localhost:5173/tandem-game/)
npm run build    # type-check and bundle into dist/
npm run preview  # serve the production build locally
npm run lint
npm test         # unit tests (Vitest)
```

Requires Node 22 (see `.nvmrc`).

## How it is put together

- `src/content/` is the content layer. Screens ask a `ContentSource` for sentences and never read the JSON files in `src/content/data/` directly, so another source (e.g. AI-generated) can replace the static one.
- `src/game/` holds the pure game rules (building a round, advancing turns).
- `src/online/` is two-device play. The host's device keeps the real game state and sends a full copy to the guest after every change; the guest only sends requests ("my language is…", "next turn"). Everything received from the other device is validated in `protocol.ts`. Devices talk through the `Network` interface, implemented with [PeerJS](https://peerjs.com/) (WebRTC) in `peerNetwork.ts` and with an in-memory fake in tests.

### Limits of two-device play

- It is peer-to-peer: the game data goes directly between the two devices. A free public PeerJS service only introduces them, so a game cannot start while that service is down, and some strict networks block direct connections.
- If the host closes the tab the game ends. A guest who drops can rejoin with the same code while the host is still there.
- Only one guest can join a game.

## Deployment

Pushing to `main` builds the app and deploys it to GitHub Pages via `.github/workflows/deploy.yml`.
Pages must be enabled once under Settings → Pages → Source: **GitHub Actions**.
