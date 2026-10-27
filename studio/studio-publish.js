import { installPublisher } from './publish-ui.js';
installPublisher({mount:document.querySelector('body>header'),editorOnly:true,
  getDraft:async id=>{await window.GRAStudio.ready;return window.GRAStudio.getDraft(id);},
  markPublished:(published,draft)=>window.GRAStudio.markPublished(published,draft),
  onStatus:text=>{document.getElementById('status').textContent=text;}
});
