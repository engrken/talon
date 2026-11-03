import { neon } from '@neondatabase/serverless';
import { loadEnvFile } from 'node:process';
if (!process.env.DATABASE_URL) { try { loadEnvFile('.env.local'); } catch { /* Allow externally injected env */ } }
import { readFile } from 'node:fs/promises';
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is required.'); process.exit(1); }
const sql = neon(process.env.DATABASE_URL);
const input = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
// All statements in this controlled project file are separated at semicolons.
for (const statement of input.split(';').map(s=>s.trim()).filter(Boolean)) {
  await sql.query(statement);
}
console.log('Database schema initialized successfully.');
