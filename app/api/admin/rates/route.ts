import { database } from '@/lib/db';
import { isAdmin } from '@/lib/security';
import { validMonth } from '@/lib/telemetry.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){
 if(!isAdmin(req))return Response.json({error:'Unauthorized'},{status:401});
 const sql=database();const rates=await sql`SELECT billing_month,php_per_kwh::float8 AS rate, updated_at FROM solar_rates ORDER BY billing_month DESC LIMIT 36`;
 return Response.json({rates},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(req:Request){
 if(!isAdmin(req))return Response.json({error:'Unauthorized'},{status:401});
 let b:any;try{b=await req.json()}catch{return Response.json({error:'Invalid JSON'},{status:400})}
 if(!validMonth(b?.month)||typeof b?.rate!=='number'||!Number.isFinite(b.rate)||b.rate<0||b.rate>100)
  return Response.json({error:'Invalid billing month or PHP/kWh rate'},{status:400});
 const sql=database();await sql`INSERT INTO solar_rates(billing_month,php_per_kwh)
 VALUES(${b.month},${b.rate}) ON CONFLICT(billing_month)
 DO UPDATE SET php_per_kwh=EXCLUDED.php_per_kwh,updated_at=NOW()`;
 return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}
