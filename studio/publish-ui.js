import { GitHubPublisher } from './github-client.js';
import { REPOSITORY } from './character-library.js';
export function installPublisher({mount,getDraft,markPublished,onStatus=()=>{},editorOnly=false}) {
  const client=new GitHubPublisher();
  const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('./publish.css',import.meta.url).href;document.head.append(style);
  const actions=document.createElement('div');actions.className='github-actions';
  const connect=document.createElement('button');connect.id='githubConnect';connect.type='button';connect.textContent='GitHub · 未连接';
  const publish=document.createElement('button');publish.id='publishGitHub';publish.type='button';publish.textContent='↑ 发布到 GitHub';publish.className=editorOnly?'github-editor-only':'';
  actions.append(connect,publish);mount.append(actions);
  const dialog=document.createElement('dialog');dialog.id='githubPublishDialog';
  dialog.innerHTML=`<h2>发布角色到 GitHub</h2>
    <p class="github-target">目标：<strong>${REPOSITORY.owner}/${REPOSITORY.name}</strong></p>
    <section data-auth>
      <p>首次连接：在 GitHub 创建访问令牌，然后粘贴到这里。连接只在本页有效，刷新后需重新连接。</p>
      <ol><li><a data-authorize target="_blank" rel="noopener noreferrer">打开 GitHub 授权设置 ↗</a></li><li>选择 <b>Only select repositories</b>，仅勾选 <b>${REPOSITORY.name}</b>。Contents 读写权限已预填。</li><li>点击 Generate token，复制生成的令牌到下方。</li></ol>
      <form data-token-form><label for="githubToken">GitHub 访问令牌</label><input id="githubToken" type="password" autocomplete="off" spellcheck="false" required placeholder="只填在这里，不要发到聊天或角色卡中"><button type="submit" data-connect-submit>连接 GitHub</button></form>
      <p class="github-note">只通过 GitHub 官方 API 发送令牌；不写入浏览器存档、角色文件或仓库。你也可以随时在 GitHub 撤销授权。</p>
    </section>
    <p data-message role="status" aria-live="polite"></p>
    <p><a data-result target="_blank" rel="noopener noreferrer" hidden>查看 GitHub 提交 ↗</a></p>
    <button data-overwrite type="button" hidden>确认用本地角色覆盖云端版本</button>
    <footer><button data-disconnect type="button">断开连接</button><button data-close type="button">关闭</button></footer>`;
  const auth=dialog.querySelector('[data-auth]'),message=dialog.querySelector('[data-message]'),result=dialog.querySelector('[data-result]'),overwrite=dialog.querySelector('[data-overwrite]'),token=dialog.querySelector('#githubToken'),close=dialog.querySelector('[data-close]'),disconnect=dialog.querySelector('[data-disconnect]'),submit=dialog.querySelector('[data-connect-submit]');
  const url=new URL('https://github.com/settings/personal-access-tokens/new');
  url.search=new URLSearchParams({name:'GRA Studio characters',description:'Publish GRA character files and library index',target_name:REPOSITORY.owner,expires_in:'30',contents:'write'}).toString();dialog.querySelector('[data-authorize]').href=url.href;
  document.body.append(dialog);
  let busy=false,draft=null,remoteSHA=null;
  function text(value){message.textContent=value;onStatus(value);}
  function refresh(){connect.textContent=client.connected?'GitHub · 已连接':'GitHub · 未连接';disconnect.hidden=!client.connected;}
  function show(){if(!dialog.open)dialog.showModal();result.hidden=true;overwrite.hidden=true;auth.hidden=client.connected;refresh();}
  function setBusy(value){busy=value;publish.disabled=value;connect.disabled=value;close.disabled=value;disconnect.disabled=value;submit.disabled=value;overwrite.disabled=value;document.querySelectorAll('[data-publish-character]').forEach(button=>button.disabled=value);}
  function hide(){if(busy)return;token.value='';draft=null;remoteSHA=null;dialog.close();}
  async function perform(){
    if(!draft||busy)return;setBusy(true);auth.hidden=true;overwrite.hidden=true;
    try {
      const published=await client.publish({...draft,...(remoteSHA?{sourceSHA:remoteSHA}:{})},text);
      try{await markPublished(published,draft);}catch{onStatus('角色已发布，但本地记录更新失败；请保留本地 JSON 备份。');}
      result.href=published.url;result.hidden=false;draft=null;remoteSHA=null;
      text(published.unchanged?'GitHub 上已经是这个版本，无需重复提交。':'✓ 已发布到 GitHub。网站自动检查和部署完成后，其他设备也能在角色库看到。');
    }catch(error){
      text(error.message||'发布失败，本地草稿仍然保留。');
      if(error.code==='REMOTE_CHANGED'){remoteSHA=error.remoteSHA;overwrite.hidden=false;}
      if(!client.connected)auth.hidden=false;
    }finally{setBusy(false);refresh();}
  }
  async function begin(id){
    if(busy)return;setBusy(true);
    try{draft=await getDraft(id);if(!draft)throw Error('请先载入并保存一个角色。');remoteSHA=null;show();text('准备发布：'+draft.card.name);}
    catch(error){show();text(error.message||'无法保存角色草稿。');draft=null;}
    finally{setBusy(false);}
    if(draft&&client.connected)await perform();
  }
  connect.onclick=()=>{if(busy)return;draft=null;remoteSHA=null;show();text(client.connected?'GitHub 已连接，可以直接发布角色。':'请完成 GitHub 授权后连接。');};
  publish.onclick=()=>begin();
  document.addEventListener('click',event=>{const button=event.target.closest?.('[data-publish-character]');if(button)begin(button.dataset.publishCharacter);});
  dialog.querySelector('[data-token-form]').onsubmit=async event=>{
    event.preventDefault();if(busy)return;setBusy(true);const value=token.value;token.value='';
    try{await client.connect(value);auth.hidden=true;text('GitHub 已连接。');}
    catch(error){text(error.message||'连接失败，请重试。');}
    finally{setBusy(false);refresh();}
    if(draft&&client.connected)await perform();
  };
  overwrite.onclick=()=>perform();close.onclick=hide;
  disconnect.onclick=()=>{if(busy)return;client.disconnect();token.value='';auth.hidden=false;refresh();text('已断开 GitHub，本地角色仍然保留。');};
  dialog.addEventListener('cancel',event=>{event.preventDefault();hide();});
  refresh();
}
