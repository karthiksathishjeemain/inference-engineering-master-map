import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true, ...(process.env.CHROME_CHANNEL ? {channel:process.env.CHROME_CHANNEL} : {})});
try {
  const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
  await page.goto(new URL('../src/social-card.svg', import.meta.url).href);
  await page.screenshot({path:fileURLToPath(new URL('../social-card.png', import.meta.url))});
} finally { await browser.close(); }
