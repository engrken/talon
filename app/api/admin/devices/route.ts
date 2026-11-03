import { randomBytes } from 'node:crypto';
import { database } from '@/lib/db';
import { digest, isAdmin, isDeviceId } from '@/lib/security';
export const runtime='nodejs';
export async function GET(request:Request) {
  if(!isAdmin(request)) return Response.json({error:'Unauthorized'}, {status:401});
  const sql=database();
  return Response.json({devices:await sql`SELECT id,label,created_at,last_seen,last_status FROM solar_devices ORDER BY created_at`},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request) {
  if(!isAdmin(request)) return Response.json({error:'Unauthorized'}, {status:401});
  let body:any;
  try{ body=await request.json(); } catch {return Response.json({error:'Invalid JSON'}, {status:400});}
  const id=typeof body?.deviceId==='string'?body.deviceId.trim().toUpperCase():'';
  const label=typeof body?.label==='string'?body.label.trim():'';
  if(!isDeviceId(id)||label.length<3||label.length>100)return Response.json({error:'Invalid ID or label'}, {status:400});
  const token=randomBytes(32).toString('hex');
  const sql=database();
  const created=await sql`INSERT INTO solar_devices(id,label,token_sha256)
    VALUES(${id},${label},${digest(token)}) ON CONFLICT(id) DO NOTHING RETURNING id`;
  if(!created.length)return Response.json({error:'Device already exists. Existing keys are never displayed.'},{status:409});
  return Response.json({deviceId:id, deviceToken:token, warning:'Copy token now; it will not be shown again.'}, {status:201, headers:{'Cache-Control':'no-store'}});
}
