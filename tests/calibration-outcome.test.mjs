import test from 'node:test';
import assert from 'node:assert/strict';
import {calibrationOutcome} from '../lib/calibration-outcome.mjs';
test('actual v5.6.0-r8 success is classified as a save with the correct zero and backup',()=>{
 const result=calibrationOutcome('za','CAL_OK saved zero 810.57mV; backup 813.33mV. Verify readings under load before relying on power/Wh.');
 assert.deepEqual(result,{kind:'saved',savedMv:810.57,backupMv:813.33});
});
test('a successful pre-check does NOT mean that a zero was saved',()=>{
 assert.equal(calibrationOutcome('zc','CAL_READY reason=STABLE baseline_min_mV=809.50').kind,'precheck_ready');
 assert.equal(calibrationOutcome('za','CAL_READY reason=STABLE').kind,'other');
});
test('completed remote commands may still be calibration rejections',()=>{
 assert.equal(calibrationOutcome('za','CAL_REJECTED reason=ISOLATED_BURST_SPIKES').kind,'rejected');
 assert.equal(calibrationOutcome('zc','CAL_REJECTED reason=BASELINE_DRIFT').kind,'rejected');
});
test('unrecognized and wrong-command success patterns never claim zero was saved',()=>{
 assert.equal(calibrationOutcome('za','CAL_OK unknown action').kind,'other');
 assert.equal(calibrationOutcome('d','CAL_OK saved zero 810.57mV; backup 813.33mV.').kind,'other');
 assert.equal(calibrationOutcome('za','CAL_OK saved zero not-a-number mV; backup 813.33mV.').kind,'other');
 assert.equal(calibrationOutcome('za',null).kind,'other');
});
