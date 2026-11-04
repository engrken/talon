
import test from 'node:test';import assert from 'node:assert/strict';
import {validateReading,validateHeartbeat,validISODate,validMonth} from '../lib/telemetry.mjs';
const t={deviceId:'TALON-SOLAR-001',bootId:'aabbccddeeff1122',seq:1,volts:12.8,amps:3.2,watts:40.96,energyWh:30.1,status:'OK'};
const health={firmware:'5.3.0',uptimeSeconds:150,freeHeapBytes:180000,wifiConnected:true,wifiRssiDbm:-55,lcdInitialized:true,sensorVerified:true,supplyPresent:true,fault:'OK',stationStatus:'OK',cloudLastResult:'NEVER'};
const h={version:2,deviceId:t.deviceId,bootId:t.bootId,seq:t.seq,reading:{volts:t.volts,amps:t.amps,watts:t.watts,energyWh:t.energyWh,status:t.status},health};
test('legacy accepted',()=>assert.deepEqual(validateReading(t),t));
test('reject invalid reading',()=>assert.equal(validateReading({...t,volts:-1}),null));
test('heartbeat valid',()=>assert.equal(validateHeartbeat(h)?.reading?.watts,t.watts));
test('no supply accepted without measurements',()=>assert.equal(validateHeartbeat({...h,reading:null,health:{...health,sensorVerified:false,supplyPresent:false,fault:'NO_SUPPLY',stationStatus:'NO_SUPPLY'}})?.reading,null));
test('sensor fault accepted without measurements',()=>assert.equal(validateHeartbeat({...h,reading:null,health:{...health,sensorVerified:false,fault:'NEG_CURRENT',stationStatus:'SENSOR_UNVERIFIED'}})?.health.sensorVerified,false));
test('must include reading field',()=>{const x={...h};delete x.reading;assert.equal(validateHeartbeat(x),null)});
test('cannot claim valid sensor without readings',()=>assert.equal(validateHeartbeat({...h,reading:null}),null));
test('legacy extra equipment fields tolerated',()=>assert.equal(validateHeartbeat({...h,health:{...health,usbModulesTotal:4,usbPortsTotal:8,usbMonitoring:'UNMONITORED'}})?.reading?.watts,t.watts));
test('compact v5.4 heartbeat accepted',()=>assert.equal(validateHeartbeat({...h,health:{...health,firmware:'5.4.0'}})?.health.firmware,'5.4.0'));
test('reject status conflict',()=>assert.equal(validateHeartbeat({...h,health:{...health,stationStatus:'NO_SUPPLY'}}),null));
test('reject invalid RSSI',()=>assert.equal(validateHeartbeat({...h,health:{...health,wifiRssiDbm:33}}),null));
test('valid dates',()=>{assert.equal(validISODate('2026-11-03'),true);assert.equal(validISODate('2026-02-30'),false);assert.equal(validMonth('2026-11'),true);assert.equal(validMonth('2026-13'),false)});
