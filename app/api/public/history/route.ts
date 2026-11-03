import { database } from '@/lib/db';
import { firstDevice,noStore } from '@/lib/public';
import { validISODate } from '@/lib/telemetry.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){
 const day=new URL(request.url).searchParams.get('date')||'';
 if(!validISODate(day))return noStore({error:'Use YYYY-MM-DD'},400);
 const device=await firstDevice();if(!device)return noStore({rows:[]});
 const sql=database();
 const rows=await sql`SELECT received_at AS observed_at,volts,amps,watts,
  delta_wh,energy_wh,status FROM solar_readings WHERE device_id=${device.id}
  AND received_at>=(${day}::date::timestamp AT TIME ZONE 'Asia/Manila')
  AND received_at<((${day}::date+1)::timestamp AT TIME ZONE 'Asia/Manila')
  ORDER BY received_at DESC LIMIT 1500`;
 return noStore({rows:rows.reverse()});
}
