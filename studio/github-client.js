import { REPOSITORY, LIBRARY_PATH, validateLibrary, validateCard } from './character-library.js';
const apiRoot=`https://api.github.com/repos/${REPOSITORY.owner}/${REPOSITORY.name}`;
const encodePath=value=>value.split('/').map(encodeURIComponent).join('/');
const validSHA=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const decode=value=>new TextDecoder().decode(Uint8Array.from(atob(value.replace(/\s/g,'')),c=>c.charCodeAt(0)));
async function hash(content,algorithm='SHA-1') {return [...new Uint8Array(await crypto.subtle.digest(algorithm,new TextEncoder().encode(content)))].map(value=>value.toString(16).padStart(2,'0')).join('');}
export class PublishError extends Error {
  constructor(message,code,status=0,remoteSHA=null){super(message);this.code=code;this.status=status;this.remoteSHA=remoteSHA;}
}
export class GitHubPublisher {
  #token=''; #fetch; #branch=null; #busy=false;
  constructor(fetcher=(...args)=>fetch(...args)){this.#fetch=fetcher;}
  get connected(){return !!this.#token&&!!this.#branch;}
  disconnect(){this.#token='';this.#branch=null;}
  async #request(path,method='GET',body,allowMissing=false) {
    let response;
    try {response=await this.#fetch(apiRoot+path,{method,redirect:'error',cache:'no-store',headers:{Accept:path.startsWith('/contents/')?'application/vnd.github.object+json':'application/vnd.github+json',Authorization:'Bearer '+this.#token,'Content-Type':'application/json','X-GitHub-Api-Version':'2026-03-10'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});}
    catch{throw new PublishError('网络连接失败或超时。草稿已保留，可以重试。','NETWORK');}
    if(allowMissing&&response.status===404)return null;
    if(!response.ok){
      const messages={401:'GitHub 连接已失效，请重新连接。',403:'GitHub 拒绝写入，请检查该仓库的 Contents 读写授权或 API 限额。',404:'找不到仓库、分支或文件，请检查授权仓库。',409:'GitHub 内容正在变化，请稍后重试。',422:'GitHub 拒绝提交，可能是分支保护或并发更新。'};
      if(response.status===401)this.disconnect();
      throw new PublishError(messages[response.status]||'GitHub 暂时无法完成发布（'+response.status+'）。','HTTP',response.status);
    }
    return response.json();
  }
  async connect(token) {
    this.disconnect();
    if(!globalThis.crypto?.subtle)throw new PublishError('请通过 HTTPS 网站或本机预览页面连接 GitHub。','SECURE_CONTEXT');
    if(typeof token!=='string'||token.trim().length<20||token.length>1000)throw new PublishError('请填入 GitHub 创建的访问令牌。','AUTH');
    this.#token=token.trim();
    try {
      const repository=await this.#request('');
      if(repository.full_name!==`${REPOSITORY.owner}/${REPOSITORY.name}`||typeof repository.default_branch!=='string'||!repository.default_branch)throw Error('仓库信息无效');
      this.#branch=repository.default_branch;
      return {repository:repository.full_name,branch:this.#branch};
    } catch(error){this.disconnect();throw error;}
  }
  async publish({id,card,sourceSHA},onProgress=()=>{}) {
    if(this.#busy)throw new PublishError('正在发布，请等待本次完成。','BUSY');
    if(!this.connected)throw new PublishError('请先连接 GitHub。','AUTH');
    if(typeof id!=='string'||!id||id.length>100)throw Error('角色编号无效');
    this.#busy=true;
    try {
      const content=validateCard(card),size=new TextEncoder().encode(content).length;
      const cardSHA=await hash('blob '+size+'\0'+content);
      const newFile='character-'+(await hash(id,'SHA-256')).slice(0,16)+'.downbeat.json';
      let blobCreated=false;
      for(let attempt=0;attempt<2;attempt++){
        onProgress('读取 GitHub 当前版本…');
        const reference=await this.#request('/git/ref/heads/'+encodeURIComponent(this.#branch));
        const parent=reference.object?.sha;if(!validSHA(parent))throw Error('GitHub 分支信息无效');
        const commit=await this.#request('/git/commits/'+parent);
        const result=await this.#request('/contents/'+encodePath(LIBRARY_PATH)+'?ref='+parent);
        const library=validateLibrary(JSON.parse(decode(result.content||'')));
        const existing=library.characters.find(entry=>entry.id===id),file=existing?.file||newFile;
        const remote=await this.#request('/contents/'+encodePath('角色卡/'+file)+'?ref='+parent,'GET',undefined,true);
        if(remote&&!validSHA(remote.sha))throw Error('GitHub 角色版本信息无效');
        if(remote&&remote.sha!==sourceSHA&&remote.sha!==cardSHA)throw new PublishError('GitHub 上的角色已有其他更新。你的本地草稿已保留，请选择是否用本地版本覆盖。','REMOTE_CHANGED',0,remote.sha);
        if(existing&&remote?.sha===cardSHA&&existing.sha===cardSHA)return {id,file,sha:cardSHA,commit:parent,url:`https://github.com/${REPOSITORY.owner}/${REPOSITORY.name}/commit/${parent}`,unchanged:true};
        if(!blobCreated){onProgress('上传角色素材与数据…');const blob=await this.#request('/git/blobs','POST',{content,encoding:'utf-8'});if(blob.sha!==cardSHA)throw Error('GitHub 角色数据校验不一致');blobCreated=true;}
        const entry={id,name:card.name,file,sha:cardSHA};
        const characters=library.characters.filter(entry=>entry.id!==id);characters.push(entry);characters.sort((a,b)=>a.id.localeCompare(b.id));
        const nextLibrary=validateLibrary({...library,characters});
        onProgress('同步角色库并提交…');
        const tree=await this.#request('/git/trees','POST',{base_tree:commit.tree.sha,tree:[{path:'角色卡/'+file,mode:'100644',type:'blob',sha:cardSHA},{path:LIBRARY_PATH,mode:'100644',type:'blob',content:JSON.stringify(nextLibrary,null,2)+'\n'}]});
        const next=await this.#request('/git/commits','POST',{message:'Publish character: '+card.name,tree:tree.sha,parents:[parent]});
        if(!validSHA(next.sha))throw Error('GitHub 提交信息无效');
        try {await this.#request('/git/refs/heads/'+encodeURIComponent(this.#branch),'PATCH',{sha:next.sha,force:false});}
        catch(error){if(attempt===0&&[409,422].includes(error.status))continue;throw error;}
        return {...entry,commit:next.sha,url:`https://github.com/${REPOSITORY.owner}/${REPOSITORY.name}/commit/${next.sha}`,unchanged:false};
      }
    }finally{this.#busy=false;}
  }
}
