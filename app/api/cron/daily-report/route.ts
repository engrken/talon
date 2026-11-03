import { secretEqual } from '@/lib/security';
import { database } from '@/lib/db';
export const runtime='nodejs';
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||secret.length<16||!secretEqual(request.headers.get('authorization')?.replace(/^Bearer /,'')||'',secret))return Response.json({error:'Unauthorized'},{status:401});
 const resendKey=process.env.RESEND_API_KEY,from=process.env.REPORT_FROM,to=process.env.REPORT_TO;
 if(!resendKey||!from||!to)return Response.json({error:'Email environment variables are missing'},{status:503});
 const sql=database();
 const todayPH=new Date(Date.now()+8*3600_000).toISOString().slice(0,10);
 const day=new Date(Date.parse(todayPH+'T00:00:00Z')-86400_000).toISOString().slice(0,10);
 const existing=await sql`SELECT report_date FROM solar_email_reports WHERE report_date=${day}::date LIMIT 1`;
 if(existing.length)return Response.json({ok:true,skipped:'Already sent',day});
 const rows=await sql`SELECT d.label,d.last_seen, COALESCE(SUM(r.delta_wh),0) AS energy_wh, MAX(r.watts) AS peak_watts,COUNT(r.id)::int AS samples
 FROM solar_devices d LEFT JOIN solar_readings r ON r.device_id=d.id
 AND r.received_at>=(${day}::date::timestamp AT TIME ZONE 'Asia/Manila')
 AND r.received_at<((${day}::date+1)::timestamp AT TIME ZONE 'Asia/Manila')
 GROUP BY d.id,d.label,d.last_seen`;
 const matchingRate=await sql`SELECT php_per_kwh::float8 AS rate FROM solar_rates WHERE billing_month=${day.slice(0,7)} LIMIT 1`;
 const rate=matchingRate[0]?Number(matchingRate[0].rate):null;
 const summary=rows.map((r:any)=>{const wh=Number(r.energy_wh||0);return `${r.label}: ${wh.toFixed(2)} Wh, peak ${Number(r.peak_watts||0).toFixed(1)} W, ${rate===null?'Rate not configured':('PHP '+(wh/1000*rate).toFixed(2)+' equivalent')} (${r.samples} readings). Upload status: ${r.last_seen && Date.now()-new Date(r.last_seen).getTime()<10*60000?'online':'offline / not recently synchronized'}`;}).join('\n') || 'No station registered.';
 const measurements=await sql`SELECT d.id AS device_id, r.received_at, r.volts, r.amps, r.watts, r.delta_wh, r.energy_wh, r.status
 FROM solar_devices d JOIN solar_readings r ON d.id=r.device_id
 WHERE r.received_at>=(${day}::date::timestamp AT TIME ZONE 'Asia/Manila')
 AND r.received_at<((${day}::date+1)::timestamp AT TIME ZONE 'Asia/Manila')
 ORDER BY d.id,r.received_at LIMIT 4500`;
 const csv=['device_id,timestamp_utc,volts,amps,watts,delta_wh,boot_energy_wh,status',...measurements.map((r:any)=>[
   r.device_id,new Date(r.received_at).toISOString(),r.volts,r.amps,r.watts,r.delta_wh,r.energy_wh,r.status
 ].join(','))].join('\r\n')+'\r\n';
 const subject=`Barangay Talon Solar — ${day} Energy Report`;
 const email=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':`Bearer ${resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject,text:`Barangay Talon USB charging energy report (${day}, Philippine time; missing offline minute samples are not reconstructed)\n\n${summary}\n\nMeasurements are 12 V USB input energy, not solar generation or verified financial savings.\nPublic dashboard: ${process.env.NEXT_PUBLIC_SITE_URL||'See your Vercel deployment URL'}`,attachments:[{filename:`talon-logs-${day}.csv`,content:Buffer.from(csv).toString('base64')}]})});
 if(!email.ok)return Response.json({error:'Email delivery failed',detail:(await email.text()).slice(0,500)}, {status:502});
 const response=await email.json();
 await sql`INSERT INTO solar_email_reports(report_date,resend_id) VALUES(${day}::date,${String(response.id||'')}) ON CONFLICT(report_date) DO NOTHING`;
 return Response.json({ok:true,day,resendId:response.id});
}
