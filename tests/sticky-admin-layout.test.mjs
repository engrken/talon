import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const admin=read('components/Admin.tsx');
const remote=read('components/RemoteConsole.tsx');
const local=read('components/CalibrationConsole.tsx');
const storage=read('components/LogManagement.tsx');
const css=read('app/globals.css');
test('sticky admin navigation resolves to existing, distinct sections',()=>{
 assert.match(admin,/className="admin-sticky-nav"/);
 for(const target of ['admin-setup','log-maintenance','remote-console','local-calibration']){
  assert.ok(admin.includes('href="#'+target+'"'),target);
  assert.ok([admin,remote,local,storage].some(x=>x.includes('id="'+target+'"')),target);
 }
 assert.match(css,/\.admin-sticky-nav\{position:sticky;top:0/);
});
test('desktop remote command toolbar stays sticky within the diagnostics module',()=>{
 assert.match(remote,/id="remote-console" className="panel remote-console"/);
 assert.match(remote,/className="remote-console-sticky"/);
 assert.match(css,/\.remote-console-sticky\{position:sticky;top:70px/);
});
test('mobile actions are real collapsible controls and do not duplicate command buttons',()=>{
 assert.match(remote,/aria-expanded=\{mobileActionsOpen\}/);
 assert.match(remote,/aria-controls="remote-action-controls"/);
 assert.match(remote,/id="remote-action-controls"/);
 assert.match(remote,/onClick=\{\(\)=>setMobileActionsOpen\(v=>!v\)\}/);
 assert.match(css,/@media\(max-width:720px\)/);
 assert.match(css,/\.remote-console-sticky \.remote-controls\.remote-controls-open\{display:grid\}/);
 assert.equal((remote.match(/send\('d'\)/g)||[]).length,1);
});
test('safety gates and verified admin connection remain unchanged',()=>{
 for(const term of ["preflightReady","noCurrentConfirmed","confirmation!=='ZERO '+deviceId","confirmation!=='ROLLBACK '+deviceId","if(!verified||!deviceId||busy)return","window.confirm("])
 assert.ok(remote.includes(term),term);
});
