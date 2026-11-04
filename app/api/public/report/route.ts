import {database} from '@/lib/db';
import {firstDevice,noStore} from '@/lib/public';
import {makeReportWindow,summarizeReport} from '@/lib/reporting.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){
 const period=new URL(request.url).searchParams.get('period')||'day';
 const window=makeReportWindow(period,new Date());
 if(!window)return noStore({error:'Use period=day, week, month, or year'},400);
 const device=await firstDevice();
 if(!device)return noStore({device:null,...summarizeReport(window,[])});
 const sql=database();
 // Aggregate by hour, day or month inside Postgres; no unbounded raw sample reads.
 const rows=await sql`SELECT to_char(date_trunc(${window.grain},r.received_at AT TIME ZONE 'Asia/Manila'),${window.sqlFormat}) AS bucket,
  COALESCE(SUM(r.delta_wh),0)::float8 AS energy_wh, MAX(r.watts)::float8 AS peak_watts,
  AVG(r.watts)::float8 AS avg_watts,COUNT(*)::int AS samples,
  COALESCE(SUM(CASE WHEN m.php_per_kwh IS NOT NULL
   THEN r.delta_wh*m.php_per_kwh/1000.0 ELSE 0 END),0)::float8 AS known_cost_php,
  COUNT(*) FILTER (WHERE m.php_per_kwh IS NULL)::int AS unrated_samples
  FROM solar_readings r LEFT JOIN solar_rates m
   ON m.billing_month=to_char(r.received_at AT TIME ZONE 'Asia/Manila','YYYY-MM')
  WHERE r.device_id=${device.id}
   AND r.received_at>=${window.since}::timestamptz
   AND r.received_at<${window.until}::timestamptz
  GROUP BY 1 ORDER BY 1`;
 return noStore({device:{id:device.id,label:device.label},...summarizeReport(window,rows)});
}
