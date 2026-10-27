const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.join(__dirname,'..');
for(const name of ['index.html','Arena game.html','studio.html']){
 const html=fs.readFileSync(path.join(root,name),'utf8');
 for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){if(m[0].includes('application/json'))continue;try{new Function(m[1])}catch(e){throw Error(name+': '+e.message)}}
}
const server=http.createServer((req,res)=>{const p=path.join(root,decodeURIComponent(req.url.split('?')[0]));fs.readFile(p,(e,b)=>{res.statusCode=e?404:200;res.setHeader('Content-Type',p.endsWith('.html')?'text/html; charset=utf-8':p.endsWith('.json')?'application/json':'application/octet-stream');res.end(e?'not found':b)})});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'msedge'});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/studio.html`);
 const frame=page.frames().find(f=>f.url().endsWith('/index.html'));
 await frame.waitForFunction(()=>window.ArenaEditor&&window.DBDeployment.active&&window.ArenaEditor.hostToggle);
 const state=()=>frame.evaluate(()=>window.DBDeployment.inspect());
 const transform=()=>frame.evaluate(()=>window.DBDeployment.canvas.style.transform);
 const geometry=()=>frame.evaluate(()=>{const r=document.querySelector('.graveyard-camera').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}});
 const before=await state(),g=await geometry();assert.equal(g.width,1152);assert.equal(g.height,900);assert.equal(g.x,144);
 // Zoom in to leave room to pan; drag on exposed canvas away from the editor.
 await page.mouse.move(650,450);await page.mouse.wheel(0,-600);await page.waitForTimeout(150);
 const t=await transform();await page.mouse.down({button:'middle'});await page.mouse.move(760,500,{steps:8});await page.mouse.up({button:'middle'});
 assert.notEqual(await transform(),t,'middle drag must pan');assert.deepEqual(await state(),before,'pan must not move units');
 const t2=await transform();await page.keyboard.down('Shift');await page.mouse.down();await page.mouse.move(690,450,{steps:8});await page.keyboard.up('Shift');await page.mouse.up();
 assert.notEqual(await transform(),t2,'Shift drag must pan even when Shift released before mouse');assert.deepEqual(await state(),before);
 await frame.evaluate(()=>{const a=DBDeployment,units=a.inspect().units;units[0].hp-=1;a.replace(units)});
 const edited=await state(),camera=await transform();
 await page.keyboard.press('F8');assert.equal(await frame.evaluate(()=>DBDeployment.active),false);assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('testing')),true);
 assert.deepEqual(await state(),edited,'resume preserves edited units and HP');assert.deepEqual(await geometry(),g);assert.equal(await transform(),camera);
 await page.keyboard.press('F8');assert.equal(await frame.evaluate(()=>DBDeployment.active),true);assert.equal(await frame.locator('#deployPanel').isVisible(),true);assert.deepEqual(await state(),edited);
 for(let i=0;i<3;i++){await page.locator('#testGame').click();await page.locator('#endTest').click()}
 assert.deepEqual(await state(),edited);assert.deepEqual(await geometry(),g);
 // The embedded editor's own Continue button must update the Studio chrome too.
 await frame.locator('#depResume').click();assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('testing')),true);
 await page.locator('#endTest').click();assert.equal(await frame.evaluate(()=>DBDeployment.active),true);
 // Cancelled pointer capture cannot leave the camera stuck grabbing.
 await page.mouse.move(650,450);await page.mouse.down({button:'middle'});
 await frame.evaluate(()=>DBDeployment.canvas.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true})));
 await page.mouse.up({button:'middle'});assert.equal(await frame.evaluate(()=>DBDeployment.canvas.style.cursor),'');
 // Invalid roster must keep Studio in editor mode with visible feedback.
 await frame.evaluate(()=>DBDeployment.clearAll());await page.locator('#testGame').click();assert.equal(await frame.evaluate(()=>DBDeployment.active),true);assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('testing')),false);
 assert.match(await page.locator('#status').innerText(),/双方都有存活角色/);
 await page.goto(`http://127.0.0.1:${server.address().port}/Arena%20game.html`);
 await page.waitForFunction(()=>window.ArenaEditor&&window.DBDeployment?.canvas);
 await page.keyboard.press('F8');assert.equal(await page.evaluate(()=>DBDeployment.active),true);
 await page.mouse.move(650,450);await page.mouse.wheel(0,-600);await page.waitForTimeout(100);
 const standalone=await page.evaluate(()=>DBDeployment.canvas.style.transform);
 await page.mouse.down({button:'middle'});await page.mouse.move(720,490,{steps:5});await page.mouse.up({button:'middle'});
 assert.notEqual(await page.evaluate(()=>DBDeployment.canvas.style.transform),standalone);
 await page.keyboard.press('F8');assert.equal(await page.evaluate(()=>DBDeployment.active),false);
 assert.deepEqual(errors,[]);console.log('PASS: syntax, middle/Shift pan, shared state/HP, F8 and buttons, fixed viewport/camera, cancellation, invalid roster.');

 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
