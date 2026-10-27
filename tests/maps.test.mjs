import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { sitePath } from '../tools/site.mjs';
const scope = {};
new vm.Script(await readFile(sitePath('campaigns/map-schema.js'), 'utf8')).runInNewContext(scope);
const source = JSON.parse(await readFile(sitePath('campaigns/arena-001/map.json'), 'utf8'));
test('shared map schema accepts the original geometry and default formation', () => {
  assert.equal(scope.ArenaMapSchema.validate(source), source);
  assert.equal(source.arena.obstacles.length, 19); assert.equal(source.initialCampaign.units.length, 10);
});
test('map schema rejects broken geometry and spawn data before boot', () => {
  const cases = [
    map => { map.arena.width = -1; },
    map => { map.arena.obstacles[0].w = 999; },
    map => { map.initialCampaign.units[0].x = 0; },
    map => { map.initialCampaign.units[0].x = 8; map.initialCampaign.units[0].y = 1; },
    map => { map.initialCampaign.units[1].id = map.initialCampaign.units[0].id; },
    map => { map.initialCampaign.map = 'different-map'; }
  ];
  for (const mutate of cases) { const map = structuredClone(source); mutate(map); assert.throws(() => scope.ArenaMapSchema.validate(map)); }
});
