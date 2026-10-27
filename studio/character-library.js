export const REPOSITORY = Object.freeze({ owner: 'x6nightfox6x-a11y', name: 'genesis-rhapsody-arena' });
export const LIBRARY_PATH = '角色卡/library.json';
export const validFile = value => typeof value === 'string' && /^[^/\\\0%]{1,100}\.downbeat\.json$/.test(value) && !value.startsWith('.');
export function validateLibrary(value) {
  if (value?.format !== 'gra-character-library' || value.version !== 1 || !Array.isArray(value.characters) || value.characters.length > 1000) throw Error('GitHub 角色清单格式无效');
  const ids=new Set(),files=new Set();
  for (const entry of value.characters) {
    if (!entry || typeof entry.id!=='string'||!entry.id||entry.id.length>100||typeof entry.name!=='string'||!entry.name||entry.name.length>60||!validFile(entry.file)||!/^[a-f0-9]{40}$/.test(entry.sha)||ids.has(entry.id)||files.has(entry.file)) throw Error('GitHub 角色清单包含无效或重复项目');
    ids.add(entry.id);files.add(entry.file);
  }
  return value;
}
export function validateCard(card) {
  if (card?.format!=='downbeat-character'||card.version!==1||typeof card.name!=='string'||!card.name.trim()||card.name.length>60||typeof card.sheet!=='string'||!card.sheet.startsWith('data:image/png;base64,')) throw Error('角色卡格式、名称或图片无效');
  const actions=new Set((card.actions||[]).map(action=>action.id));
  for(const move of card.moves||[])if(!actions.has(move.actionId))throw Error('角色招式缺少对应动作');
  const content=JSON.stringify(card,null,2)+'\n';
  if(new TextEncoder().encode(content).length>20_000_000)throw Error('角色卡超过 20 MB，请先缩小图片或减少重复素材');
  return content;
}
export async function loadPublishedLibrary() {
  const response=await fetch(new URL('../'+LIBRARY_PATH,import.meta.url),{cache:'no-cache'});
  if(!response.ok)throw Error('角色清单读取失败（'+response.status+'）');
  return validateLibrary(await response.json());
}
