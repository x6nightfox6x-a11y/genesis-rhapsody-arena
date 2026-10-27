import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { root } from '../tools/site.mjs';
import { startServer } from '../tools/serve.mjs';
import { FakeGitHub, TOKEN } from './github-fixture.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
let browser, preview;
before(async () => {
  preview = await startServer({ port: 0, directory: path.join(root, '_site') });
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
});
after(async () => { await browser?.close(); if (preview) await new Promise(resolve => preview.server.close(resolve)); });
async function studio(t, configure) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage(), errors = [];
  if (configure) await configure(page);
  const engineRequests = [];
  page.on('request', request => { if (request.resourceType() === 'document' && /Arena(?:%20| )game\.html/.test(request.url())) engineRequests.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  t.after(async () => {
    await mkdir(path.join(root, 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'test-results', t.name.replace(/[^a-z0-9]+/gi, '-') + '.png') });
    await context.close(); assert.deepEqual(errors, [], 'browser runtime errors');
  });
  await page.goto(preview.url + '/studio.html');
  await page.waitForFunction(() => { const w = document.getElementById('arena').contentWindow; return w.ArenaCampaignLoaded && w.DBDeployment?.active && w.document.querySelector('canvas.graveyard-game-canvas')?.dataset.graBound; });
  const frame = page.frames().find(f => /Arena(?:%20| )game\.html/.test(f.url()));
  assert.ok(frame, 'Studio must load the canonical engine');
  assert.equal(engineRequests.length, 1, 'campaign startup should load the engine once');
  return { page, frame };
}
async function screenPoint(frame, team) {
  const point = await frame.evaluate(team => {
    const api = window.DBDeployment, unit = api.inspect().units.find(u => u.def.team === team), canvas = api.canvas, rect = canvas.getBoundingClientRect();
    return { x: rect.left + (10 + unit.pos.x * 100) * rect.width / canvas.width, y: rect.top + (10 + unit.pos.y * 100) * rect.height / canvas.height };
  }, team);
  const bounds = await (await frame.frameElement()).boundingBox();
  return { x: point.x + bounds.x, y: point.y + bounds.y };
}
test('Studio campaign, fixed viewport, map pan and test/editor round trip', async t => {
  const { page, frame } = await studio(t);
  assert.equal(await page.locator('#campaignSelect').inputValue(), 'arena-001');
  assert.equal(await frame.locator('#arenaDisplaySettings .db-cinema-controls').count(), 1, 'presentation initializes after async map startup');
  await page.locator('#studioLang').selectOption('en');
  await frame.waitForFunction(() => document.querySelector('.hud-bar [data-mode="move"]').textContent.startsWith('Move'));
  await page.locator('#studioLang').selectOption('zh');
  const geometry = await frame.evaluate(() => { const r = document.querySelector('.graveyard-camera').getBoundingClientRect(); return { x: r.x, width: r.width, height: r.height, expectedHeight: innerHeight }; });
  assert.equal(geometry.width, 1152); assert.equal(geometry.x, 144); assert.equal(geometry.height, geometry.expectedHeight);
  await frame.evaluate(async () => DBDeployment.insertID(await ArenaRuntime.prepare(await (await fetch('角色卡/Jay.downbeat.json')).json())));
  assert.equal(await frame.locator('.hud').isVisible(), false, 'editing hides the entire action panel, including after selecting a character');
  const before = await frame.evaluate(() => DBDeployment.inspect());
  await page.mouse.move(650, 400); await page.mouse.wheel(0, -600);
  const oldTransform = await frame.evaluate(() => DBDeployment.canvas.style.transform);
  await page.mouse.down({ button: 'middle' }); await page.mouse.move(740, 460, { steps: 8 }); await page.mouse.up({ button: 'middle' });
  assert.notEqual(await frame.evaluate(() => DBDeployment.canvas.style.transform), oldTransform);
  assert.deepEqual(await frame.evaluate(() => DBDeployment.inspect()), before, 'panning must not edit units');
  await page.locator('#testGame').click(); assert.equal(await frame.evaluate(() => DBDeployment.active), false);
  assert.equal(await frame.locator('.hud').isVisible(), true, 'testing restores the action panel');
  await page.locator('#endTest').click(); assert.equal(await frame.evaluate(() => DBDeployment.active), true);
  assert.equal(await frame.locator('.hud').isVisible(), false, 'returning to the editor hides the action panel again');
  assert.deepEqual(await frame.evaluate(() => DBDeployment.inspect()), before, 'switching must preserve roster');
});
test('game panning owns the camera, cancels pending aim and releases pointer capture', async t => {
  const { page, frame } = await studio(t);
  await frame.evaluate(async () => DBDeployment.insertID(await ArenaRuntime.prepare(await (await fetch('角色卡/Jay.downbeat.json')).json())));
  await page.locator('#testGame').click();
  const ally = await screenPoint(frame, 'ally'); await page.mouse.click(ally.x, ally.y);
  await frame.locator('.hud-bar [data-mode="attack"]').click();
  await page.mouse.move(650, 400); await page.mouse.wheel(0, -350);
  await page.mouse.down({ button: 'middle' });
  assert.equal(await frame.evaluate(() => DBDeployment.canvas.style.cursor), 'grabbing');
  const original = await frame.evaluate(() => DBDeployment.inspect());
  const start = await frame.evaluate(() => DBDeployment.canvas.style.transform);
  await page.mouse.move(710, 450, { steps: 8 });
  const moved = await frame.evaluate(() => DBDeployment.canvas.style.transform);
  assert.notEqual(moved, start);
  await frame.evaluate(async () => {
    const actor = DBDeployment.inspect().units.find(unit => unit.def.team === 'ally');
    DBLeonCinematicCamera.select(actor.pos);
    DBLeonCinematicCamera.flightStart(actor.pos, { x: 1, y: 1 });
    DBLeonCinematicCamera.flightFollow({ x: 1, y: 1 });
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  assert.equal(await frame.evaluate(() => DBDeployment.canvas.style.transform), moved, 'automatic camera cannot pull against a held pan');
  await frame.evaluate(() => DBDeployment.canvas.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true })));
  await page.mouse.up({ button: 'middle' });
  assert.equal(await frame.evaluate(() => DBDeployment.canvas.dataset.cameraPanning), undefined);
  assert.equal(await frame.evaluate(() => DBDeployment.canvas.style.cursor), 'crosshair');
  assert.deepEqual(await frame.evaluate(() => DBDeployment.inspect()), original, 'camera gestures must not consume AP or alter the world');
  await page.mouse.move(650, 400); await page.keyboard.down('Shift'); await page.mouse.down();
  await page.mouse.move(680, 440); await page.keyboard.up('Shift'); await page.mouse.up();
  assert.equal(await frame.evaluate(() => DBDeployment.canvas.dataset.cameraPanning), undefined);
  assert.deepEqual(await frame.evaluate(() => DBDeployment.inspect()), original);
});
test('ID animation pauses in the background and resumes when opened', async t => {
  const { page } = await studio(t);
  const editor = page.frames().find(frame => frame.url().endsWith('/Downbeat_ID_Card_Studio.html'));
  await editor.waitForFunction(() => typeof DBSetPreviewActive === 'function');
  await editor.evaluate(() => { window.testDrawCount=0;const draw=DBCard.draw;DBCard.draw=function(...args){window.testDrawCount++;return draw.apply(this,args);}; });
  await page.waitForTimeout(100);const hidden=await editor.evaluate(() => window.testDrawCount);
  await page.waitForTimeout(100);assert.equal(await editor.evaluate(() => window.testDrawCount), hidden);
  await page.locator('#editorTab').click(); await editor.waitForFunction(before => window.testDrawCount > before, hidden);
  await page.locator('#arenaTab').click(); await page.waitForTimeout(100);
  const stopped=await editor.evaluate(() => window.testDrawCount);await page.waitForTimeout(100);
  assert.equal(await editor.evaluate(() => window.testDrawCount), stopped);
});
async function routeGitHub(page,github){
  page.on('requestfailed',request=>{if(request.url().startsWith('https://api.github.com/'))console.log('GitHub test request failed:',request.failure()?.errorText);});
  await page.route('https://api.github.com/**',async route=>{
    const request=route.request(),cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type,x-github-api-version,accept','access-control-allow-methods':'GET,POST,PATCH,OPTIONS','content-type':'application/json'};
    if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers:cors});return;}
    const headers=await request.allHeaders();
    const response=await github.fetch(request.url(),{method:request.method(),headers:{Authorization:headers.authorization},body:request.postData()});
    await route.fulfill({status:response.status,headers:cors,body:await response.text()});
  });
}
async function newPublishingDraft(page){
  await page.evaluate(async()=>{
    await GRAStudio.ready;const jay=await get('Jay');
    await save('publish-fixture',{...jay.card,name:'发布测试角色'});await render();
  });
  await page.locator('#libraryToggle').click();
  await page.locator('[data-publish-character="publish-fixture"]').click();
  await page.locator('#githubPublishDialog').waitFor();
}
test('one-click publishing uses session-only credentials and records a successful commit',async t=>{
  const {page}=await studio(t),github=new FakeGitHub();await routeGitHub(page,github);await newPublishingDraft(page);
  const authorize=await page.locator('[data-authorize]').getAttribute('href');assert.match(authorize,/^https:\/\/github\.com\/settings\/personal-access-tokens\/new\?/);
  await page.locator('#githubToken').fill(TOKEN);await page.locator('[data-connect-submit]').click();
  await page.locator('[data-result]').waitFor();assert.equal(github.library().characters[0].name,'发布测试角色');
  assert.equal(await page.locator('#githubToken').inputValue(),'');
  assert.equal(await page.evaluate(async token=>{
    const local=await get('publish-fixture');
    return !JSON.stringify(local).includes(token)&&Object.values(localStorage).every(value=>!value.includes(token))&&Object.values(sessionStorage).every(value=>!value.includes(token))&&local.dirty===false&&/^[a-f0-9]{40}$/.test(local.sourceSHA);
  },TOKEN),true);
  assert.match(await page.locator('[data-result]').getAttribute('href'),/^https:\/\/github\.com\/x6nightfox6x-a11y\/genesis-rhapsody-arena\/commit\/[a-f0-9]{40}$/);
  await page.locator('[data-close]').click();await page.reload();await page.locator('#githubConnect').waitFor();
  assert.match(await page.locator('#githubConnect').innerText(),/未连接/);
});
test('failed GitHub publication preserves local draft and never displays success',async t=>{
  const {page}=await studio(t),github=new FakeGitHub();github.failPatch=403;await routeGitHub(page,github);await newPublishingDraft(page);
  await page.locator('#githubToken').fill(TOKEN);await page.locator('[data-connect-submit]').click();
  await page.locator('[data-message]').filter({hasText:'拒绝写入'}).waitFor();
  assert.equal(await page.locator('[data-result]').isVisible(),false);assert.equal(github.library().characters.length,0);
  assert.equal(await page.evaluate(async()=>{const draft=await get('publish-fixture');return draft.card.name==='发布测试角色'&&draft.dirty===true;}),true);
});
test('published library discovers new files without changing the Studio code',async t=>{
  const library=JSON.parse(await readFile(path.join(root,'角色卡/library.json'),'utf8'));
  const card=JSON.parse(await readFile(path.join(root,'角色卡/Jay.downbeat.json'),'utf8'));card.name='自动发现角色';
  library.characters.push({id:'discovered',name:card.name,file:'dynamic.downbeat.json',sha:'a'.repeat(40)});
  const {page}=await studio(t,async page=>{
    await page.route('**/library.json',route=>route.fulfill({json:library}));
    await page.route('**/dynamic.downbeat.json',route=>route.fulfill({json:card}));
  });
  await page.evaluate(()=>GRAStudio.ready);
  assert.equal(await page.evaluate(async()=>(await get('discovered')).card.name),'自动发现角色');
});
test('standalone character editor can publish without opening the Arena backend',async t=>{
  const {page}=await studio(t),github=new FakeGitHub();await routeGitHub(page,github);
  await page.goto(preview.url+'/Downbeat_ID_Card_Studio.html');await page.locator('#publishGitHub').waitFor();
  await page.waitForFunction(()=>typeof window.normalized==='function'&&typeof window.warmSprites==='function');
  await page.locator('#publishGitHub').click();await page.locator('#githubToken').fill(TOKEN);await page.locator('[data-connect-submit]').click();
  await page.locator('[data-result]').waitFor();assert.equal(github.library().characters.length,1);
  assert.equal(await page.locator('#githubToken').inputValue(),'');
});
test('creating a character after editing Jay publishes a new ID without overwriting Jay',async t=>{
  const {page}=await studio(t),github=new FakeGitHub();await routeGitHub(page,github);
  await page.evaluate(async()=>{await GRAStudio.ready;await editCard('Jay');});
  const editor=page.frames().find(frame=>frame.url().endsWith('/Downbeat_ID_Card_Studio.html'));
  await editor.locator('#idAdd').click();await editor.locator('#idNew').click();
  await editor.locator('#name').fill('全新发布角色');await editor.locator('#name').press('Tab');
  await page.locator('#publishGitHub').click();await page.locator('#githubToken').fill(TOKEN);await page.locator('[data-connect-submit]').click();await page.locator('[data-result]').waitFor();
  const published=github.library().characters[0];assert.notEqual(published.id,'Jay');assert.equal(published.name,'全新发布角色');
  assert.equal(await page.evaluate(async()=>(await get('Jay')).card.name),'Jay');
  await page.locator('[data-close]').click();await editor.locator('#name').fill('改名后的发布角色');await editor.locator('#name').press('Tab');
  await page.locator('#publishGitHub').click();await page.locator('[data-result]').waitFor();
  assert.equal(github.library().characters.length,1);assert.equal(github.library().characters[0].id,published.id);assert.equal(github.library().characters[0].name,'改名后的发布角色');
});
for (const mode of ['melee', 'ranged']) test(`Jay ${mode} aims and damages an enemy`, async t => {
  const { page, frame } = await studio(t);
  await frame.evaluate(async mode => {
    const card = await ArenaRuntime.prepare(await (await fetch('角色卡/Jay.downbeat.json')).json());
    DBDeployment.insertID(card);
    const units = DBDeployment.inspect().units, ally = units.find(u => u.def.team === 'ally'), enemy = units.find(u => u.def.team === 'enemy');
    enemy.pos = { x: ally.pos.x, y: ally.pos.y - (mode === 'melee' ? 1.3 : 3) };
    DBDeployment.replace(units);
  }, mode);
  await page.locator('#testGame').click();
  const ally = await screenPoint(frame, 'ally'); await page.mouse.click(ally.x, ally.y);
  await frame.locator('.hud-bar [data-mode="attack"]').click();
  assert.equal(await frame.evaluate(() => DBDeployment.canvas.style.cursor), 'crosshair', 'aim cursor activates without waiting for pointer preview');
  await frame.locator('.arena-moves button').filter({ hasText: mode === 'melee' ? '近战攻击' : '远程攻击' }).click();
  const target = await screenPoint(frame, 'enemy'); await page.mouse.move(target.x, target.y);
  assert.ok(['none', 'crosshair'].includes(await frame.evaluate(() => DBDeployment.canvas.style.cursor)), 'attack aiming must activate');
  const hp = await frame.evaluate(() => DBDeployment.inspect().units.find(u => u.def.team === 'enemy').hp);
  await page.mouse.click(target.x, target.y);
  await frame.waitForFunction(hp => DBDeployment.inspect().units.find(u => u.def.team === 'enemy').hp < hp, hp);
});

test('editing only map JSON changes shared game geometry and survives restart', async t => {
  const data = JSON.parse(await readFile(path.join(root, 'campaigns/arena-001/map.json'), 'utf8'));
  data.arena.width = 19; data.arena.height = 38; data.arena.obstacles.push({ id: 'test-pillar', x: 1, y: 25, w: 0.5, h: 0.5 });
  const { page, frame } = await studio(t, async page => {
    await page.route('**/campaigns/arena-001/map.json', route => route.fulfill({ json: data }));
  });
  const arena = await frame.evaluate(() => DBDeployment.inspect().arena);
  assert.deepEqual(arena, data.arena);
  const collision = await frame.evaluate(() => {
    const units = DBDeployment.inspect().units; units[0].pos = { x: 1.25, y: 25.25 };
    try { DBDeployment.replace(units); return null; } catch (error) { return error.message; }
  });
  assert.match(collision, /墙壁|障碍物/, 'new JSON obstacle must affect the same collision world');
  await page.locator('#testGame').click();
  assert.deepEqual(await frame.evaluate(() => DBDeployment.inspect().arena), arena);
  await frame.locator('.db-select-trigger').click(); await frame.locator('#arenaRestartPanel [data-restart]').click();
  assert.deepEqual(await frame.evaluate(() => DBDeployment.inspect().arena), arena);
});

test('campaign selection loads the selected descriptor and isolates its map', async t => {
  const manifest = JSON.parse(await readFile(path.join(root, 'campaigns/manifest.json'), 'utf8'));
  manifest.campaigns.push({ id: 'test-campaign', title: 'Test map', engine: 'Arena game.html', data: 'campaigns/test/campaign.json' });
  const data = JSON.parse(await readFile(path.join(root, 'campaigns/arena-001/map.json'), 'utf8'));
  data.id = 'test-map'; data.name = 'Test map'; data.arena.artMap = 'test-map'; data.arena.width = 19;
  data.initialCampaign.map = 'test-map'; data.background = '../arena-001/background.png';
  const { page } = await studio(t, async page => {
    await page.route('**/campaigns/manifest.json', route => route.fulfill({ json: manifest }));
    await page.route('**/campaigns/test/campaign.json', route => route.fulfill({ json: { format: 'gra-campaign', version: 1, id: 'test-campaign', map: 'map.json', engine: '../../Arena game.html' } }));
    await page.route('**/campaigns/test/map.json', route => route.fulfill({ json: data }));
  });
  await page.locator('#campaignSelect').selectOption('test-campaign');
  await page.waitForFunction(() => { const w = document.getElementById('arena').contentWindow; return w.ArenaCampaignLoaded && w.ArenaMap.data.id === 'test-map' && w.DBDeployment.active; });
  const selected = page.frames().find(frame => frame.url().includes('campaign=test-campaign'));
  assert.equal(await selected.evaluate(() => DBDeployment.inspect().arena.width), 19);
  await page.locator('#campaignSelect').selectOption('arena-001');
  await page.waitForFunction(() => { const w = document.getElementById('arena').contentWindow; return w.ArenaCampaignLoaded && w.ArenaMap.data.id === 'arena-cathedral'; });
});

test('existing cathedral saved formations survive map extraction', async t => {
  const map = JSON.parse(await readFile(path.join(root, 'campaigns/arena-001/map.json'), 'utf8'));
  const saved = map.initialCampaign; saved.units[0].name = 'Existing saved ally'; saved.units[0].x += 0.2;
  const { frame } = await studio(t, async page => {
    await page.addInitScript(saved => {
      if (/Arena(?:%20| )game\.html/.test(location.pathname)) localStorage.setItem('arena-cathedral-blank-v2:' + encodeURIComponent(location.pathname), JSON.stringify(saved));
    }, saved);
  });
  const ally = await frame.evaluate(() => DBDeployment.inspect().units.find(unit => unit.def.team === 'ally'));
  assert.equal(ally.def.name, 'Existing saved ally'); assert.equal(ally.pos.x, saved.units[0].x);
});

test('full HTML export keeps map and artwork with network disabled', async t => {
  const { page } = await studio(t);
  await page.goto(preview.url + '/Arena%20game.html');
  await page.waitForFunction(() => window.ArenaCampaignLoaded);
  await page.locator('#deployOpen').click();
  const original = await page.evaluate(() => DBDeployment.inspect());
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#depExportGame').click();
  const download = await downloadPromise;
  const file = path.join(root, 'test-results', 'standalone-arena.html');
  await mkdir(path.dirname(file), { recursive: true }); await download.saveAs(file);
  const offline = await page.context().newPage(), requests = [];
  offline.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  await offline.context().setOffline(true);
  await offline.goto(pathToFileURL(file).href);
  await offline.waitForFunction(() => window.ArenaCampaignLoaded);
  assert.deepEqual(await offline.evaluate(() => DBDeployment.inspect()), original);
  assert.ok(await offline.evaluate(() => ArenaMap.data.background.startsWith('data:image/png;base64,')));
  assert.equal(await offline.locator('#arena-map-runtime').getAttribute('src'), null);
  assert.deepEqual(requests, [], 'standalone export must not fetch map, schema or artwork');
  const again = offline.waitForEvent('download'); await offline.locator('#deployOpen').click(); await offline.locator('#depExportGame').click(); await again;
  await offline.close();
});

test('missing or invalid map shows a clear error without starting another map', async t => {
  const context = await browser.newContext(), page = await context.newPage(); t.after(() => context.close());
  await page.route('**/campaigns/arena-001/map.json', route => route.fulfill({ status: 404, body: 'missing' }));
  await page.goto(preview.url + '/Arena%20game.html');
  await page.locator('#arena-map-error').waitFor();
  assert.equal(await page.locator('canvas.graveyard-game-canvas').count(), 0);
  assert.match(await page.locator('#arena-map-error').innerText(), /404/);
});
for (const failure of ['invalid-map', 'missing-background']) test(`map startup stops for ${failure}`, async t => {
  const context = await browser.newContext(), page = await context.newPage(); t.after(() => context.close());
  if (failure === 'invalid-map') await page.route('**/campaigns/arena-001/map.json', route => route.fulfill({ json: { format: 'gra-map', version: 1, id: 'bad', arena: { width: -1 } } }));
  else await page.route('**/campaigns/arena-001/background.png', route => route.fulfill({ status: 404, body: 'missing' }));
  await page.goto(preview.url + '/Arena%20game.html');
  await page.locator('#arena-map-error').waitFor();
  assert.equal(await page.locator('canvas.graveyard-game-canvas').count(), 0);
});
