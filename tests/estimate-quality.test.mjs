import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReading,validateHeartbeat} from '../lib/telemetry.mjs';
const base={deviceId:'TALON-SOLAR-001',bootId:'0011223344556677',seq:1,volts:12.3,amps:0.6,watts:7.38,energyWh:0.1,status:'OK'};
test('old readings are accepted but labeled legacy',()=>assert.equal(validateReading(base)?.quality,'LEGACY_UNSPECIFIED'));
test('r7 zero-referenced and below resolution are accepted',()=>{
 for(const quality of ['UNVERIFIED_ESTIMATE','ZERO_REFERENCED','BELOW_RESOLUTION','EXPERIMENTAL_ESTIMATE'])
 assert.equal(validateReading({...base,quality})?.quality,quality);
});
test('reject unknown quality, malformed quality and invalid energy fields',()=>{
 for(const quality of ['CERTIFIED','BILLING_GRADE',1,null,{},''])
 assert.equal(validateReading({...base,quality}),null);
 assert.equal(validateReading({...base,energyWh:-1}),null);
});
