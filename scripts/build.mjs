import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const page = readFileSync(new URL('src/page.html', root), 'utf8');
if (/data-panel="module2"|data-m2-lesson|id="m2-/.test(page)) throw Error('Module 2 must not ship in production.');
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'">
  <title>Inference Engineering Master Map — Learn how LLMs run</title>
  <meta name="description" content="Learn LLM inference from first principles: a 13-topic roadmap, seven foundation lessons, interactive resource calculators, metrics, and debugging exercises. Module 1 available.">
  <link rel="canonical" href="https://inference-engineering-master-map.vercel.app/">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Inference Engineering Master Map">
  <meta property="og:description" content="Learn where time and bytes go. Explore foundation lessons, resource calculators, metrics, and debugging exercises.">
  <meta property="og:url" content="https://inference-engineering-master-map.vercel.app/">
  <meta name="twitter:card" content="summary_large_image">
  <meta property="og:image" content="https://inference-engineering-master-map.vercel.app/social-card.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Inference engineering: understand every token. Foundation lessons, interactive labs, and a 13-topic roadmap.">
  <meta name="twitter:title" content="Inference Engineering Master Map">
  <meta name="twitter:description" content="Foundation lessons, interactive resource calculators, and a 13-topic roadmap. Free, no sign-up.">
  <meta name="twitter:image" content="https://inference-engineering-master-map.vercel.app/social-card.png">
  <link rel="stylesheet" href="src/base.css">
  <link rel="stylesheet" href="src/styles.css">
  <script type="module" src="src/app.js"></script>
  <script defer src="src/analytics.js"></script>
</head>
<body>
  <a class="skip-link" href="#main">Skip to learning content</a>
  <header class="site-header">
    <div class="site-eyebrow">A practical learning resource</div>
    <h1>Inference engineering<span>Start with the system. Understand every token.</span></h1>
    <p>One complete foundation module, a map of 13 topics, and interactive labs. Modules 2–13 are a roadmap and are not published lessons.</p>
    <div class="site-meta"><a href="#module/1">Start Module 1</a><a href="#sources">Sources &amp; assumptions</a><span>Free · no sign-up</span></div>
  </header>
  <main id="main">${page}</main>
  <noscript><p class="no-script">Enable JavaScript to use the lessons and calculators. This site runs the learning tools in your browser.</p></noscript>
  <footer class="site-footer">An independent educational project. Calculators are simplified models, not measured hardware benchmarks. <a href="https://github.com/karthiksathishjeemain/inference-engineering-master-map/issues" target="_blank" rel="noopener noreferrer">Report a correction</a></footer>
</body>
</html>`;
if (process.argv.includes('--check')) {
  if (readFileSync(new URL('index.html', root), 'utf8') !== html) throw Error('index.html is stale. Run npm run build.');
  console.log('Generated page matches source.');
} else {
  writeFileSync(new URL('index.html', root), html);
  console.log(`Built ${fileURLToPath(new URL('index.html', root))}`);
}
