import { mkdir, cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { root, pages, folders } from './site.mjs';
import { checkSite } from './check.mjs';
await checkSite();
const output = path.join(root, '_site');
if (path.dirname(output) !== path.resolve(root) || path.basename(output) !== '_site') throw Error('Invalid generated output path');
// A fixed generated directory only, never a caller-supplied deletion path.
await rm(output, { recursive: true, force: true });
await mkdir(output);
for (const item of [...pages, ...folders]) await cp(path.join(root, item), path.join(output, item), { recursive: true });
console.log('Built _site/ (game pages and resources only).');
