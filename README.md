# Tandem Game

A language-learning game built with React, TypeScript and Vite. Pick two languages, choose a grammar topic (modal verbs, conjunctions, ...) and practise with fill-the-gap questions.

Live site: https://malathit.github.io/tandem-game/

## Development

```sh
npm install
npm run dev      # dev server with hot reload (http://localhost:5173/tandem-game/)
npm run build    # type-check and bundle into dist/
npm run preview  # serve the production build locally
npm run lint
```

## Deployment

Pushing to `main` builds the app and deploys it to GitHub Pages via `.github/workflows/deploy.yml`.
Pages must be enabled once under Settings → Pages → Source: **GitHub Actions**.
