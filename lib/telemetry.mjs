
export const STATUSES=new Set(['OK','LOW_USB_BUS']);
export const STATION_STATES=new Set(['OK','LOW_USB_BUS','NO_SUPPLY','SENSOR_UNVERIFIED']);
export const FAULT_CODES=new Set(['OK','NO_SUPPLY','LOW_UNVERIFIED','HIGH_VOLT','NEG_CURRENT','HIGH_CURRENT','INVALID_ANALOG']);
export function validateReading(p){
 if(!p||typeof p!=='object'||Array.isArray(p))return null;
 if(typeof p.deviceId!=='string'||!/^[A-Z0-9-]{4,48}$/.test(p.deviceId))return null;
 if(typeof p.bootId!=='string'||!/^[a-fA-F0-9]{16}$/.test(p.bootId))return null;
 if(!Number.isSafeInteger(p.seq)||p.seq<1||p.seq>2000000000)return null;
 for(const [k,max] of [['volts',25],['amps',31],['watts',800],['energyWh',1e8]]){
  if(typeof p[k]!=='number'||!Number.isFinite(p[k])||p[k]<0||p[k]>max)return null;
 }
 if(!STATUSES.has(p.status))return null;
 return {deviceId:p.deviceId,bootId:p.bootId.toLowerCase(),seq:p.seq,volts:p.volts,amps:p.amps,watts:p.watts,energyWh:p.energyWh,status:p.status};
}
export function validateHeartbeat(p){
 if(!p||typeof p!=='object'||Array.isArray(p)||p.version!==2)return null;
 const h=p.health;
 if(!h||typeof h!=='object'||Array.isArray(h))return null;
 if(typeof p.deviceId!=='string'||!/^[A-Z0-9-]{4,48}$/.test(p.deviceId))return null;
 if(typeof p.bootId!=='string'||!/^[a-fA-F0-9]{16}$/.test(p.bootId))return null;
 if(!Number.isSafeInteger(p.seq)||p.seq<1||p.seq>2000000000)return null;
 if(typeof h.firmware!=='string'||!/^[A-Za-z0-9.-]{1,24}$/.test(h.firmware))return null;
 if(!Number.isSafeInteger(h.uptimeSeconds)||h.uptimeSeconds<0||h.uptimeSeconds>4294967)return null;
 if(!Number.isSafeInteger(h.freeHeapBytes)||h.freeHeapBytes<0||h.freeHeapBytes>4000000)return null;
 if(h.wifiConnected!==true||!Number.isSafeInteger(h.wifiRssiDbm)||h.wifiRssiDbm < -127||h.wifiRssiDbm>0)return null;
 if(typeof h.lcdInitialized!=='boolean'||typeof h.sensorVerified!=='boolean'||typeof h.supplyPresent!=='boolean')return null;
 if(!FAULT_CODES.has(h.fault)||!STATION_STATES.has(h.stationStatus))return null;
 if(!['OK','ERROR','NEVER'].includes(h.cloudLastResult))return null;
 if(!Object.prototype.hasOwnProperty.call(p,'reading'))return null;
 if(p.reading!==null&&(typeof p.reading!=='object'||Array.isArray(p.reading)))return null;
 const reading=p.reading===null?null:validateReading({...p.reading,deviceId:p.deviceId,bootId:p.bootId,seq:p.seq});
 if(p.reading!==null&&!reading)return null;
 if(h.sensorVerified!==(reading!==null))return null;
 if(h.sensorVerified){
  if(!h.supplyPresent||h.fault!=='OK'||h.stationStatus!==reading.status)return null;
 }else if(h.stationStatus==='NO_SUPPLY'){
  if(h.fault!=='NO_SUPPLY'||h.supplyPresent)return null;
 }else if(h.stationStatus!=='SENSOR_UNVERIFIED'||h.fault==='OK'||h.fault==='NO_SUPPLY')return null;
 return {deviceId:p.deviceId,bootId:p.bootId.toLowerCase(),seq:p.seq,reading,health:h};
}
export function validISODate(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s}
export function validMonth(s){return typeof s==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(s)}
