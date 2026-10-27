import { readFile } from 'node:fs/promises';
import { sitePath } from './site.mjs';
const args = process.argv.slice(2);
const file = args.includes('--studio') ? 'studio.html' : args.includes('--id') ? 'Downbeat_ID_Card_Studio.html' : 'Arena game.html';
const text = await readFile(sitePath(file), 'utf8');
const lines = text.split('\n');
const modules = [...text.matchAll(/^"(src\/[^"\n]+)": function\(require,module,exports\)\{/gm)].map(match => ({ name: match[1], line: text.slice(0, match.index).split('\n').length }));
const value = flag => args[args.indexOf(flag) + 1];
const print = (line, index) => console.log(`${index + 1}: ${line.length > 400 ? line.slice(0, 180) + ` … [${line.length} chars; embedded asset/long line]` : line}`);
if (args.includes('--find')) {
  const needle = value('--find'); if (!needle) throw Error('--find needs text');
  let matches = 0;
  for (let i = 0; i < lines.length; i++) if (lines[i].includes(needle)) { print(lines[i], i); if (++matches === 40) { console.log('Limit: 40 matches. Use a more specific search.'); break; } }
} else if (args.includes('--module')) {
  const name = value('--module'), matches = modules.filter(module => module.name.includes(name));
  if (matches.length !== 1) throw Error('Choose exactly one module from the list: ' + matches.map(m => m.name).join(', '));
  const module = matches[0], next = modules[modules.indexOf(module) + 1];
  for (let i = module.line - 1; i < (next?.line || lines.length + 1) - 1; i++) print(lines[i], i);
} else {
  console.log(`${file}: ${lines.length} lines. Canonical file; these module names are embedded labels, not separate .ts files.`);
  for (const module of modules) console.log(`${module.line}: ${module.name}`);
  console.log('\nUsage: npm run inspect -- --module inputRouter\n       npm run inspect -- --find "DBDeployment"\n       npm run inspect -- --studio --find "campaign"');
}
