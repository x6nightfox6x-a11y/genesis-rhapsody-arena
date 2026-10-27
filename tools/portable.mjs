import { spawn } from 'node:child_process';
import { startServer } from './serve.mjs';

let preview;
for(let port=4173;port<=4193;port++){
  try{preview=await startServer({port});break;}catch(error){if(error.code!=='EADDRINUSE')throw error;}
}
if(!preview)throw Error('Ports 4173–4193 are busy. Close an older Studio window and try again.');
const url=preview.url+'/studio.html';
console.log(`\nGRA Studio: ${url}\nKeep this window open. Press Ctrl+C to stop.\n`);
if(process.env.GRA_NO_OPEN!=='1'){
  const command=process.platform==='win32'?'explorer.exe':process.platform==='darwin'?'open':'xdg-open';
  const child=spawn(command,[url],{stdio:'ignore',windowsHide:true});child.on('error',()=>console.log('Open this URL in your browser:',url));child.unref();
}
