import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../components/RemoteConsole.tsx',import.meta.url),'utf8');
test('a failed save consumes its previously passing pre-check, despite a remaining 3-minute time window',()=>{
 assert.match(code,/new Date\(latestSave\.requested_at\)\.getTime\(\)>=preflightTime/);
 assert.match(code,/preflightReady=preflightFresh&&!preflightConsumed/);
 assert.match(code,/zeroActionRejected/);
 assert.match(code,/Save attempt rejected/);
 assert.match(code,/A fresh CAL_READY result is required/);
});
test('no saved-calibration success claim for rejected commands',()=>{
 assert.match(code,/zeroActionIsSaved/);
 assert.match(code,/CAL_SAVED/);
 assert.match(code,/The old zero was not overwritten/);
});
