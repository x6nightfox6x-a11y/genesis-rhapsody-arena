import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { root } from '../tools/site.mjs';
import { startServer } from '../tools/serve.mjs';
test('packaged preview serves resources but excludes repository files', async t => {
  const { server, url } = await startServer({ port: 0, directory: path.join(root, '_site') });
  t.after(() => new Promise(resolve => server.close(resolve)));
  for (const name of ['studio.html', 'Arena%20game.html', 'campaigns/manifest.json', encodeURI('角色卡/Jay.downbeat.json')]) assert.equal((await fetch(url + '/' + name)).status, 200, name);
  for (const name of ['.git/config', 'package.json', 'tools/check.mjs', 'campaigns/%2e%2e%2f%2e%2e%2fAGENTS.md']) assert.equal((await fetch(url + '/' + name)).status, 404, name);
});
