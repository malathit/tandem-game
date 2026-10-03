# Tandem Game

A language-learning game for two people built with React, TypeScript and Vite. Each player is a native speaker of the language the other is learning. You take turns: the game shows a sentence in your own language, you translate it aloud into the language you are learning, and your partner judges it. The app itself does no scoring or judging.

Live site: https://www.malathi.dev/tandem-game/

## How to play

1. One player chooses "Create a game", picks the language they are learning, and sends their partner the invite link (or the 5-character code).
2. The other opens the link (or chooses "Join a game" and enters the code) and picks the language they are learning.
3. The host picks a topic (modal verbs, conjunctions, or their own). With AI sentences switched on, the host first reviews the sentences and can ask for new ones. Then you take turns: you each get two sentences in your own language to translate aloud into the language you are learning, and your partner judges. Be on a call or in the same room, because translations are spoken, not typed.

## Development

```sh
npm install
npm run dev      # dev server with hot reload (http://localhost:5173/tandem-game/)
npm run build    # type-check and bundle into dist/
npm run preview  # serve the production build locally
npm run lint
npm test         # unit tests (Vitest)
npm run e2e      # end-to-end tests against the live site (Playwright; see below)
```

Requires Node 22 (see `.nvmrc`).

## How it is put together

- `src/content/` is the content layer. Screens ask a `ContentSource` for sentences and never read the JSON files in `src/content/data/` directly, so another source (e.g. AI-generated) can replace the static one.
- `src/game/` holds the pure game rules (building a round, advancing turns).
- `src/online/` is how the two devices stay in sync. The host's device keeps the real game state and sends a full copy to the guest after every change; the guest only sends requests ("my language is…", "next turn"). Everything received from the other device is validated in `protocol.ts`. Devices talk through the `Network` interface, implemented with [PeerJS](https://peerjs.com/) (WebRTC) in `peerNetwork.ts` and with an in-memory fake in tests.

- `src/generation/` and `worker/` generate sentences with AI (see below). `src/game/useRoundSetup.ts` is the host's review step: choose a topic, preview its sentences, regenerate.

### Limits

- It is peer-to-peer: the game data goes directly between the two devices. A free public PeerJS service only introduces them, so a game cannot start while that service is down, and some strict networks block direct connections.
- If the host closes the tab the game ends. A guest who drops can rejoin with the same code while the host is still there.
- Only one guest can join a game.

## AI sentences

Optional. With it, the host can type any topic, and can swap a preset's hand-written sentences for freshly generated ones. Without it the game plays only the hand-written topics.

```
host's browser ──▶ Cloudflare Worker ──▶ stored sentences? ──▶ return
                          └──────────▶ Workers AI (Mistral Small 3.1) ──▶ validate ──▶ return
```

- Only the **host's** device calls the Worker. The sentences reach the partner over the existing peer-to-peer connection, so the guest needs nothing.
- The host always **reviews** the sentences before the round starts and can regenerate them. A small model can still write odd sentences, and a topic can try to steer it (prompt injection); the review is the safeguard.
- The Worker (`worker/`) validates the request, asks the model for exactly two sentences per language, and checks the answer (count, length, links and markup, duplicates, language). The browser checks it again.
- **Preset** topics keep up to five generated batches in KV for 30 days. **Custom** topics are never stored. A topic you type is sent to Cloudflare to generate sentences, nothing else about you is.
- It runs on Cloudflare's **free** plan, which has no billing: when a daily limit is reached the calls fail, and the game says "the free AI allowance is used up" and carries on with the hand-written topics. The Worker also caps itself at 400 AI calls a day, which keeps KV's 1,000 writes a day and the 10,000 free neurons a day in budget (a call costs about 5 neurons).
- CORS only lets `https://www.malathi.dev` and local development call the Worker. Anyone can still call it directly (for example with `curl`), so the daily cap is the real limit.

### Try it locally

```sh
cd worker && npx wrangler@4 dev --port 8787     # a local Worker that calls the real AI (free allowance)
VITE_GENERATE_URL=http://localhost:8787 npm run dev       # in another terminal
VITE_LIVE_WORKER_URL=http://localhost:8787 npx vitest run src/generation/live   # optional smoke test of the client
```

`wrangler dev` needs a Cloudflare login (`npx wrangler@4 login`) and a workers.dev subdomain registered in the dashboard.

### Deploy the Worker (once, and again when `worker/` changes)

```sh
cd worker
npx wrangler@4 deploy
```

The first deploy asks to create the `POOL` KV namespace; accept. (Or create it with `npx wrangler@4 kv namespace create POOL` and put the printed `id` in `worker/wrangler.toml`.) It prints the Worker's address, for example `https://tandem-generate.<your-subdomain>.workers.dev`.

Then, in the GitHub repository, add an **Actions variable** (Settings → Secrets and variables → Actions → Variables) named `VITE_GENERATE_URL` with that address. It is public, not a secret. The next push to `main` builds the page with it. Without the variable the AI features stay hidden.

## Deployment

Pushing to `main` builds the app and deploys it to GitHub Pages via `.github/workflows/deploy.yml`.
Pages must be enabled once under Settings → Pages → Source: **GitHub Actions**.

### End-to-end tests

`npm run e2e` plays real games on the **deployed** site with two separate browsers (a host and a guest, connected over real WebRTC) and makes real calls to the AI Worker: a preset topic with Regenerate, a custom topic, and the fallback when the Worker cannot be reached. Run `npx playwright install chromium` once first; set `E2E_URL` to aim them at another address.

[`.github/workflows/e2e.yml`](.github/workflows/e2e.yml) ([see its runs](https://github.com/malathit/tandem-game/actions/workflows/e2e.yml)) runs them after every successful deploy and once a day, so a broken Worker or a used-up daily AI allowance shows up as a failed run (the run page links to a downloadable Playwright report with traces, kept for 7 days). Each run uses about 5 of the Worker's 400 daily AI calls. Right after a deploy the Pages cache can still serve the old build for a few minutes, so a failure there is worth one re-run before digging.
