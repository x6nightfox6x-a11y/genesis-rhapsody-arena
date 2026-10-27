// Optional diagnostic, not a noisy CI frame-rate threshold. Uses an isolated browser and temporary server.
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
const preview = await startServer({ port: 0 });
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(preview.url + '/studio.html');
  await page.waitForFunction(() => document.getElementById('arena').contentWindow.DBDeployment?.canvas?.dataset.graBound);
  const frame = page.frames().find(frame => frame.url().includes('Arena%20game.html'));
  const results = { viewport: '1440×900', zoom: '135%', durationMs: 3000 };
  for (const mode of ['editor', 'game']) {
    if (mode === 'game') await page.locator('#testGame').click();
    await frame.evaluate(() => { const input=document.getElementById('arenaZoomPercent');input.value='135';input.dispatchEvent(new Event('change')); });
    await page.mouse.move(650, 400); await page.mouse.down({ button: 'middle' });
    const sample = frame.evaluate(() => new Promise(resolve => {
      const intervals=[];let last=performance.now(),start=last;
      function tick(time) {
        intervals.push(time-last);last=time;
        if(time-start<3000)requestAnimationFrame(tick);
        else {intervals.sort((a,b)=>a-b);resolve({frames:intervals.length,p50:intervals[Math.floor(intervals.length*.5)],p95:intervals[Math.floor(intervals.length*.95)]});}
      }
      requestAnimationFrame(tick);
    }));
    const start=Date.now();let i=0;
    while(Date.now()-start<3000){await page.mouse.move(700+Math.sin(i*.14)*80,430+Math.cos(i*.14)*60);i++;await new Promise(resolve=>setTimeout(resolve,12));}
    results[mode]=await sample;await page.mouse.up({button:'middle'});
  }
  console.log(JSON.stringify(results,null,2));
} finally {
  await browser?.close();await new Promise(resolve=>preview.server.close(resolve));
}
