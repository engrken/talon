import test from 'node:test';
import assert from 'node:assert/strict';
import {makeReportWindow,summarizeReport} from '../lib/reporting.mjs';
const now=new Date('2026-11-04T14:42:30Z');
for(const [period,size] of [['day',24],['week',7],['month',30],['year',12]]){
 test(period+' has '+size+' bounded slots',()=>{
  const w=makeReportWindow(period,now);
  assert.equal(w.buckets.length,size);assert.equal(new Set(w.buckets.map(b=>b.key)).size,size);
  assert.equal(w.timezone,'Asia/Manila');assert.equal(w.until,now.toISOString());
 });
}
test('invalid period refused',()=>assert.equal(makeReportWindow('forever',now),null));
test('24 hour labels in Manila',()=>{
 const w=makeReportWindow('day',now);
 assert.equal(w.buckets[23].key,'2026-11-04 22:00');
 assert.equal(w.buckets[0].key,'2026-11-03 23:00');
});
test('year window crosses Manila year correctly',()=>{
 const w=makeReportWindow('year',new Date('2027-01-01T00:10:00Z'));
 assert.equal(w.buckets[11].key,'2027-01');assert.equal(w.buckets[0].key,'2026-02');
});
test('missing bucket is not faked zero energy',()=>{
 const w=makeReportWindow('week',now),s=summarizeReport(w,[]);
 assert.equal(s.summary.energyKwh,null);assert.equal(s.summary.reportedSlots,0);
 assert.equal(s.points[0].energyKwh,null);
});
test('missing rate means total cost unavailable',()=>{
 const w=makeReportWindow('day',now);
 const s=summarizeReport(w,[{bucket:w.buckets[0].key,energy_wh:1000,samples:10,peak_watts:30,avg_watts:15,known_cost_php:11,unrated_samples:0},{bucket:w.buckets[1].key,energy_wh:2000,samples:20,peak_watts:50,avg_watts:25,known_cost_php:0,unrated_samples:2}]);
 assert.equal(s.summary.energyKwh,3);assert.equal(s.summary.peakWatts,50);
 assert.equal(s.summary.avgWatts,(15*10+25*20)/30);
 assert.equal(s.summary.costPhp,null);assert.equal(s.summary.reportedSlots,2);
});
test('complete cost and energy calculated correctly',()=>{
 const w=makeReportWindow('day',now);
 const s=summarizeReport(w,[{bucket:w.buckets[0].key,energy_wh:250,samples:15,peak_watts:60,avg_watts:20,known_cost_php:3.25,unrated_samples:0}]);
 assert.equal(s.summary.costPhp,3.25);assert.equal(s.summary.energyKwh,0.25);
});
