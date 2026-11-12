import {database} from '@/lib/db';
import {isAdmin} from '@/lib/security';
import {validateResetRequest} from '@/lib/reset.mjs';
export const runtime='nodejs'; export const dynamic='force-dynamic';
// The endpoint NEVER runs automatically. Only a verified administrator may
// reset one selected device after typing its exact confirmation phrase.
export async function POST(request:Request){
 if(!isAdmin(request))return Response.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
  return Response.json({error:'Expected JSON'},{status:415,headers:{'Cache-Control':'no-store'}});
 let body:unknown;
 try{
  const raw=await request.text();
  if(raw.length>1024)throw Error('Body too large');
  body=JSON.parse(raw);
 }catch{
  return Response.json({error:'Invalid JSON body'},{status:400,headers:{'Cache-Control':'no-store'}});
 }
 const id=validateResetRequest(body);
 if(!id)return Response.json({error:'Select a device and type RESET followed by its exact device ID to confirm.'},{status:400,headers:{'Cache-Control':'no-store'}});
 const sql=database();
 // One statement/transaction ensures the three deletions and last-seen reset
 // either all succeed or all fail. No device credentials or monthly rates change.
 const result=await sql`WITH removed_readings AS (
    DELETE FROM solar_readings WHERE device_id=${id} RETURNING id
   ), removed_history AS (
    DELETE FROM solar_status_history WHERE device_id=${id} RETURNING id
   ), removed_health AS (
    DELETE FROM solar_device_health WHERE device_id=${id} RETURNING device_id
   ), reset_device AS (
    UPDATE solar_devices SET last_seen=NULL,last_status=NULL WHERE id=${id} RETURNING id
   )
   SELECT (SELECT COUNT(*)::int FROM removed_readings) AS readings,
          (SELECT COUNT(*)::int FROM removed_history) AS status_events,
          (SELECT COUNT(*)::int FROM removed_health) AS health_snapshots,
          (SELECT COUNT(*)::int FROM reset_device) AS devices`;
 const counts=result[0];
 if(Number(counts?.devices)!==1)return Response.json({error:'Registered device not found; nothing was reset.'},{status:404,headers:{'Cache-Control':'no-store'}});
 console.warn('SECURITY_EVENT TALON_DEVICE_RESET');
 return Response.json({
  ok:true,deviceId:id,deleted:{readings:Number(counts.readings),statusEvents:Number(counts.status_events),healthSnapshots:Number(counts.health_snapshots)},
  preserved:['Device registration and token','Monthly electricity rates','Administrator credentials'],
  note:'Live ESP32 uploads may immediately create new measurements after reset.'
 },{headers:{'Cache-Control':'no-store'}});
}
