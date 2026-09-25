import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
// Set PLAYWRIGHT_MODULE to use an existing installation without installing dependencies.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({headless:true, ...(process.env.CHROME_CHANNEL ? {channel:process.env.CHROME_CHANNEL} : {})});
const base = process.env.SITE_URL || 'http://127.0.0.1:4173/';
await mkdir('test-results', {recursive:true});
const errors=[];
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
async function go(route) {
  await page.goto(base+'#'+route);
  await page.waitForFunction(()=>document.querySelector('#iem-layer-list button'));
  await page.waitForTimeout(70);
}
async function range(id,value) {
  await page.locator('#'+id).fill(String(value));
  await page.locator('#'+id).dispatchEvent('input');
}
try {
  await go('map');
  assert.equal(await page.locator('[data-view="module2"]').count(),0);
  assert.equal(await page.locator('[data-panel="module2"], [data-m2-lesson-panel]').count(),0);
  assert.equal(await page.locator('[data-layer]').count(),13);
  await page.locator('[data-layer="1"]').click();
  assert.ok(await page.locator('#iem-enter-module').isDisabled());
  await page.locator('[data-layer="0"]').click();
  await page.locator('#iem-enter-module').click();
  assert.ok(await page.locator('[data-lesson-panel="0"]').isVisible());
  await go('module/4');
  await range('m1-vram',16); await range('m1-reserve',32);
  assert.equal(await page.locator('#m1-min-gpus').textContent(),'Not feasible');
  await go('module/6');
  await page.locator('[data-roof-preset="decode"]').click();
  assert.equal(await page.locator('#m1-ai').textContent(),'5 FLOP/B');
  assert.match(await page.locator('#m1-roof-time').textContent(),/933/);
  for (const preset of ['prefill','decode']) {
    await page.locator('[data-roof-preset="'+preset+'"]').click();
    const bounded=await page.locator('#m1-roof-chart').evaluate(svg=>{
      const dot=svg.querySelector('#m1-roof-dot'),frame=svg.querySelector('[data-chart-frame]');
      const x=+dot.getAttribute('cx'),y=+dot.getAttribute('cy');
      return x>=+frame.getAttribute('x') && x<=+frame.getAttribute('x')+ +frame.getAttribute('width') && y>=+frame.getAttribute('y') && y<=+frame.getAttribute('y')+ +frame.getAttribute('height');
    });
    assert.ok(bounded,'roofline marker must stay inside plot');
  }
  await go('sim/prefill'); assert.equal(await page.locator('#pd-decode-steps').textContent(),'255');
  await go('sim/kv'); await range('kv-seq',17); assert.equal(await page.locator('#kv-pages').textContent(),'16');
  await go('sim/tp'); await range('tp-degree',1); assert.match(await page.locator('#tp-observation').textContent(),/zero TP communication/);
  await go('sim/scheduler'); await range('sc-arrival',100); assert.match(await page.locator('#sc-p99').textContent(),/Growing/);
  await go('module/7');
  await page.locator('#m1-complete').click(); assert.match(await page.locator('#m1-complete-status').textContent(),/Reach 4/);
  for (const answer of [1,0,1,0,1]) {
    await page.locator('input[name="m1-quiz-choice"][value="'+answer+'"]').check();
    await page.locator('#m1-quiz-check').click(); await page.locator('#m1-quiz-next').click();
  }
  await page.locator('#m1-complete').click();
  await page.reload(); assert.match(await page.locator('#m1-complete-status').textContent(),/restored/);
  await go('labs');
  for (let i=0;i<6;i++) {
    await page.locator('[data-scenario="'+i+'"]').click(); await page.locator('input[name="lab-choice"][value="0"]').check();
    await page.locator('#lab-check').click(); assert.ok(await page.locator('#lab-answer').isVisible());
  }
  await go('curriculum'); await page.locator('#iem-capstone').click(); assert.equal(await page.locator('#iem-capstone').getAttribute('aria-expanded'),'true');
  await go('sources'); await page.locator('[data-view="map"]').click();
  assert.match(await page.locator('#iem-layer-why').textContent(),/resource model/);
  await page.locator('[data-view="metrics"]').click(); await page.goBack();
  assert.ok(await page.locator('[data-panel="map"]').isVisible(),'Browser Back restores the previous view');
  const routes=['map','module/1','module/2','module/3','module/4','module/5','module/6','module/7','sim/kv','sim/prefill','sim/quant','sim/tp','sim/scheduler','metrics','labs','curriculum','sources'];
  for (const width of [320,375,768,1024,1440]) {
    await page.setViewportSize({width,height:1000});
    for (const route of routes) {
      await go(route);
      const overflow=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
      assert.ok(overflow.scroll<=overflow.width+1,`${width}px ${route} horizontal overflow: ${JSON.stringify(overflow)}`);
      assert.equal(await page.locator('.iem-view.is-active').count(),1);
    }
    await go('module/6'); await page.locator('.iem-roofline').screenshot({path:`test-results/roofline-${width}.png`});
  }
  await page.setViewportSize({width:1440,height:1000}); await go('map'); await page.screenshot({path:'test-results/desktop.png',fullPage:true});
  await page.emulateMedia({colorScheme:'dark'}); await go('module/6'); await page.screenshot({path:'test-results/dark-roofline.png',fullPage:true});
  await page.setViewportSize({width:375,height:900}); await page.emulateMedia({colorScheme:'light'}); await go('module/1'); await page.screenshot({path:'test-results/mobile.png',fullPage:true});
  const accessibilityViolations=[];
  for (const theme of ['light','dark']) {
    await page.emulateMedia({colorScheme:theme});
    for (const route of routes) {
      await go(route);
      const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      for (const v of audit.violations) accessibilityViolations.push({theme,route,id:v.id,impact:v.impact,nodes:v.nodes.slice(0,3).map(n=>({target:n.target,summary:n.failureSummary}))});
    }
  }
  assert.deepEqual(accessibilityViolations,[],'Accessibility issues');
  // Private browsing / denied persistence must not prevent page initialization.
  const blocked=await browser.newPage(); await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}}));
  await blocked.goto(base+'#module/6'); await blocked.waitForSelector('#roof-path'); await blocked.close();
  assert.deepEqual(errors,[],'No runtime or browser-console errors');
  console.log(`PASS: navigation and Back, module availability, memory edge, roofline, simulators, quiz persistence, 6 debug cases, capstone, ${routes.length*5} responsive views, ${routes.length*2} accessibility audits, dark mode, blocked storage.`);
} finally { await browser.close(); }
