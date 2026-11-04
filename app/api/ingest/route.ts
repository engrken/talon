
import {database} from '@/lib/db';
import {digest,secretEqual} from '@/lib/security';
import {validateHeartbeat,validateReading} from '@/lib/telemetry.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:Request){
 const auth=request.headers.get('authorization')||'';
 if(!auth.startsWith('Bearer ')||auth.length>250)return Response.json({error:'Unauthorized'},{status:401});
 let raw:any;
 try{const body=await request.text();if(body.length>3000)throw Error('Body too long');raw=JSON.parse(body)}
 catch{return Response.json({error:'Invalid JSON'},{status:400})}
 const heartbeat=raw?.version===2?validateHeartbeat(raw):null;
 const reading=heartbeat?heartbeat.reading:(raw?.version===2?null:validateReading(raw));
 if(!heartbeat&&!reading)return Response.json({error:'Invalid telemetry fields'},{status:400});
 const id=heartbeat?heartbeat.deviceId:reading!.deviceId;
 const sql=database();
 const devices=await sql`SELECT token_sha256 FROM solar_devices WHERE id=${id} LIMIT 1`;
 if(!devices[0]||!secretEqual(digest(auth.slice(7)),String(devices[0].token_sha256)))return Response.json({error:'Unauthorized'},{status:401});
 let inserted=false;
 if(reading){
  const prior=await sql`SELECT energy_wh FROM solar_readings WHERE device_id=${id} AND boot_id=${reading.bootId} ORDER BY seq DESC LIMIT 1`;
  const previous=prior[0]?Number(prior[0].energy_wh):0;
  const delta=Math.max(0,reading.energyWh-previous);
  const result=await sql`INSERT INTO solar_readings(device_id,boot_id,seq,volts,amps,watts,energy_wh,delta_wh,status)
   VALUES(${id},${reading.bootId},${reading.seq},${reading.volts},${reading.amps},${reading.watts},${reading.energyWh},${delta},${reading.status})
   ON CONFLICT(device_id,boot_id,seq) DO NOTHING RETURNING id`;
  inserted=result.length===1;
 }
 if(heartbeat){
  const h=heartbeat.health;
  const previous=await sql`SELECT seen_at,boot_id,station_status,sensor_fault,lcd_initialized,cloud_last_result,wifi_connected
   FROM solar_device_health WHERE device_id=${id} LIMIT 1`;
  const p=previous[0],elapsed=p?Date.now()-new Date(p.seen_at).getTime():null;
  let reason=!p?'FIRST_REPORT':elapsed!==null&&elapsed>180000?'RECONNECTED':
   p.boot_id!==heartbeat.bootId?'RESTARTED':
   p.station_status!==h.stationStatus||p.sensor_fault!==h.fault||p.lcd_initialized!==h.lcdInitialized||
   p.cloud_last_result!==h.cloudLastResult||p.wifi_connected!==h.wifiConnected?'STATE_CHANGED':null;
  if(!reason){
   const recent=await sql`SELECT received_at FROM solar_status_history WHERE device_id=${id} ORDER BY id DESC LIMIT 1`;
   if(!recent.length||Date.now()-new Date(recent[0].received_at).getTime()>=900000)reason='CHECKPOINT';
  }
  await sql`INSERT INTO solar_device_health(device_id,seen_at,boot_id,seq,firmware,uptime_seconds,free_heap_bytes,wifi_connected,wifi_rssi_dbm,lcd_initialized,sensor_verified,supply_present,sensor_fault,station_status,cloud_last_result)
   VALUES(${id},NOW(),${heartbeat.bootId},${heartbeat.seq},${h.firmware},${h.uptimeSeconds},${h.freeHeapBytes},${h.wifiConnected},${h.wifiRssiDbm},${h.lcdInitialized},${h.sensorVerified},${h.supplyPresent},${h.fault},${h.stationStatus},${h.cloudLastResult})
   ON CONFLICT(device_id) DO UPDATE SET seen_at=EXCLUDED.seen_at,boot_id=EXCLUDED.boot_id,seq=EXCLUDED.seq,firmware=EXCLUDED.firmware,
   uptime_seconds=EXCLUDED.uptime_seconds,free_heap_bytes=EXCLUDED.free_heap_bytes,wifi_connected=EXCLUDED.wifi_connected,
   wifi_rssi_dbm=EXCLUDED.wifi_rssi_dbm,lcd_initialized=EXCLUDED.lcd_initialized,sensor_verified=EXCLUDED.sensor_verified,
   supply_present=EXCLUDED.supply_present,sensor_fault=EXCLUDED.sensor_fault,station_status=EXCLUDED.station_status,
   cloud_last_result=EXCLUDED.cloud_last_result
   WHERE solar_device_health.seen_at<=EXCLUDED.seen_at`;
  if(reason)await sql`INSERT INTO solar_status_history(device_id,boot_id,seq,firmware,uptime_seconds,wifi_rssi_dbm,lcd_initialized,sensor_verified,supply_present,sensor_fault,station_status,cloud_last_result,event_type)
   VALUES(${id},${heartbeat.bootId},${heartbeat.seq},${h.firmware},${h.uptimeSeconds},${h.wifiRssiDbm},${h.lcdInitialized},${h.sensorVerified},${h.supplyPresent},${h.fault},${h.stationStatus},${h.cloudLastResult},${reason})
   ON CONFLICT(device_id,boot_id,seq) DO NOTHING`;
 }
 await sql`UPDATE solar_devices SET last_seen=NOW(),last_status=${heartbeat?heartbeat.health.stationStatus:reading!.status} WHERE id=${id}`;
 return Response.json({ok:true,inserted,healthAccepted:!!heartbeat,serverTime:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
}
