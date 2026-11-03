import { database } from '@/lib/db';
export const dynamic = 'force-dynamic';
export async function firstDevice() {
  const sql=database();
  const rows=await sql`SELECT id,label,last_seen,last_status FROM solar_devices ORDER BY created_at LIMIT 1`;
  return rows[0] || null;
}
export function noStore(result: unknown, status=200) {
  return Response.json(result, {status, headers:{'Cache-Control':'public, max-age=0, s-maxage=0, must-revalidate'}});
}
