import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateCleanupRequest,expectedCleanupPhrase,CLEANUP_SCOPES} from '../lib/log-cleanup.mjs';
const id='TALON-SOLAR-001';
test('individual module authorization requires exact device phrase and acknowledgment',()=>{
 for(const scope of CLEANUP_SCOPES){
  const confirmation=expectedCleanupPhrase(scope,id);
  assert.equal(validateCleanupRequest({deviceId:id,scope,olderThanDays:0,acknowledged:true,confirmation})?.scope,scope);
  assert.equal(validateCleanupRequest({deviceId:id,scope,olderThanDays:0,acknowledged:false,confirmation}),null);
  assert.equal(validateCleanupRequest({deviceId:id,scope,olderThanDays:0,acknowledged:true,confirmation:'CLEAR '+scope.toUpperCase()+' OTHER'}),null);
 }
});
test('limits retention filter and blocks unsupported scopes or malformed requests',()=>{
 for(const days of [0,7,30,90])assert.equal(validateCleanupRequest({deviceId:id,scope:'status',olderThanDays:days,acknowledged:true,confirmation:'CLEAR STATUS '+id})?.olderThanDays,days);
 for(const days of [-1,1,2,100,null,'0'])assert.equal(validateCleanupRequest({deviceId:id,scope:'status',olderThanDays:days,acknowledged:true,confirmation:'CLEAR STATUS '+id}),null);
 for(const scope of ['all','credentials','health','rates','audit','devices'])assert.equal(validateCleanupRequest({deviceId:id,scope,olderThanDays:0,acknowledged:true,confirmation:'CLEAR '+scope.toUpperCase()+' '+id}),null);
 assert.equal(validateCleanupRequest(null),null);assert.equal(validateCleanupRequest([]),null);
});
test('deletion route is independently authenticated, per-module and audit-writing',()=>{
 const s=readFileSync(new URL('../app/api/admin/logs/route.ts',import.meta.url),'utf8');
 assert.match(s,/isAdmin\(request\)/);
 for(const t of ['solar_remote_commands','solar_remote_calibrations','solar_status_history','solar_readings'])assert.match(s,new RegExp('DELETE FROM '+t));
 assert.match(s,/INSERT INTO solar_log_cleanup_audit/);
 assert.match(s,/state IN \('DONE','EXPIRED'\)/);
 assert.doesNotMatch(s,/DELETE FROM solar_devices/);
 assert.doesNotMatch(s,/DELETE FROM solar_device_health/);
});
