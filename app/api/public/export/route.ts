import { database } from '@/lib/db';
import { firstDevice } from '@/lib/public';
import { validISODate } from '@/lib/telemetry.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){
 const day=new URL(request.url).searchParams.get('date')||'';
 if(!validISODate(day))return new Response('Invalid day',{status:400});
 const device=await firstDevice();if(!device)return new Response('No station registered',{status:404});
 const sql=database();
 const rows=await sql`SELECT received_at,volts,amps,watts,delta_wh,energy_wh,status
  FROM solar_readings WHERE device_id=${device.id}
  AND received_at>=(${day}::date::timestamp AT TIME ZONE 'Asia/Manila')
  AND received_at<((${day}::date+1)::timestamp AT TIME ZONE 'Asia/Manila')
  ORDER BY received_at LIMIT 2000`;
 const body=['time_ph,volts,amps,watts,delta_wh,boot_energy_wh,status',...rows.map((r:any)=>[
  new Date(r.received_at).toLocaleString('sv-SE',{timeZone:'Asia/Manila'}),r.volts,r.amps,r.watts,r.delta_wh,r.energy_wh,r.status
 ].join(','))].join('\r\n')+'\r\n';
 return new Response(body,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="talon-${day}.csv"`,'Cache-Control':'no-store'}});
}
