
import {database} from '@/lib/db';
import {firstDevice,noStore} from '@/lib/public';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){
 const params=new URL(request.url).searchParams;
 const rawPage=params.get('page')||'1',rawSize=params.get('limit')||'10';
 if(!/^[1-9]\d{0,3}$/.test(rawPage)||!/^(10|20|50)$/.test(rawSize))return noStore({error:'Invalid pagination'},400);
 const page=Number(rawPage),limit=Number(rawSize),offset=(page-1)*limit;
 const device=await firstDevice();
 if(!device)return noStore({rows:[],page,limit,total:0,pages:0});
 const sql=database();
 const count=await sql`SELECT COUNT(*)::int AS total FROM solar_status_history WHERE device_id=${device.id}`;
 const rows=await sql`SELECT received_at,firmware,uptime_seconds,wifi_rssi_dbm,lcd_initialized,sensor_verified,supply_present,sensor_fault,station_status,cloud_last_result,event_type
  FROM solar_status_history WHERE device_id=${device.id} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`;
 const total=Number(count[0]?.total||0);
 return noStore({rows,page,limit,total,pages:Math.ceil(total/limit)});
}
