import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { root } from '../tools/site.mjs';
import { startServer } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
let browser, preview;
before(async () => {
  preview = await startServer({ port: 0, directory: path.join(root, '_site') });
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
});
after(async () => { await browser?.close(); if (preview) await new Promise(resolve => preview.server.close(resolve)); });
async function studio(t) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage(), errors = [];
  const engineRequests = [];
  page.on('request', request => { if (request.resourceType() === 'document' && /Arena(?:%20| )game\.html/.test(request.url())) engineRequests.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  t.after(async () => {
    await mkdir(path.join(root, 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'test-results', t.name.replace(/[^a-z0-9]+/gi, '-') + '.png') });
    await context.close(); assert.deepEqual(errors, [], 'browser runtime errors');
  });
  await page.goto(preview.url + '/studio.html');
  await page.waitForFunction(() => { const w = document.getElementById('arena').contentWindow; return w.DBDeployment?.active && w.document.querySelector('canvas.graveyard-game-canvas'); });
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
  const geometry = await frame.evaluate(() => { const r = document.querySelector('.graveyard-camera').getBoundingClientRect(); return { x: r.x, width: r.width, height: r.height, expectedHeight: innerHeight }; });
  assert.equal(geometry.width, 1152); assert.equal(geometry.x, 144); assert.equal(geometry.height, geometry.expectedHeight);
  const before = await frame.evaluate(() => DBDeployment.inspect());
  await page.mouse.move(650, 400); await page.mouse.wheel(0, -600);
  const oldTransform = await frame.evaluate(() => DBDeployment.canvas.style.transform);
  await page.mouse.down({ button: 'middle' }); await page.mouse.move(740, 460, { steps: 8 }); await page.mouse.up({ button: 'middle' });
  assert.notEqual(await frame.evaluate(() => DBDeployment.canvas.style.transform), oldTransform);
  assert.deepEqual(await frame.evaluate(() => DBDeployment.inspect()), before, 'panning must not edit units');
  await page.locator('#testGame').click(); assert.equal(await frame.evaluate(() => DBDeployment.active), false);
  await page.locator('#endTest').click(); assert.equal(await frame.evaluate(() => DBDeployment.active), true);
  assert.deepEqual(await frame.evaluate(() => DBDeployment.inspect()), before, 'switching must preserve roster');
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
  await frame.locator('.arena-moves button').filter({ hasText: mode === 'melee' ? '近战攻击' : '远程攻击' }).click();
  const target = await screenPoint(frame, 'enemy'); await page.mouse.move(target.x, target.y);
  assert.ok(['none', 'crosshair'].includes(await frame.evaluate(() => DBDeployment.canvas.style.cursor)), 'attack aiming must activate');
  const hp = await frame.evaluate(() => DBDeployment.inspect().units.find(u => u.def.team === 'enemy').hp);
  await page.mouse.click(target.x, target.y);
  await frame.waitForFunction(hp => DBDeployment.inspect().units.find(u => u.def.team === 'enemy').hp < hp, hp);
});
