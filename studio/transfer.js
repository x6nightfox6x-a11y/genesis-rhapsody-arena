import { validateCard } from './character-library.js';

const fixedKeys = new Set(['gra-selected-campaign','arena-language','downbeat-walk-studio-v2-no-leon','walkstudio-figure-reference-v1']);
export const transferableKey = key => fixedKeys.has(key) || /^[a-z0-9_-]+-blank-v2:/.test(key);
export function validateBackup(value) {
  if(value?.format!=='gra-studio-backup'||value.version!==1||!Array.isArray(value.cards)||value.cards.length>1000||!Array.isArray(value.storage))throw Error('不是 GRA Studio 迁移备份');
  const ids=new Set();
  for(const entry of value.cards){
    if(typeof entry?.id!=='string'||!entry.id||entry.id.length>100||ids.has(entry.id))throw Error('备份角色编号无效或重复');
    ids.add(entry.id);validateCard(entry.card);
  }
  const keys=new Set();
  for(const entry of value.storage){
    if(!Array.isArray(entry)||entry.length!==2||!transferableKey(entry[0])||typeof entry[1]!=='string'||keys.has(entry[0]))throw Error('备份包含不支持的设置');
    keys.add(entry[0]);
  }
  return value;
}
export async function database(){
  return new Promise((resolve,reject)=>{const q=indexedDB.open('gra-unified-studio',1);q.onupgradeneeded=()=>q.result.createObjectStore('cards',{keyPath:'id'});q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
}
export async function readCards(db){
  return new Promise((resolve,reject)=>{const q=db.transaction('cards','readonly').objectStore('cards').getAll();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
}
export async function restoreBackup(value){
  validateBackup(value);
  const db=await database(),previous=value.storage.map(([key])=>[key,localStorage.getItem(key)]);
  try{
    for(const [key,data] of value.storage)localStorage.setItem(key,data);
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('cards','readwrite'),store=tx.objectStore('cards');
      for(const record of value.cards)store.put({id:record.id,card:record.card,updated:record.updated||Date.now(),dirty:record.dirty!==false,...(record.sourceSHA?{sourceSHA:record.sourceSHA}:{}),...(record.remoteFile?{remoteFile:record.remoteFile}:{})});
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('恢复未完成'));
    });
  }catch(error){for(const [key,data] of previous){if(data===null)localStorage.removeItem(key);else localStorage.setItem(key,data);}throw error;}
  finally{db.close();}
}
export async function makeBackup(){
  await window.GRAStudio.ready;
  if(document.body.classList.contains('editor-mode'))await window.GRAStudio.getDraft();
  const db=await database();let cards;
  try{cards=await readCards(db);}finally{db.close();}
  const storage=Object.keys(localStorage).filter(transferableKey).map(key=>[key,localStorage.getItem(key)]);
  const arena=document.getElementById('arena').contentWindow,api=arena.DBDeployment;
  if(api&&arena.ArenaCampaignLoaded){
    const map=arena.ArenaMap.data;
    const campaign={format:'downbeat-map-campaign',version:1,name:'迁移时的地图布阵',map:map.id,cards:[],units:api.inspect().units.map(u=>({id:u.id,type:u.def.id,team:u.def.team,name:u.def.name,identity:u.identity||null,skinId:null,x:u.pos.x,y:u.pos.y}))};
    const key=map.id+'-blank-v2:'+encodeURIComponent(arena.location.pathname)+(map.campaignId==='arena-001'?'':':'+map.campaignId);
    const index=storage.findIndex(([name])=>name===key);if(index>=0)storage.splice(index,1);
    storage.push([key,JSON.stringify(campaign)]);
  }
  // Whitelist prevents GitHub credentials or unrelated browser state entering a backup.
  return validateBackup({format:'gra-studio-backup',version:1,createdAt:new Date().toISOString(),cards,storage});
}
if(typeof document!=='undefined'){
  const header=document.querySelector('body > header');
  const exporting=document.createElement('button');exporting.id='exportStudioBackup';exporting.textContent='↓ 迁移备份';exporting.title='打包角色草稿、编辑器自动存档及当前地图布阵；战斗中的 HP/AP 不保留';
  const importing=document.createElement('button');importing.id='importStudioBackup';importing.textContent='↑ 恢复备份';importing.title='选择备份文件；恢复同编号角色和地图设置，其它角色保留';
  const input=document.createElement('input');input.type='file';input.accept='.json';input.hidden=true;input.id='studioBackupFile';document.body.append(input);
  header.append(exporting,importing);
  const message=text=>{document.getElementById('status').textContent=text;};
  exporting.onclick=async()=>{
    exporting.disabled=true;
    try{
      const backup=await makeBackup(),url=URL.createObjectURL(new Blob([JSON.stringify(backup)],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download='GRA-Studio-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
      message('备份已导出：请将 JSON 和 Studio 文件夹一起带走');
    }catch(error){message('备份失败：'+error.message);}finally{exporting.disabled=false;}
  };
  importing.onclick=()=>input.click();
  input.onchange=async()=>{
    const file=input.files[0];if(!file)return;importing.disabled=true;
    try{
      if(file.size>150_000_000)throw Error('备份超过 150 MB');
      await window.GRAStudio.ready;await restoreBackup(JSON.parse(await file.text()));
      message('恢复完成，正在重新载入 Studio…');location.reload();
    }catch(error){message('恢复失败：'+error.message);}finally{input.value='';importing.disabled=false;}
  };
}
