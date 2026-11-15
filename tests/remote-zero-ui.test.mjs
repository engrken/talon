import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../components/RemoteConsole.tsx',import.meta.url),'utf8');
test('v5.6 r5 zero-calibration result is summarized and retains raw output',()=>{
 for(const term of ['baseline_min_mV','baseline_med_mV','baseline_max_mV','burst_max_mV','noisy_bursts','zero_shift_mV','remote-zero-summary'])
   assert.ok(s.includes(term),term);
 assert.ok(s.includes('<pre>{e.output'));
});
test('zero save still requires preflight, explicit checkbox and exact confirmation',()=>{
 for(const term of ["!preflightReady","!noCurrentConfirmed","confirmation!=='ZERO '+deviceId","CAL_READY","180000"])
  assert.ok(s.includes(term),term);
});
test('read-only and legacy diagnostic commands remain accessible',()=>{
 assert.match(s,/send\('h'\)/);
 assert.match(s,/send\('d'\)/);
 assert.match(s,/send\('zc'\)/);
});
