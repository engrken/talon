
import {database} from '@/lib/db';
import {digest,secretEqual,isDeviceId} from '@/lib/security';
export const runtime='nodejs'; export const dynamic='force-dynamic';
const noCache={'Cache-Control':'no-store'};
async function authorize(request:Request,deviceId:string){
 if(!isDeviceId(deviceId))return false;
 const auth=request.headers.get('authorization')||'';
 if(!auth.startsWith('Bearer ')||auth.length>250)return false;
 const sql=database();
 const rows=await sql`SELECT token_sha256 FROM solar_devices WHERE id=${deviceId} LIMIT 1`;
 return !!rows[0]&&secretEqual(digest(auth.slice(7)),String(rows[0].token_sha256));
}
export async function GET(request:Request){
 const deviceId=new URL(request.url).searchParams.get('deviceId')||'';
 if(!await authorize(request,deviceId))return new Response('Unauthorized',{status:401,headers:noCache});
 const sql=database();
 // Re-issue claimed read-only commands until the device acknowledges or TTL expires.
 const rows=await sql`UPDATE solar_remote_commands SET state='CLAIMED',claimed_at=NOW()
 WHERE id=(SELECT id FROM solar_remote_commands
           WHERE device_id=${deviceId} AND state IN ('QUEUED','CLAIMED') AND expires_at>NOW()
           ORDER BY id ASC LIMIT 1)
 RETURNING id,command`;
 if(!rows.length)return new Response('0',{headers:{...noCache,'Content-Type':'text/plain'}});
 return new Response(String(rows[0].id)+'|'+String(rows[0].command),{headers:{...noCache,'Content-Type':'text/plain'}});
}
export async function POST(request:Request){
 let raw:any;
 try{const body=await request.text();if(body.length>2200)throw Error('Too long');raw=JSON.parse(body)}
 catch{return Response.json({error:'Invalid body'},{status:400,headers:noCache})}
 const deviceId=raw?.deviceId;
 if(typeof deviceId!=='string'||!await authorize(request,deviceId))
   return Response.json({error:'Unauthorized'},{status:401,headers:noCache});
 const id=raw?.id;
 const output=raw?.output;
 if(!Number.isSafeInteger(id)||id<=0||id>2147483647||typeof output!=='string'||output.length>1200)
   return Response.json({error:'Invalid result'},{status:400,headers:noCache});
 const sql=database();
 const rows=await sql`UPDATE solar_remote_commands SET state='DONE',completed_at=NOW(),output=${output}
  WHERE device_id=${deviceId} AND id=${id} AND state IN ('QUEUED','CLAIMED')
    AND command IN ('h','d') AND expires_at>NOW()
  RETURNING id`;
 return Response.json({ok:rows.length===1},{status:rows.length?200:409,headers:noCache});
}
