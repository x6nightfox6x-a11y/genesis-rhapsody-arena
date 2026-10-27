import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubPublisher } from '../studio/github-client.js';
import { validateLibrary } from '../studio/character-library.js';
import { FakeGitHub,card,TOKEN,blobSHA } from './github-fixture.mjs';
test('publishing commits card and searchable library together without replacing the engine',async()=>{
  const github=new FakeGitHub(),client=new GitHubPublisher(github.fetch);await client.connect(TOKEN);
  const result=await client.publish({id:'new-character',card});
  const library=github.library(),entry=library.characters[0];assert.equal(entry.name,card.name);assert.equal(entry.sha,result.sha);
  assert.equal(github.blobs.get(github.currentFiles()['角色卡/'+entry.file]),JSON.stringify(card,null,2)+'\n');
  assert.equal(github.blobs.get(github.currentFiles()['Arena game.html']),'existing engine');
  assert.equal(github.requests.filter(r=>r.method==='PATCH').length,1);
  assert.equal(github.requests.find(r=>r.path==='/git/trees').body.tree.length,2);
  assert.equal(JSON.stringify(client),'{}');assert.ok(!JSON.stringify(result).includes(TOKEN));
  const count=github.requests.filter(r=>r.method==='POST').length;
  assert.equal((await client.publish({id:'new-character',card})).unchanged,true);
  assert.equal(github.requests.filter(r=>r.method==='POST').length,count,'unchanged cards do not create another commit');
});
test('concurrent updates retry against the new head and preserve other characters',async()=>{
  const github=new FakeGitHub(),client=new GitHubPublisher(github.fetch);await client.connect(TOKEN);github.concurrent=true;
  await client.publish({id:'new-character',card});
  assert.deepEqual(github.library().characters.map(entry=>entry.id).sort(),['new-character','other']);
  assert.equal(github.requests.filter(r=>r.method==='PATCH').length,2);assert.equal(github.requests.filter(r=>r.path==='/git/blobs').length,1);
});
test('remote edits require explicit version acknowledgement before overwrite',async()=>{
  const old=JSON.stringify({...card,name:'Cloud version'}),sha=blobSHA(old),library={format:'gra-character-library',version:1,characters:[{id:'existing',name:'Cloud version',file:'existing.downbeat.json',sha}]};
  const github=new FakeGitHub({'角色卡/library.json':JSON.stringify(library),'角色卡/existing.downbeat.json':old}),client=new GitHubPublisher(github.fetch);await client.connect(TOKEN);
  await assert.rejects(client.publish({id:'existing',card,sourceSHA:'0'.repeat(40)}),error=>error.code==='REMOTE_CHANGED'&&error.remoteSHA===sha);
  assert.equal(github.requests.filter(r=>r.method==='POST').length,0);
  await client.publish({id:'existing',card,sourceSHA:sha});assert.equal(github.library().characters[0].name,card.name);
});
test('protected branches never report publication success and double clicks cannot race',async()=>{
  const github=new FakeGitHub(),client=new GitHubPublisher(github.fetch);await client.connect(TOKEN);const oldHead=github.head;github.failPatch=403;
  await assert.rejects(client.publish({id:'new',card}),error=>error.status===403);assert.equal(github.head,oldHead);assert.equal(github.library().characters.length,0);
  github.failPatch=0;
  const first=client.publish({id:'first',card});await assert.rejects(client.publish({id:'second',card}),error=>error.code==='BUSY');await first;
  client.disconnect();assert.equal(client.connected,false);await assert.rejects(client.publish({id:'new',card}),error=>error.code==='AUTH');
});
test('invalid credentials disconnect and malicious index paths are rejected',async()=>{
  const github=new FakeGitHub(),client=new GitHubPublisher(github.fetch);await assert.rejects(client.connect('invalid_token_for_test_only'));assert.equal(client.connected,false);
  assert.throws(()=>validateLibrary({format:'gra-character-library',version:1,characters:[{id:'bad',name:'Bad',file:'../Arena game.html',sha:'a'.repeat(40)}]}));
});
