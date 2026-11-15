import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/api/admin/commands/route.ts', import.meta.url), 'utf8');

test('remote admin GET and POST both read the persisted remote capability', () => {
  const getBlock = source.slice(source.indexOf('export async function GET'), source.indexOf('export async function POST'));
  const postBlock = source.slice(source.indexOf('export async function POST'));
  for (const block of [getBlock, postBlock]) {
    assert.match(block, /SELECT d\.last_seen,h\.firmware,h\.remote_diagnostics\b/);
  }
});

test('POST only queues diagnostics when device has reported remote support', () => {
  const post = source.slice(source.indexOf('export async function POST'));
  assert.match(post, /device\[0\]\.remote_diagnostics!==true/);
  assert.match(post, /\['h','d'\]\.includes\(command\)/);
});
