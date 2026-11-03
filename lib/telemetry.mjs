export const STATUSES = new Set(['OK','LOW_USB_BUS']);
export function validateReading(p) {
 if(!p||typeof p!=='object'||Array.isArray(p))return null;
 if(typeof p.deviceId!=='string'||!/^[A-Z0-9-]{4,48}$/.test(p.deviceId))return null;
 if(typeof p.bootId!=='string'||!/^[a-fA-F0-9]{16}$/.test(p.bootId))return null;
 if(!Number.isSafeInteger(p.seq)||p.seq<1||p.seq>2000000000)return null;
 for(const [key,max] of [['volts',25],['amps',31],['watts',600],['energyWh',1e8]]){
  if(typeof p[key]!=='number'||!Number.isFinite(p[key])||p[key]<0||p[key]>max)return null;
 }
 if(!STATUSES.has(p.status))return null;
 return {deviceId:p.deviceId,bootId:p.bootId.toLowerCase(),seq:p.seq,volts:p.volts,amps:p.amps,watts:p.watts,energyWh:p.energyWh,status:p.status};
}
export function validISODate(s){if(typeof s!=='string'|| !/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;}
export function validMonth(s){return typeof s==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(s);}
