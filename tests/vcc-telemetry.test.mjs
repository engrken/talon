
import test from 'node:test';
import assert from 'node:assert/strict';
import {validateHeartbeat} from '../lib/telemetry.mjs';
const reading={volts:12.3,amps:1.0,watts:12.3,energyWh:15,status:'OK'};
const health={
 firmware:'5.7.0',uptimeSeconds:180,freeHeapBytes:160000,
 wifiConnected:true,wifiRssiDbm:-55,lcdInitialized:true,
 sensorVerified:true,supplyPresent:true,fault:'OK',stationStatus:'OK',
 cloudLastResult:'OK',currentStatus:'OK',voltageStatus:'OK',
 supplyMode:'OPERATIONAL',lowCurrentEstimate:false
};
const heartbeat={version:2,deviceId:'TALON-SOLAR-001',bootId:'aabbccddeeff0123',seq:4,reading,health};
test('retains compatibility with v5.6 heartbeat without VCC fields',()=>{
 assert.equal(validateHeartbeat(heartbeat)?.health.firmware,'5.7.0');
});
test('accepts monitored healthy ACS 5V supply on 12V load',()=>{
 const v={...heartbeat,health:{...health,acsVccMonitoringEnabled:true,acsVccHealthy:true,acsVccV:4.82}};
 assert.equal(validateHeartbeat(v)?.health.acsVccV,4.82);
});
test('accepts disabled optional VCC monitor',()=>{
 const v={...heartbeat,health:{...health,acsVccMonitoringEnabled:false,acsVccHealthy:false,acsVccV:0}};
 assert.equal(validateHeartbeat(v)?.health.acsVccMonitoringEnabled,false);
});
test('rejects partial VCC fields and unsafe flags',()=>{
 for(const extra of [
  {acsVccMonitoringEnabled:true},
  {acsVccMonitoringEnabled:false,acsVccHealthy:true,acsVccV:0},
  {acsVccMonitoringEnabled:true,acsVccHealthy:true,acsVccV:6},
  {acsVccMonitoringEnabled:false,acsVccHealthy:false,acsVccV:1},
  {acsVccMonitoringEnabled:true,acsVccHealthy:false,acsVccV:NaN}
 ]) assert.equal(validateHeartbeat({...heartbeat,health:{...health,...extra}}),null);
});
test('sensor monitor fault status still rejects invented normal readings',()=>{
 const badHealth={...health,acsVccMonitoringEnabled:true,acsVccHealthy:false,acsVccV:3.9,
 sensorVerified:false,currentStatus:'CHECK',fault:'INVALID_ANALOG',stationStatus:'SENSOR_UNVERIFIED'};
 assert.equal(validateHeartbeat({...heartbeat,reading:null,health:badHealth})?.health.sensorVerified,false);
 assert.equal(validateHeartbeat({...heartbeat,health:badHealth}),null);
});
