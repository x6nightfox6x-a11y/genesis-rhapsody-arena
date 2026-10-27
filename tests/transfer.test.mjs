import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBackup,transferableKey} from '../studio/transfer.js';
test('migration accepts only Studio storage keys and rejects malformed input',()=>{
  assert.equal(transferableKey('github-token'),false);
  assert.equal(transferableKey('arena-cathedral-blank-v2:%2FArena%2520game.html'),true);
  const value={format:'gra-studio-backup',version:1,cards:[],storage:[]};
  assert.equal(validateBackup(value),value);
  assert.throws(()=>validateBackup({...value,storage:[['github-token','secret']]}));
  assert.throws(()=>validateBackup({...value,cards:[{id:'x',card:{}}]}));
});
