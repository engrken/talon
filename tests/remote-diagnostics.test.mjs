import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateHeartbeat} from '../lib/telemetry.mjs';
const base={version:2,deviceId:'TALON-SOLAR-001',bootId:'aabbccddeeff1122',seq:1,
 health:{firmware:'5.6.0-r1',uptimeSeconds:300,freeHeapBytes:180000,wifiConnected:true,
 wifiRssiDbm:-65,lcdInitialized:true,sensorVerified:true,supplyPresent:true,fault:'OK',
 stationStatus:'OK',cloudLastResult:'NEVER',currentStatus:'OK',voltageStatus:'OK',
 supplyMode:'OPERATIONAL',lowCurrentEstimate:false},
 reading:{volts:12.8,amps:1.0,watts:12.8,energyWh:0.4,status:'OK'}};
test('remote-capable 5.6 heartbeat validated',()=>{
 const packet={...base,health:{...base.health,remoteDiagnostics:true}};
 assert.equal(validateHeartbeat(packet)?.health.remoteDiagnostics,true);
});
test('legacy original 5.6 heartbeat remains compatible',()=>{
 assert.equal(validateHeartbeat(base)?.health.remoteDiagnostics,undefined);
});
test('remote capability cannot be spoofed as a string',()=>{
 const packet={...base,health:{...base.health,remoteDiagnostics:'true'}};
 assert.equal(validateHeartbeat(packet),null);
});
test('remote command endpoints whitelist read-only h and d',()=>{
 const admin=readFileSync(new URL('../app/api/admin/commands/route.ts',import.meta.url),'utf8');
 const device=readFileSync(new URL('../app/api/device/commands/route.ts',import.meta.url),'utf8');
 assert.match(admin,/\['h','d'\]\.includes\(command\)/);
 assert.match(device,/command IN \('h','d'\)/);
 assert.match(admin,/remote_diagnostics!==true/);
});
