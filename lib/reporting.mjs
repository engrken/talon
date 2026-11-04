// Reporting uses Philippine Standard Time (UTC+08:00, without DST).
// Four fixed-size windows avoid fetching hundreds of thousands of minute samples.
export const REPORT_PERIODS = Object.freeze(['day','week','month','year']);
const HOUR=3600000,DAY=24*HOUR,PHT=8*HOUR;
const pad=n=>String(n).padStart(2,'0');
const local=ms=>new Date(ms+PHT);
const localDate=ms=>local(ms).toISOString().slice(0,10);
const localHour=ms=>localDate(ms)+' '+pad(local(ms).getUTCHours())+':00';
const localMonth=ms=>localDate(ms).slice(0,7);
export function makeReportWindow(period,now=new Date()){
 if(!REPORT_PERIODS.includes(period))return null;
 const end=now.getTime();if(!Number.isFinite(end))return null;
 const atPht=local(end),y=atPht.getUTCFullYear(),m=atPht.getUTCMonth(),d=atPht.getUTCDate();
 const midnight=(yy,mm,dd)=>Date.UTC(yy,mm,dd)-PHT;
 let bucketTimes,grain,sqlFormat,description;
 if(period==='day'){
  const thisHour=Math.floor(end/HOUR)*HOUR;
  bucketTimes=Array.from({length:24},(_,i)=>thisHour-(23-i)*HOUR);
  grain='hour';sqlFormat='YYYY-MM-DD HH24:00';description='Last 24 hours';
 }else if(period==='week'){
  const start=midnight(y,m,d-6);
  bucketTimes=Array.from({length:7},(_,i)=>start+i*DAY);
  grain='day';sqlFormat='YYYY-MM-DD';description='Last 7 calendar days';
 }else if(period==='month'){
  const start=midnight(y,m,d-29);
  bucketTimes=Array.from({length:30},(_,i)=>start+i*DAY);
  grain='day';sqlFormat='YYYY-MM-DD';description='Last 30 calendar days';
 }else{
  bucketTimes=Array.from({length:12},(_,i)=>midnight(y,m-11+i,1));
  grain='month';sqlFormat='YYYY-MM';description='Last 12 calendar months';
 }
 const keyOf=grain==='hour'?localHour:grain==='month'?localMonth:localDate;
 const buckets=bucketTimes.map(ms=>({key:keyOf(ms),label:grain==='hour'?pad(local(ms).getUTCHours())+':00':grain==='month'?local(ms).toLocaleString('en-US',{month:'short',timeZone:'UTC'})+' '+local(ms).getUTCFullYear():pad(local(ms).getUTCMonth()+1)+'/'+pad(local(ms).getUTCDate())}));
 return {period,grain,sqlFormat,description,since:new Date(bucketTimes[0]).toISOString(),until:new Date(end).toISOString(),timezone:'Asia/Manila',buckets};
}
export function summarizeReport(window,rows){
 const byKey=new Map(rows.map(r=>[r.bucket,r]));
 let sumWh=0,maxWatts=0,weightedWatts=0,samples=0,cost=0,missingRateSamples=0,slots=0;
 const points=window.buckets.map(({key,label})=>{
  const r=byKey.get(key);
  if(!r||Number(r.samples)<1)return {key,label,energyKwh:null,peakWatts:null,avgWatts:null,costPhp:null,samples:0};
  const wh=Number(r.energy_wh),count=Number(r.samples),peak=Number(r.peak_watts),avg=Number(r.avg_watts),rated=Number(r.known_cost_php),missing=Number(r.unrated_samples);
  if(![wh,count,peak,avg,rated,missing].every(Number.isFinite))throw new Error('Invalid database aggregate');
  slots++;sumWh+=wh;maxWatts=Math.max(maxWatts,peak);weightedWatts+=avg*count;samples+=count;cost+=rated;missingRateSamples+=missing;
  return {key,label,energyKwh:wh/1000,peakWatts:peak,avgWatts:avg,costPhp:missing===0?rated:null,samples:count};
 });
 return {
  period:window.period,description:window.description,timezone:window.timezone,
  since:window.since,until:window.until,points,
  summary:{energyKwh:samples?sumWh/1000:null,peakWatts:samples?maxWatts:null,
   avgWatts:samples?weightedWatts/samples:null,costPhp:samples&&missingRateSamples===0?cost:null,
   samples,reportedSlots:slots,totalSlots:window.buckets.length,
   coveragePercent:Math.round(100*slots/window.buckets.length),missingRateSamples},
  notes:['Gaps mean no cloud readings received; offline intervals are not reconstructed.',
  'Energy is measured at the input of the USB converters, not solar production.',
  'Power average is a reading-weighted sample average, not a time-weighted average.',
  'Cost is estimated from saved monthly rates; missing rates are unavailable.',
  'Reported slots indicate data presence, not proven device uptime.']
 };
}
