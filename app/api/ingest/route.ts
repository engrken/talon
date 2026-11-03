import { database } from '@/lib/db';
import { digest, secretEqual } from '@/lib/security';
import { validateReading } from '@/lib/telemetry.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const auth=request.headers.get('authorization')||'';
 if(!auth.startsWith('Bearer ')||auth.length>250)return Response.json({error:'Unauthorized'},{status:401});
 let raw:any;
 try {const body=await request.text();if(body.length>3000)throw new Error('limit');raw=JSON.parse(body);}catch{return Response.json({error:'Invalid JSON'},{status:400});}
 const r=validateReading(raw);
 if(!r)return Response.json({error:'Invalid telemetry fields'},{status:400});
 const sql=database();
 const device=await sql`SELECT token_sha256 FROM solar_devices WHERE id=${r.deviceId} LIMIT 1`;
 if(!device[0]||!secretEqual(digest(auth.slice(7)),String(device[0].token_sha256)))return Response.json({error:'Unauthorized'},{status:401});
 // Monotonic boot-energy counter: first upload includes energy from boot.
 // Reconnection attributes accumulated offline Wh to the time of receipt,
 // without inventing missing minute-by-minute records.
 const prior=await sql`SELECT energy_wh FROM solar_readings WHERE device_id=${r.deviceId}
  AND boot_id=${r.bootId} ORDER BY seq DESC LIMIT 1`;
 const prev=prior[0]?Number(prior[0].energy_wh):0;
 const delta=Math.max(0,r.energyWh-prev);
 const inserted=await sql`INSERT INTO solar_readings(device_id,boot_id,seq,volts,amps,watts,energy_wh,delta_wh,status)
  VALUES(${r.deviceId},${r.bootId},${r.seq},${r.volts},${r.amps},${r.watts},${r.energyWh},${delta},${r.status})
  ON CONFLICT (device_id,boot_id,seq) DO NOTHING RETURNING id`;
 await sql`UPDATE solar_devices SET last_seen=NOW(),last_status=${r.status} WHERE id=${r.deviceId}`;
 return Response.json({ok:true,inserted:inserted.length===1,serverTime:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
}
