# Inference Engineering Master Map

A free static learning resource with **one published module**, a 13-topic roadmap, interactive calculators, metrics, and debugging exercises.

[Production](https://inference-engineering-master-map.vercel.app/) · [Module 1](https://inference-engineering-master-map.vercel.app/#module/1) · [Sources](https://inference-engineering-master-map.vercel.app/#sources)

## What's available

- Module 1: seven lessons on inference systems, compute, GPU execution, memory, movement, roofline reasoning, and a checkpoint with a profiling project.
- Calculators for GEMM work, memory fit, transfers, roofline ceilings, KV paging, prefill/decode work, weight storage, idealized TP communication, and offered load.
- Metric definitions and six diagnostic exercises.
- Thirteen map topics and a future project roadmap. **Modules 2–13 are not published lessons.** Module 2's earlier draft is retained in Git history, not the production bundle.

Every calculator states its simplifying assumptions. Results are not hardware benchmarks or deployment guarantees. See the [content review](docs/content-review.md) for corrections and primary references.

## Local development

The app has no runtime dependencies or external UI assets. Node 20+ builds and tests the calculators; Python 3 can serve the site.

```sh
npm run build
npm test
npm run dev
```

Open http://127.0.0.1:4173/. Edit `src/page.html` for content, `src/styles.css` and `src/base.css` for layout, `src/app.js` for interactions, and `src/models.js` for calculations. Regenerate the committed `index.html` with `npm run build` after content/template changes. `npm run check` checks the calculations and generated page.

## Browser verification

Install the development dependencies and Chromium, start the local server, then run:

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

With Chrome already installed, `CHROME_CHANNEL=chrome npm run test:browser` uses it. `SITE_URL` can point to a deployment. Screenshots go to ignored `test-results/`.

## Deploy and sharing

Vercel builds the static site with `npm run build`; `vercel.json` publishes the root. The committed output also supports GitHub Pages. Vercel Web Analytics loads only on Vercel hostnames.

Lessons and simulators have shareable hash URLs (e.g. `#module/6` for roofline, `#sim/kv` for KV cache). Progress is stored in browser-local storage when available; no account is required. It cannot be synchronized across devices.

The 1200×630 Twitter/Open Graph image is generated from `src/social-card.svg` with `node scripts/render-social.mjs` (Playwright/Chromium required).

Technical corrections are welcome through GitHub issues. Please include the page, the disputed claim or calculation, and a primary reference or reproducible example.
