import test from 'node:test';
import assert from 'node:assert/strict';
import {validateResetRequest,nextEnergyDeltaWh} from '../lib/reset.mjs';
test('exact selected device confirmation',()=>{
 assert.equal(validateResetRequest({deviceId:'TALON-SOLAR-001',confirmation:'RESET TALON-SOLAR-001'}),'TALON-SOLAR-001');
});
test('refuses incorrect, empty and spoofed confirmation',()=>{
 for(const value of [
  {deviceId:'TALON-SOLAR-001',confirmation:'RESET'},
  {deviceId:'TALON-SOLAR-001',confirmation:'reset TALON-SOLAR-001'},
  {deviceId:'TALON-SOLAR-001',confirmation:'RESET OTHER-DEVICE'},
  {deviceId:'bad id',confirmation:'RESET bad id'},null,[],{},
 ])assert.equal(validateResetRequest(value),null);
});
test('first reading after reset establishes fresh energy baseline',()=>{
 assert.equal(nextEnergyDeltaWh(null,246.5,53),0);
 assert.equal(nextEnergyDeltaWh(undefined,246.5,53),0);
 assert.equal(nextEnergyDeltaWh(246.5,247.75,54),1.25);
});
test('normal new boot retains first sample delta',()=>{
 assert.equal(nextEnergyDeltaWh(null,0.3,1),0.3);
});
test('counters never produce negative delta',()=>{
 assert.equal(nextEnergyDeltaWh(500,10,5),0);
 assert.equal(nextEnergyDeltaWh(null,-1,2),0);
});
