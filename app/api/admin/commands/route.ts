
import {database} from '@/lib/db';
import {isAdmin,isDeviceId} from '@/lib/security';
export const runtime='nodejs'; export const dynamic='force-dynamic';
const noCache={'Cache-Control':'no-store'};
export async function GET(request:Request){
 if(!isAdmin(request))return Response.json({error:'Unauthorized'},{status:401,headers:noCache});
 const deviceId=new URL(request.url).searchParams.get('deviceId')||'';
 if(!isDeviceId(deviceId))return Response.json({error:'Invalid device'},{status:400,headers:noCache});
 const sql=database();
 const rows=await sql`SELECT id,command,requested_at,completed_at,output,
   CASE WHEN state!='DONE' AND expires_at<=NOW() THEN 'EXPIRED' ELSE state END AS state
   FROM solar_remote_commands WHERE device_id=${deviceId} ORDER BY id DESC LIMIT 20`;
 return Response.json({rows},{headers:noCache});
}
export async function POST(request:Request){
 if(!isAdmin(request))return Response.json({error:'Unauthorized'},{status:401,headers:noCache});
 let raw:any;
 try{const body=await request.text();if(body.length>256)throw Error('Too long');raw=JSON.parse(body)}
 catch{return Response.json({error:'Invalid JSON'},{status:400,headers:noCache})}
 const deviceId=raw?.deviceId, command=raw?.command;
 if(!isDeviceId(deviceId)||!['h','d'].includes(command))
   return Response.json({error:'Only read-only h/d diagnostics are permitted remotely'},{status:400,headers:noCache});
 const sql=database();
 const device=await sql`SELECT d.last_seen,h.firmware
   FROM solar_devices d LEFT JOIN solar_device_health h ON h.device_id=d.id
   WHERE d.id=${deviceId} LIMIT 1`;
 if(!device.length||!device[0].last_seen||Date.now()-new Date(device[0].last_seen).getTime()>240000)
   return Response.json({error:'ESP32 must be online to receive a diagnostic request'},{status:409,headers:noCache});
 const firmware=String(device[0].firmware||'');
 const match=firmware.match(/^(\d+)\.(\d+)\./);
 if(!match||Number(match[1])<5||(Number(match[1])===5&&Number(match[2])<7))
   return Response.json({error:'Flash Talon ESP32 firmware v5.7.0+ before using remote diagnostics'},{status:409,headers:noCache});
 const pending=await sql`SELECT COUNT(*)::int AS count FROM solar_remote_commands
   WHERE device_id=${deviceId} AND state IN ('QUEUED','CLAIMED') AND expires_at>NOW()`;
 if(Number(pending[0]?.count||0)>0)
   return Response.json({error:'Another command is pending for this device'},{status:409,headers:noCache});
 const recent=await sql`SELECT COUNT(*)::int AS count FROM solar_remote_commands
   WHERE device_id=${deviceId} AND requested_at>NOW()-INTERVAL '10 minutes'`;
 if(Number(recent[0]?.count||0)>=12)
   return Response.json({error:'Remote command rate limit reached; try later'},{status:429,headers:noCache});
 const rows=await sql`INSERT INTO solar_remote_commands(device_id,command,expires_at)
  VALUES(${deviceId},${command},NOW()+INTERVAL '3 minutes') RETURNING id`;
 return Response.json({ok:true,id:rows[0].id},{status:201,headers:noCache});
}
