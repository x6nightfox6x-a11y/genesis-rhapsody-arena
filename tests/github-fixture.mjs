import { createHash } from 'node:crypto';
export const TOKEN='github_pat_test_only_not_a_real_credential';
export const blobSHA=text=>createHash('sha1').update('blob '+Buffer.byteLength(text)+'\0').update(text).digest('hex');
const id=value=>createHash('sha1').update(value).digest('hex');
export const card={format:'downbeat-character',version:1,name:'测试角色',sheet:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',layout:{cellWidth:1,cellHeight:1,columns:1,rows:1},fps:8,animations:{down:[{x:0,y:0,w:1,h:1,dx:0,dy:0,duration:1}],left:[{x:0,y:0,w:1,h:1,dx:0,dy:0,duration:1}],up:[{x:0,y:0,w:1,h:1,dx:0,dy:0,duration:1}],right:[{x:0,y:0,w:1,h:1,dx:0,dy:0,duration:1}]}};
export class FakeGitHub {
  requests=[];blobs=new Map();trees=new Map();commits=new Map();counter=0;head=id('initial-head');failStatus=0;failPatch=0;concurrent=false;
  constructor(files={}){
    this.tree={};for(const [path,content] of Object.entries(files))this.tree[path]=this.store(content);
    if(!this.tree['角色卡/library.json'])this.tree['角色卡/library.json']=this.store(JSON.stringify({format:'gra-character-library',version:1,characters:[]}));
    this.tree['Arena game.html']=this.store('existing engine');
    const tree=id('initial-tree');this.trees.set(tree,{...this.tree});this.commits.set(this.head,{sha:this.head,tree:{sha:tree},parents:[]});
  }
  store(content){const sha=blobSHA(content);this.blobs.set(sha,content);return sha;}
  currentFiles(){return this.trees.get(this.commits.get(this.head).tree.sha);}
  library(){return JSON.parse(this.blobs.get(this.currentFiles()['角色卡/library.json']));}
  fetch=async(url,options={})=>{
    const request=new URL(url),method=options.method||'GET',prefix='/repos/x6nightfox6x-a11y/genesis-rhapsody-arena';
    const path=decodeURIComponent(request.pathname.slice(prefix.length)),body=options.body?JSON.parse(options.body):null;
    this.requests.push({method,path,body,authorization:options.headers?.Authorization});
    const result=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
    if(!request.pathname.startsWith(prefix)||options.headers?.Authorization!=='Bearer '+TOKEN)return result({message:'unauthorized'},401);
    if(this.failStatus)return result({message:'failed'},this.failStatus);
    if(path==='')return result({full_name:'x6nightfox6x-a11y/genesis-rhapsody-arena',default_branch:'main'});
    if(path==='/git/ref/heads/main')return result({object:{sha:this.head}});
    if(path.startsWith('/git/commits/')&&method==='GET')return result(this.commits.get(path.split('/').pop()));
    if(path.startsWith('/contents/')){
      const parent=request.searchParams.get('ref'),tree=this.trees.get(this.commits.get(parent).tree.sha),file=path.slice('/contents/'.length),sha=tree[file];
      if(!sha)return result({message:'missing'},404);
      return result({sha,content:file.endsWith('library.json')?Buffer.from(this.blobs.get(sha)).toString('base64'):'',encoding:'base64'});
    }
    if(path==='/git/blobs'&&method==='POST')return result({sha:this.store(body.content)},201);
    if(path==='/git/trees'&&method==='POST'){
      const tree={...this.trees.get(body.base_tree)};for(const entry of body.tree)tree[entry.path]=entry.sha||this.store(entry.content);
      const sha=id('tree'+(++this.counter));this.trees.set(sha,tree);return result({sha},201);
    }
    if(path==='/git/commits'&&method==='POST'){
      const sha=id('commit'+(++this.counter));this.commits.set(sha,{sha,tree:{sha:body.tree},parents:body.parents});return result({sha},201);
    }
    if(path==='/git/refs/heads/main'&&method==='PATCH'){
      if(this.failPatch)return result({message:'protected'},this.failPatch);
      if(this.concurrent){
        this.concurrent=false;const library=this.library();const sha=this.store(JSON.stringify({...card,name:'Other'}));
        library.characters.push({id:'other',name:'Other',file:'other.downbeat.json',sha});
        const tree={...this.currentFiles(),'角色卡/other.downbeat.json':sha,'角色卡/library.json':this.store(JSON.stringify(library))},treeSHA=id('concurrent-tree'),commitSHA=id('concurrent-commit');
        this.trees.set(treeSHA,tree);this.commits.set(commitSHA,{sha:commitSHA,tree:{sha:treeSHA},parents:[this.head]});this.head=commitSHA;return result({message:'concurrent'},422);
      }
      if(body.force!==false||this.commits.get(body.sha)?.parents[0]!==this.head)return result({message:'not fast forward'},422);
      this.head=body.sha;return result({object:{sha:this.head}});
    }
    throw Error('Unhandled fake GitHub route: '+method+' '+path);
  };
}
