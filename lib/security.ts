import { createHash, timingSafeEqual } from 'node:crypto';
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function secretEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const one = Buffer.from(digest(a), 'hex');
  const two = Buffer.from(digest(b), 'hex');
  return timingSafeEqual(one, two);
}
export function isAdmin(request: Request) {
  const token = process.env.ADMIN_SETUP_TOKEN;
  return !!token && token.length >= 32 && secretEqual(request.headers.get('x-admin-key') || '', token);
}
export function isDeviceId(s: unknown): s is string { return typeof s === 'string' && /^[A-Z0-9-]{5,48}$/.test(s); }
