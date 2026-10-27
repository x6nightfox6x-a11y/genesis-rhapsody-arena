import { installPublisher } from './publish-ui.js';
import { localLibrary } from './local-store.js';
if(window.parent===window){
  installPublisher({mount:document.querySelector('body>header')||document.body,
    getDraft:async()=>{
      if(typeof window.warmSprites==='function')await window.warmSprites();
      const value=window.normalized(),card=value.card||value;window.DBCard.validate(card);
      const id=card.graCharacterId||String(card.name||'character').replace(/[^\w\u4e00-\u9fff-]/g,'_').slice(0,100);
      const store=await localLibrary(),previous=await store.get(id);
      await store.put({...previous,id,card,updated:Date.now(),dirty:true});
      return {id,card,sourceSHA:previous?.sourceSHA};
    },
    markPublished:async(published,draft)=>{const store=await localLibrary(),current=await store.get(draft.id);await store.put({...current,dirty:JSON.stringify(current.card)!==JSON.stringify(draft.card),sourceSHA:published.sha,remoteFile:published.file});}
  });
}
