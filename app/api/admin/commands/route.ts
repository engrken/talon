
import {database} from '@/lib/db';
import {isAdmin,isDeviceId} from '@/lib/security';
export const runtime='nodejs'; export const dynamic='force-dynamic';
const noCache={'Cache-Control':'no-store'};

export async function GET(request:Request){
 if(!isAdmin(request))return Response.json({error:'Unauthorized'},{status:401,headers:noCache});
 const deviceId=new URL(request.url).searchParams.get('deviceId')||'';
 if(!isDeviceId(deviceId))return Response.json({error:'Invalid device'},{status:400,headers:noCache});
 const sql=database();
 const device=await sql`SELECT d.last_seen,h.firmware,h.remote_diagnostics,h.remote_zero_calibration
   FROM solar_devices d LEFT JOIN solar_device_health h ON h.device_id=d.id
   WHERE d.id=${deviceId} LIMIT 1`;
 if(!device.length)return Response.json({error:'Device not found'},{status:404,headers:noCache});
 const lastSeen=device[0].last_seen;
 const online=!!lastSeen&&Date.now()-new Date(lastSeen).getTime()<240000;
 const remoteReady=device[0].remote_diagnostics===true&&online;
 const remoteZeroReady=remoteReady&&device[0].remote_zero_calibration===true;
 const rows=await sql`SELECT id,command,requested_at,completed_at,output,state FROM (
   SELECT id::text AS id,command,requested_at,completed_at,output,
     CASE WHEN state!='DONE' AND expires_at<=NOW() THEN 'EXPIRED' ELSE state END AS state
     FROM solar_remote_commands WHERE device_id=${deviceId}
   UNION ALL
   SELECT ('C'||id::text) AS id,command,requested_at,completed_at,output,
     CASE WHEN state!='DONE' AND expires_at<=NOW() THEN 'EXPIRED' ELSE state END AS state
     FROM solar_remote_calibrations WHERE device_id=${deviceId}
 ) q ORDER BY requested_at DESC LIMIT 20`;
 return Response.json({rows,remoteReady,remoteZeroReady,
   remoteDiagnostics:device[0].remote_diagnostics===true,firmware:device[0].firmware||null,lastSeen},{headers:noCache});
}
export async function POST(request:Request){
 if(!isAdmin(request))return Response.json({error:'Unauthorized'},{status:401,headers:noCache});
 let raw:any;
 try{const body=await request.text();if(body.length>500)throw Error('Too long');raw=JSON.parse(body)}
 catch{return Response.json({error:'Invalid JSON'},{status:400,headers:noCache})}
 const deviceId=raw?.deviceId,command=raw?.command;
 const diagnostic=command==='h'||command==='d';
 const calibration=command==='zc'||command==='za'||command==='zr';
 if(!isDeviceId(deviceId)||(!diagnostic&&!calibration))
   return Response.json({error:'Unsupported command'},{status:400,headers:noCache});
 const sql=database();
 const device=await sql`SELECT d.last_seen,h.firmware,h.remote_diagnostics,h.remote_zero_calibration
   FROM solar_devices d LEFT JOIN solar_device_health h ON h.device_id=d.id
   WHERE d.id=${deviceId} LIMIT 1`;
 if(!device.length||!device[0].last_seen||Date.now()-new Date(device[0].last_seen).getTime()>240000)
   return Response.json({error:'ESP32 must be online to receive a command'},{status:409,headers:noCache});
 if(device[0].remote_diagnostics!==true)
   return Response.json({error:'Device has not reported remote diagnostic support'},{status:409,headers:noCache});
 if(calibration&&device[0].remote_zero_calibration!==true)
   return Response.json({error:'Flash the v5.6.0-r3 remote zero firmware and wait for its heartbeat first'},{status:409,headers:noCache});
 if(command==='za'||command==='zr'){
   const expected=(command==='za'?'ZERO ':'ROLLBACK ')+deviceId;
   if(raw?.confirmation!==expected||raw?.noCurrentConfirmed!==true)
     return Response.json({error:'Explicit operator verification of isolated zero-current path is required'},{status:400,headers:noCache});
 }
 if(command==='za'){
   const preflight=await sql`SELECT c.id FROM solar_remote_calibrations c
     WHERE c.device_id=${deviceId} AND c.command='zc' AND c.state='DONE'
      AND c.output LIKE 'CAL_READY%' AND c.completed_at>NOW()-INTERVAL '3 minutes'
      AND NOT EXISTS (SELECT 1 FROM solar_remote_calibrations z
        WHERE z.device_id=${deviceId} AND z.command='za' AND z.requested_at>=c.completed_at)
     ORDER BY c.id DESC LIMIT 1`;
   if(!preflight.length)return Response.json({error:'Run a successful zero pre-check, then confirm within 3 minutes'},{status:409,headers:noCache});
 }
 const pending=await sql`SELECT
   (SELECT COUNT(*) FROM solar_remote_commands WHERE device_id=${deviceId}
     AND state IN ('QUEUED','CLAIMED') AND expires_at>NOW())+
   (SELECT COUNT(*) FROM solar_remote_calibrations WHERE device_id=${deviceId}
     AND state IN ('QUEUED','CLAIMED') AND expires_at>NOW()) AS count`;
 if(Number(pending[0]?.count||0)>0)return Response.json({error:'Another command is pending; retry after it completes'},{status:409,headers:noCache});
 const recent=await sql`SELECT
   (SELECT COUNT(*) FROM solar_remote_commands WHERE device_id=${deviceId}
     AND requested_at>NOW()-INTERVAL '10 minutes')+
   (SELECT COUNT(*) FROM solar_remote_calibrations WHERE device_id=${deviceId}
     AND requested_at>NOW()-INTERVAL '10 minutes') AS count`;
 if(Number(recent[0]?.count||0)>=12)return Response.json({error:'Rate limit reached; try again later'},{status:429,headers:noCache});
 if(calibration){
   const inserted=await sql`INSERT INTO solar_remote_calibrations(device_id,command,expires_at)
     VALUES(${deviceId},${command},NOW()+INTERVAL '3 minutes') RETURNING id`;
   return Response.json({ok:true,id:'C'+inserted[0].id},{status:201,headers:noCache});
 }
 const inserted=await sql`INSERT INTO solar_remote_commands(device_id,command,expires_at)
   VALUES(${deviceId},${command},NOW()+INTERVAL '3 minutes') RETURNING id`;
 return Response.json({ok:true,id:inserted[0].id},{status:201,headers:noCache});
}
