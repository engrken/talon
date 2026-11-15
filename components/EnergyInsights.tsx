'use client';
import {useMemo} from 'react';
import {Activity,ArrowRight,BarChart3,BatteryCharging,Cloud,Database,Info,PlugZap,Radio,Server,Zap} from 'lucide-react';
import {CartesianGrid,Legend,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis,PieChart,Pie,Cell} from 'recharts';

type Reading={observed_at:string;volts:number;amps:number;watts:number;status:string};
type Health={supply_mode?:string;seen_at?:string};
type Hour={hour:number;label:string;samples:number;average:number|null;peak:number|null};
const pad=(x:number)=>String(x).padStart(2,'0');
function phtDate(stamp:string){return new Date(stamp).toLocaleDateString('sv-SE',{timeZone:'Asia/Manila'})}
function phtHour(stamp:string){return Number(new Date(stamp).toLocaleString('en-GB',{timeZone:'Asia/Manila',hour:'2-digit',hourCycle:'h23'}))}
const categories=[
 {key:'OK',label:'Operational samples',color:'#159a75'},
 {key:'EXPERIMENTAL',label:'Experimental samples',color:'#e2a445'},
 {key:'LOW_USB_BUS',label:'Low supply samples',color:'#d66d62'}
] as const;

export default function EnergyInsights({rows,selectedDate,todayDate,health}:{rows:Reading[];selectedDate:string;todayDate:string;health?:Health|null}){
 const hourly=useMemo<Hour[]>(()=>{
  const buckets=Array.from({length:24},(_,hour)=>({hour,label:pad(hour)+':00',samples:0,total:0,peak:0,average:null as number|null}));
  for(const r of rows){const h=phtHour(r.observed_at);if(!Number.isInteger(h)||h<0||h>23)continue;const watts=Number(r.watts);if(!Number.isFinite(watts)||watts<0)continue;const bucket=buckets[h];bucket.samples++;bucket.total+=watts;bucket.peak=Math.max(bucket.peak,watts)}
  return buckets.map(({hour,label,samples,total,peak})=>({hour,label,samples,average:samples?total/samples:null,peak:samples?peak:null}));
 },[rows]);
 const status=useMemo(()=>categories.map(c=>({...c,value:rows.filter(r=>r.status===c.key).length})).filter(c=>c.value>0),[rows]);
 const counted=status.reduce((n,c)=>n+c.value,0),other=Math.max(0,rows.length-counted);
 const series=[...status,...(other?[{key:'OTHER',label:'Other sample states',color:'#99aab0',value:other}]:[])];
 const total=series.reduce((n,x)=>n+x.value,0);
 const filled=hourly.filter(h=>h.samples>0).length;
 const currentHour=new Date().toLocaleString('en-GB',{timeZone:'Asia/Manila',hour:'2-digit',hourCycle:'h23'});
 const elapsed=selectedDate===todayDate?Math.min(24,Number(currentHour)+1):24;
 const hasData=rows.length>0;
 const mode=health?.supply_mode==='EXPERIMENTAL'?'5 V bench experiment':health?.supply_mode==='OPERATIONAL'?'12 V operational supply':'Measured DC input';
 return <section className="insights-section" id="visual-analytics" aria-label="Interactive charts and station infographics">
  <div className="insights-title"><div><span className="eyebrow">VISUAL ENERGY INTELLIGENCE</span><h2>Understand the charging activity</h2><p>Visual summaries of the selected day, created only from the cloud measurements received.</p></div><span className="insights-date"><BarChart3 size={16}/> {selectedDate} PHT</span></div>
  <div className="insights-grid">
   <article className="insight-card insight-profile">
    <div className="insight-card-head"><div><span className="eyebrow">HOURLY PROFILE</span><h3>Average vs peak power</h3></div><Activity size={19}/></div>
    <p>Compare the average sampled watts with the highest watt reading in each hour.</p>
    <div className="insight-chart" role="img" aria-label="Hourly average and peak sampled power in watts">{hasData?<ResponsiveContainer width="100%" height="100%"><LineChart data={hourly} margin={{top:12,right:12,left:-12,bottom:0}}><CartesianGrid stroke="#e6efe9" vertical={false}/><XAxis dataKey="label" tick={{fontSize:10,fill:'#668273'}} tickLine={false} axisLine={false} interval={3}/><YAxis width={47} tick={{fontSize:10,fill:'#668273'}} tickLine={false} axisLine={false} unit=" W"/><Tooltip formatter={(v:any,name:any)=>[Number(v).toFixed(2)+' W',name]} labelFormatter={(v:any)=>String(v)+' PHT'}/><Legend wrapperStyle={{fontSize:11}}/><Line dataKey="average" name="Sample average" stroke="#12916b" strokeWidth={2.6} dot={false} connectNulls={false} isAnimationActive={false}/><Line dataKey="peak" name="Sample peak" stroke="#e4a33a" strokeWidth={2.2} dot={false} connectNulls={false} isAnimationActive={false}/></LineChart></ResponsiveContainer>:<div className="insight-empty">No measurements for this day.</div>}</div>
    <small className="insight-caption">Averages are calculated from received samples, not continuously measured hourly energy.</small>
   </article>
   <article className="insight-card">
    <div className="insight-card-head"><div><span className="eyebrow">SAMPLE QUALITY</span><h3>24-hour reporting footprint</h3></div><Database size={19}/></div>
    <p>Each block represents an hour. Green blocks have cloud readings; blank hours have no received samples.</p>
    <div className="footprint-stat"><strong>{filled}<span> / {elapsed}</span></strong><span>elapsed hour buckets with data</span></div>
    <div className="hour-grid" aria-label="Hourly buckets containing cloud uploads">
     {hourly.map(h=>{const future=selectedDate===todayDate&&h.hour>=elapsed;return <div key={h.hour} className={'hour-cell '+(future?'future':h.samples?'received':'absent')} title={h.label+': '+(future?'hour not elapsed':h.samples?String(h.samples)+' samples':'no cloud samples')} aria-label={h.label+': '+(future?'future hour':h.samples?String(h.samples)+' uploaded samples':'no uploaded samples')}>{h.hour%4===0?<span>{pad(h.hour)}</span>:null}</div>})}
    </div>
    <div className="footprint-legend"><span><i className="sample-key received"/> Received</span><span><i className="sample-key absent"/> No data</span><span><i className="sample-key future"/> Not elapsed</span></div>
    <small className="insight-caption">This indicates uploaded data presence, not continuous station uptime. Missing periods do not imply zero electricity use.</small>
   </article>
   <article className="insight-card insight-status">
    <div className="insight-card-head"><div><span className="eyebrow">SUPPLY CONDITIONS</span><h3>Reported sample states</h3></div><Zap size={19}/></div>
    <p>The proportion of recorded measurements classified by the ESP32.</p>
    {total>0?<><div className="status-donut-wrap"><div className="status-donut" role="img" aria-label="Distribution of uploaded reading states"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={series} dataKey="value" nameKey="label" innerRadius={66} outerRadius={83} paddingAngle={3} strokeWidth={0} isAnimationActive={false}>{series.map(s=><Cell key={s.key} fill={s.color}/>)}</Pie><Tooltip formatter={(v:any,name:any)=>[String(v)+' readings',name]}/></PieChart></ResponsiveContainer><div className="donut-core"><strong>{total.toLocaleString('en-PH')}</strong><span>readings</span></div></div></div><div className="status-legend">{series.map(s=><div key={s.key}><i style={{background:s.color}}/><span>{s.label}</span><strong>{Math.round(s.value/total*100)}%</strong></div>)}</div></>:<div className="insight-empty">Supply-state proportions will appear after uploads.</div>}
    <small className="insight-caption">Percentages are shares of received samples—not hours of operation or time-weighted exposure.</small>
   </article>
  </div>
  <article className="energy-flow"><div className="energy-flow-heading"><div><span className="eyebrow">WHAT IS ACTUALLY MEASURED</span><h3>How charging data reaches the dashboard</h3></div><span className="flow-mode"><Radio size={14}/>{mode}</span></div>
   <div className="flow-steps"><div><span className="flow-icon"><BatteryCharging size={22}/></span><strong>DC source</strong><small>12 V operation or 5 V experiment</small></div><ArrowRight className="flow-arrow" size={20}/><div><span className="flow-icon"><Activity size={22}/></span><strong>Input sensors</strong><small>ACS712 and voltage sensing</small></div><ArrowRight className="flow-arrow" size={20}/><div><span className="flow-icon"><PlugZap size={22}/></span><strong>USB conversion</strong><small>4 modules, 8 charging outlets</small></div><ArrowRight className="flow-arrow" size={20}/><div><span className="flow-icon"><Cloud size={22}/></span><strong>ESP32 → cloud</strong><small>Aggregate DC supply readings</small></div></div>
   <div className="flow-foot"><span><Server size={15}/> Standalone physical DC meter is retained as an independent offline fallback.</span><span><Info size={15}/> Individual USB-port usage, battery charge and solar-panel production are not monitored.</span></div>
  </article>
 </section>;
}
