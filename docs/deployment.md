# Deployment and end-to-end tests

## The site

Pushing to `main` builds the app and deploys it to GitHub Pages via `.github/workflows/deploy.yml`. Pages must be enabled once under Settings → Pages → Source: **GitHub Actions**.

## The Worker (once, and again when `worker/` changes)

The Worker is deployed by hand, not from CI.

```sh
cd worker
npx wrangler@4.86.0 deploy --config wrangler.toml
```

Use exactly this wrangler version and `--config`: newer wrangler versions (4.147 at the time of writing) detect this Vite project and deploy the whole game as a separate static-site Worker, and edit `package.json` and `vite.config.ts` on the way.

The first deploy asks to create the `POOL` KV namespace; accept. (Or create it with `npx wrangler@4 kv namespace create POOL` and put the printed `id` in `worker/wrangler.toml`.) The deploy prints the Worker's address, for example `https://tandem-generate.<your-subdomain>.workers.dev`.

Then, in the GitHub repository, add an **Actions variable** (Settings → Secrets and variables → Actions → Variables) named `VITE_GENERATE_URL` with that address. It is public, not a secret. The next push to `main` builds the page with it. Without the variable the build cannot start a round.

How the Worker works: [ai-sentences.md](ai-sentences.md).

## End-to-end tests

`npm run e2e` plays real games on the **deployed** site with two separate browsers (a host and a guest, connected over real WebRTC) and makes real calls to the AI Worker: a preset topic with Regenerate, a hard round with three sentences per player, one sentence per player with translations, a custom topic, and what the host sees when the Worker cannot be reached. Run `npx playwright install chromium` once first; set `E2E_URL` to aim them at another address.

[`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml) ([see its runs](https://github.com/malathit/tandem-game/actions/workflows/e2e.yml)) runs them after every successful deploy and once a day, so a broken Worker or a used-up daily AI allowance shows up as a failed run (the run page links to a downloadable Playwright report with traces, kept for 7 days). Each run uses about 7 of the Worker's 400 daily AI calls. Right after a deploy the Pages cache can still serve the old build for a few minutes, so a failure there is worth one re-run before digging.
