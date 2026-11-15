import {database} from '@/lib/db';
import {isAdmin,isDeviceId} from '@/lib/security';
import {validateCleanupRequest} from '@/lib/log-cleanup.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
function response(body:unknown,status=200){return Response.json(body,{status,headers})}
export async function GET(request:Request){
 if(!isAdmin(request))return response({error:'Unauthorized'},401);
 const params=new URL(request.url).searchParams;
 const deviceId=params.get('deviceId');
 const days=Number(params.get('olderThanDays')??0);
 if(!isDeviceId(deviceId)||![0,7,30,90].includes(days))return response({error:'Invalid device or age filter'},400);
 const sql=database();
 const result=await sql`SELECT
  EXISTS(SELECT 1 FROM solar_devices WHERE id=${deviceId}) AS exists,
  (SELECT COUNT(*)::int FROM solar_remote_commands
   WHERE device_id=${deviceId} AND (state IN ('DONE','EXPIRED') OR expires_at<=NOW())
    AND (${days}=0 OR requested_at < NOW()-(${days}::integer*INTERVAL '1 day'))) AS diagnostics,
  (SELECT COUNT(*)::int FROM solar_remote_calibrations
   WHERE device_id=${deviceId} AND (state IN ('DONE','EXPIRED') OR expires_at<=NOW())
    AND (${days}=0 OR requested_at < NOW()-(${days}::integer*INTERVAL '1 day'))) AS calibrations,
  (SELECT COUNT(*)::int FROM solar_status_history WHERE device_id=${deviceId}
    AND (${days}=0 OR received_at < NOW()-(${days}::integer*INTERVAL '1 day'))) AS status,
  (SELECT COUNT(*)::int FROM solar_readings WHERE device_id=${deviceId}
    AND (${days}=0 OR received_at < NOW()-(${days}::integer*INTERVAL '1 day'))) AS telemetry,
  (SELECT COUNT(*)::int FROM solar_log_cleanup_audit WHERE device_id=${deviceId}) AS audit_entries`;
 if(result[0]?.exists!==true)return response({error:'Registered device not found'},404);
 const x=result[0];
 return response({deviceId,olderThanDays:days,counts:{diagnostics:Number(x.diagnostics),calibrations:Number(x.calibrations),status:Number(x.status),telemetry:Number(x.telemetry)},auditEntries:Number(x.audit_entries),
 note:'Only completed or expired command records are eligible; active commands, device credentials, rates and latest health are never deleted.'});
}
export async function POST(request:Request){
 if(!isAdmin(request))return response({error:'Unauthorized'},401);
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return response({error:'Expected JSON body'},415);
 let input:unknown;
 try{const raw=await request.text();if(raw.length>800)throw Error('Too long');input=JSON.parse(raw)}
 catch{return response({error:'Invalid JSON body'},400)}
 const selection=validateCleanupRequest(input);
 if(!selection)return response({error:'Exact CLEAR confirmation and deletion acknowledgment required'},400);
 const {deviceId,scope,olderThanDays:days}=selection;
 const sql=database();
 // Each statement uses a single atomic data-modifying CTE. The audit row records
 // only metadata, never sensor values, tokens or admin credentials.
 // Active commands survive even when requested "all", preserving remote device safety.
 const action=scope==='diagnostics'
 ?await sql`WITH device AS (SELECT id FROM solar_devices WHERE id=${deviceId}),
    removed AS (DELETE FROM solar_remote_commands WHERE device_id IN (SELECT id FROM device)
      AND (state IN ('DONE','EXPIRED') OR expires_at<=NOW())
      AND (${days}=0 OR requested_at < NOW()-(${days}::integer*INTERVAL '1 day')) RETURNING id),
    audit AS (INSERT INTO solar_log_cleanup_audit(device_id,scope,older_than_days,deleted_count)
      SELECT ${deviceId},${scope},${days},COUNT(*)::integer FROM removed
      HAVING COUNT(*)>0 RETURNING id)
    SELECT (SELECT COUNT(*)::integer FROM device) AS devices,(SELECT COUNT(*)::integer FROM removed) AS deleted,
     (SELECT id FROM audit) AS audit_id`
 :scope==='calibrations'
 ?await sql`WITH device AS (SELECT id FROM solar_devices WHERE id=${deviceId}),
    removed AS (DELETE FROM solar_remote_calibrations WHERE device_id IN (SELECT id FROM device)
      AND (state IN ('DONE','EXPIRED') OR expires_at<=NOW())
      AND (${days}=0 OR requested_at < NOW()-(${days}::integer*INTERVAL '1 day')) RETURNING id),
    audit AS (INSERT INTO solar_log_cleanup_audit(device_id,scope,older_than_days,deleted_count)
      SELECT ${deviceId},${scope},${days},COUNT(*)::integer FROM removed
      HAVING COUNT(*)>0 RETURNING id)
    SELECT (SELECT COUNT(*)::integer FROM device) AS devices,(SELECT COUNT(*)::integer FROM removed) AS deleted,
     (SELECT id FROM audit) AS audit_id`
 :scope==='status'
 ?await sql`WITH device AS (SELECT id FROM solar_devices WHERE id=${deviceId}),
    removed AS (DELETE FROM solar_status_history WHERE device_id IN (SELECT id FROM device)
      AND (${days}=0 OR received_at < NOW()-(${days}::integer*INTERVAL '1 day')) RETURNING id),
    audit AS (INSERT INTO solar_log_cleanup_audit(device_id,scope,older_than_days,deleted_count)
      SELECT ${deviceId},${scope},${days},COUNT(*)::integer FROM removed
      HAVING COUNT(*)>0 RETURNING id)
    SELECT (SELECT COUNT(*)::integer FROM device) AS devices,(SELECT COUNT(*)::integer FROM removed) AS deleted,
     (SELECT id FROM audit) AS audit_id`
 :await sql`WITH device AS (SELECT id FROM solar_devices WHERE id=${deviceId}),
    removed AS (DELETE FROM solar_readings WHERE device_id IN (SELECT id FROM device)
      AND (${days}=0 OR received_at < NOW()-(${days}::integer*INTERVAL '1 day')) RETURNING id),
    audit AS (INSERT INTO solar_log_cleanup_audit(device_id,scope,older_than_days,deleted_count)
      SELECT ${deviceId},${scope},${days},COUNT(*)::integer FROM removed
      HAVING COUNT(*)>0 RETURNING id)
    SELECT (SELECT COUNT(*)::integer FROM device) AS devices,(SELECT COUNT(*)::integer FROM removed) AS deleted,
     (SELECT id FROM audit) AS audit_id`;
 const x=action[0];
 if(Number(x?.devices)!==1)return response({error:'Registered device not found; no logs were deleted'},404);
 // Do not reset health, last-seen, rates or the ESP32 boot counter. The existing
 // ingestion code establishes the next Wh baseline if all readings were deleted.
 console.warn('SECURITY_EVENT TALON_LOG_CLEANUP scope='+scope+' count='+Number(x.deleted));
 return response({ok:true,deviceId,scope,olderThanDays:days,deleted:Number(x.deleted),auditId:x.audit_id||null,
  preserved:['Current device health','Device tokens and Wi-Fi configuration','Monthly rate settings','Pending commands','Cleanup audit records'],
  note:scope==='telemetry'?'Historic charts and energy totals will change; next uploads resume with the existing ESP32 energy counter.':'New station events and command responses continue after cleanup.'});
}
