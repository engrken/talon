import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateHeartbeat} from '../lib/telemetry.mjs';
const api=readFileSync(new URL('../app/api/admin/commands/route.ts',import.meta.url),'utf8');
const device=readFileSync(new URL('../app/api/device/commands/route.ts',import.meta.url),'utf8');
test('admin requires explicitly confirmed zero current and fresh stable precheck before save',()=>{
 assert.match(api,/noCurrentConfirmed!==true/);
 assert.match(api,/c.output LIKE 'CAL_READY%'/);
 assert.match(api,/c.completed_at>NOW\(\)-INTERVAL '3 minutes'/);
 assert.match(api,/remote_zero_calibration!==true/);
 assert.match(api,/NOT EXISTS \(SELECT 1 FROM solar_remote_calibrations z/);
});
test('calibration commands use a separate scoped queue and device token',()=>{
 assert.match(api,/solar_remote_calibrations\(device_id,command,expires_at\)/);
 assert.match(device,/await authorize\(request,deviceId\)/);
 assert.match(device,/command IN \('zc','za','zr'\)/);
 assert.match(device,/state IN \('QUEUED','CLAIMED'\)/);
});
test('unsupported zero-calibration capability is rejected',()=>{
 const health={firmware:'5.6.0-r3',uptimeSeconds:10,freeHeapBytes:150000,wifiConnected:true,wifiRssiDbm:-50,lcdInitialized:true,sensorVerified:false,supplyPresent:false,fault:'NO_SUPPLY',stationStatus:'NO_SUPPLY',cloudLastResult:'NEVER',currentStatus:'UNKNOWN',voltageStatus:'NO_INPUT',supplyMode:'NO_SUPPLY',lowCurrentEstimate:false,remoteDiagnostics:true};
 const base={version:2,deviceId:'TALON-SOLAR-001',bootId:'aabbccddeeff1122',seq:1,reading:null,health};
 assert.ok(validateHeartbeat(base));
 assert.equal(validateHeartbeat({...base,health:{...health,remoteZeroCalibration:'true'}}),null);
 assert.ok(validateHeartbeat({...base,health:{...health,remoteZeroCalibration:true}}));
 assert.equal(validateHeartbeat({...base,health:{...health,remoteDiagnostics:false,remoteZeroCalibration:true}}),null);
});
