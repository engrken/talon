import { database } from '@/lib/db';
import { firstDevice, noStore } from '@/lib/public';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){
 const device=await firstDevice();if(!device)return noStore({device:null,latest:null,daily:[],rates:[]});
 const sql=database();
 const latest=await sql`SELECT received_at AS observed_at,volts,amps,watts,energy_wh,delta_wh,status
  FROM solar_readings WHERE device_id=${device.id} ORDER BY id DESC LIMIT 1`;
 const daily=await sql`SELECT (r.received_at AT TIME ZONE 'Asia/Manila')::date::text AS day,
  COALESCE(SUM(r.delta_wh),0)::float8 AS energy_wh, MAX(r.watts) AS peak_watts,COUNT(*)::int AS samples,
  MAX(m.php_per_kwh)::float8 AS rate,
  CASE WHEN COUNT(m.php_per_kwh)=0 THEN NULL ELSE SUM(r.delta_wh)/1000.0*MAX(m.php_per_kwh) END::float8 AS cost_php
  FROM solar_readings r LEFT JOIN solar_rates m
  ON m.billing_month=TO_CHAR(r.received_at AT TIME ZONE 'Asia/Manila','YYYY-MM')
  WHERE r.device_id=${device.id} AND r.received_at>=NOW()-INTERVAL '36 days'
  GROUP BY 1 ORDER BY day DESC LIMIT 35`;
 const rates=await sql`SELECT billing_month,php_per_kwh::float8 AS rate FROM solar_rates ORDER BY billing_month DESC LIMIT 24`;
 return noStore({device,latest:latest[0]||null,daily,rates});
}
