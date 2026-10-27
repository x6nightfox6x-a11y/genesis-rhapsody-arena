import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { root, pages, folders, sitePath } from './site.mjs';
import { validateLibrary } from '../studio/character-library.js';
export async function checkSite() {
  let scripts = 0, jsons = 0;
  const schemaScope = {};
  new vm.Script(await readFile(sitePath('campaigns/map-schema.js'), 'utf8'), { filename: 'campaigns/map-schema.js' }).runInNewContext(schemaScope);
  for (const file of pages) {
    const html = await readFile(sitePath(file), 'utf8');
    if (!html.trim()) throw Error(`Empty page: ${file}`);
    let index = 0;
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      index++;
      const source = match[1].match(/\bsrc\s*=\s*['"]([^'"]+)['"]/);
      if (source) {
        if (/type\s*=\s*['"]module['"]/.test(match[1])) execFileSync(process.execPath,['--check',sitePath(source[1])],{stdio:'pipe'});
        else new vm.Script(await readFile(sitePath(source[1]), 'utf8'), { filename: source[1] });
        scripts++;continue;
      }
      if (/application\/json/.test(match[1])) { JSON.parse(match[2]); continue; }
      new vm.Script(match[2], { filename: `${file}:script-${index}`, lineOffset: html.slice(0, match.index).split('\n').length - 1 });
      scripts++;
    }
    for (const match of html.matchAll(/\b(?:src|href)\s*=\s*['"]([^'"]+)['"]/gi)) {
      const link = match[1];
      if (/^(?:[a-z][\w+.-]*:|#|\/\/)/i.test(link)) continue;
      const name = decodeURIComponent(link.split(/[?#]/)[0]);
      if (name && !(await stat(sitePath(name))).isFile()) throw Error(`Broken link in ${file}: ${link}`);
    }
  }
  const documents = new Map();
  async function scan(folder) {
    for (const entry of await readdir(sitePath(folder), { withFileTypes: true })) {
      const name = folder + '/' + entry.name;
      if (entry.isDirectory()) await scan(name);
      else if (entry.name.endsWith('.json')) { documents.set(name, JSON.parse(await readFile(sitePath(name), 'utf8'))); jsons++; }
      else if(name.startsWith('studio/')&&entry.name.endsWith('.js'))execFileSync(process.execPath,['--check',sitePath(name)],{stdio:'pipe'});
    }
  }
  for (const folder of folders) await scan(folder);
  const manifest = documents.get('campaigns/manifest.json');
  if (manifest?.version !== 1 || !Array.isArray(manifest.campaigns) || !manifest.campaigns.length) throw Error('Invalid campaign manifest');
  const ids = new Set();
  for (const campaign of manifest.campaigns) {
    if (!campaign.id || ids.has(campaign.id) || typeof campaign.title !== 'string') throw Error('Missing/duplicate campaign ID or title');
    ids.add(campaign.id);
    if (!(await stat(sitePath(campaign.engine))).isFile()) throw Error(`Missing engine: ${campaign.engine}`);
    const data = documents.get(campaign.data);
    if (data?.format !== 'gra-campaign' || data.version !== 1 || data.id !== campaign.id) throw Error(`Invalid descriptor: ${campaign.data}`);
    const descriptorEngine = path.resolve(path.dirname(sitePath(campaign.data)), data.engine);
    if (descriptorEngine !== sitePath(campaign.engine)) throw Error(`Campaign engines disagree: ${campaign.id}`);
    if (typeof data.map !== 'string') throw Error(`Missing independent map path: ${campaign.id}`);
    const mapPath = path.relative(root, path.resolve(path.dirname(sitePath(campaign.data)), data.map)).split(path.sep).join('/');
    sitePath(mapPath);
    const map = documents.get(mapPath);
    schemaScope.ArenaMapSchema.validate(map);
    if (map.background !== null) {
      const background = path.relative(root, path.resolve(path.dirname(sitePath(mapPath)), map.background));
      if (!(await stat(sitePath(background.split(path.sep).join('/')))).isFile()) throw Error(`Missing map background: ${background}`);
    }
  }
  if (!ids.has(manifest.defaultCampaign)) throw Error('Default campaign does not exist');
  const library=validateLibrary(documents.get('角色卡/library.json'));
  const indexedFiles=new Set(library.characters.map(entry=>entry.file));
  for(const entry of library.characters)if(!documents.has('角色卡/'+entry.file))throw Error('Missing published character: '+entry.file);
  for (const [name, card] of documents) if (name.startsWith('角色卡/')&&name.endsWith('.downbeat.json')) {
    if(!indexedFiles.has(name.slice('角色卡/'.length)))throw Error('Character missing from library index: '+name);
    if (card.format !== 'downbeat-character' || card.version !== 1 || !card.name) throw Error(`Invalid character: ${name}`);
    const actions = new Set((card.actions || []).map(action => action.id));
    for (const move of card.moves || []) if (!actions.has(move.actionId)) throw Error(`Missing action ${move.actionId}: ${name}`);
  }
  console.log(`PASS: ${pages.length} pages, ${scripts} scripts, ${jsons} JSON files, links and all campaigns.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.join(root, 'tools', 'check.mjs')) checkSite().catch(error => { console.error(error.message); process.exitCode = 1; });
