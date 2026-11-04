'use client';
import {useEffect,useState} from 'react';
import {Activity,BarChart3,CalendarDays,Download,LineChart as TrendIcon,RefreshCw,Wallet,WifiOff} from 'lucide-react';
import {ResponsiveContainer,BarChart,Bar,LineChart,Line,CartesianGrid,XAxis,YAxis,Tooltip} from 'recharts';
type Period='day'|'week'|'month'|'year';
type Point={key:string;label:string;energyKwh:number|null;peakWatts:number|null;avgWatts:number|null;costPhp:number|null;samples:number};
type Report={period:Period;description:string;timezone:string;since:string;until:string;points:Point[];summary:{energyKwh:number|null;peakWatts:number|null;avgWatts:number|null;costPhp:number|null;samples:number;reportedSlots:number;totalSlots:number;coveragePercent:number;missingRateSamples:number};notes:string[];device:null|{id:string;label:string}};
const ranges:{period:Period;label:string}[]=[{period:'day',label:'Daily (24 hrs)'},{period:'week',label:'Weekly'},{period:'month',label:'Monthly'},{period:'year',label:'Yearly'}];
const fmt=(v:number|null,decimals=2)=>v===null?'—':new Intl.NumberFormat('en-PH',{minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(v);
const php=(v:number|null)=>v===null?'Not available':new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(v);
function exportCsv(r:Report){
 const header=['Period (PHT)','Energy (kWh)','Avg sampled power (W)','Peak power (W)','Estimated cost (PHP)','Reading count'];
 const data=r.points.map(p=>[p.key,p.energyKwh??'',p.avgWatts??'',p.peakWatts??'',p.costPhp??'',p.samples]);
 const csv=[header,...data].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='Talon-report-'+r.period+'-'+new Date().toISOString().slice(0,10)+'.csv';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),5000);
}
export default function Reports(){
 const [period,setPeriod]=useState<Period>('day');
 const [report,setReport]=useState<Report|null>(null);
 const [error,setError]=useState(''),[loading,setLoading]=useState(true),[updated,setUpdated]=useState('');
 useEffect(()=>{
  let active=true;
  async function load(){
   try{
    const r=await fetch('/api/public/report?period='+period,{cache:'no-store'});
    if(!r.ok)throw Error('Report endpoint returned '+r.status);
    const j=await r.json() as Report;
    if(active){setReport(j);setError('');setUpdated(new Date().toLocaleTimeString('en-PH',{timeZone:'Asia/Manila'}));}
   }catch(e){if(active){setError(String(e));setReport(null);}}
   finally{if(active)setLoading(false)}
  }
  setLoading(true);setReport(null);load();
  const id=setInterval(load,60000);
  return()=>{active=false;clearInterval(id)};
 },[period]);
 const data=report?.points||[],s=report?.summary,hasData=!!s&&s.samples>0;
 return <section className="panel reports-panel" id="reports" aria-label="Solar charging energy reports">
  <div className="panelheading"><div><span className="eyebrow">ENERGY & CONSUMPTION REPORTS</span><h2>Usage analytics</h2></div>
   <div className="actions"><span className="muted"><RefreshCw size={13}/> {updated||'Waiting for report'}</span>
   <button className="action" type="button" disabled={!report||!hasData} onClick={()=>report&&exportCsv(report)}><Download size={15}/> Export CSV</button></div></div>
  <p className="fineprint">Reports use cloud readings only. All periods and monthly rates follow Philippine Standard Time (Asia/Manila). Missing measurements are never invented.</p>
  <div className="report-tabs" role="group" aria-label="Report period">{ranges.map(x=><button type="button" key={x.period} className={period===x.period?'selected':''} aria-pressed={period===x.period} onClick={()=>setPeriod(x.period)}>{x.label}</button>)}</div>
  {error&&<p className="notice" role="alert">Could not load this report: {error}. Refresh the page or check internet access.</p>}
  {loading&&<p className="muted">Loading {ranges.find(x=>x.period===period)?.label.toLowerCase()} report…</p>}
  {report&&<>
   <p className="report-caption">{report.description} · Last updated {updated} PHT · {report.device?.label||'No registered station'}</p>
   <div className="report-kpis">
    <ReportKpi icon={<BarChart3 size={19}/>} title="Energy reported" value={hasData?fmt(s!.energyKwh,3)+' kWh':'No readings'} detail="Measured charging supply energy"/>
    <ReportKpi icon={<Wallet size={19}/>} title="Grid cost equivalent" value={hasData?php(s!.costPhp):'No readings'} detail={s!.missingRateSamples?'Rate missing for some readings':'Estimated at saved monthly PHP/kWh rate'}/>
    <ReportKpi icon={<Activity size={19}/>} title="Peak charging power" value={hasData?fmt(s!.peakWatts,1)+' W':'—'} detail={hasData?'Sample average: '+fmt(s!.avgWatts,1)+' W':'Awaiting readings'}/>
    <ReportKpi icon={<CalendarDays size={19}/>} title="Reporting coverage" value={s!.reportedSlots+'/'+s!.totalSlots+' slots'} detail={s!.coveragePercent+'% of time buckets contain readings (not uptime)'}/>
   </div>
   <div className="report-coverage"><div className="report-coverage-head"><span>Data received across {s!.totalSlots} time buckets</span><strong>{s!.coveragePercent}%</strong></div><div className="report-meter" role="meter" aria-valuenow={s!.coveragePercent} aria-valuemin={0} aria-valuemax={100} aria-label="Reporting coverage percentage"><div style={{width:s!.coveragePercent+'%'}}/></div><small>{s!.samples.toLocaleString('en-PH')} readings · Missing periods are shown as gaps, not zero consumption</small></div>
   {hasData?<div className="report-chart-grid">
    <article className="report-chart"><div className="report-chart-title"><BarChart3 size={18}/><strong>Energy consumption</strong><span>kWh per {period==='day'?'hour':period==='year'?'month':'day'}</span></div><div className="report-chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{top:10,right:10,bottom:0,left:0}}><CartesianGrid stroke="#e4ece7" vertical={false}/><XAxis dataKey="label" tick={{fontSize:10}} minTickGap={17}/><YAxis tick={{fontSize:11}} width={48}/><Tooltip formatter={(v:any)=>[Number(v).toFixed(4)+' kWh','Energy']}/><Bar dataKey="energyKwh" fill="#218c70" maxBarSize={24} radius={[3,3,0,0]} isAnimationActive={false}/></BarChart></ResponsiveContainer></div></article>
    <article className="report-chart"><div className="report-chart-title"><TrendIcon size={18}/><strong>Charging power trend</strong><span>Sampled peak watts</span></div><div className="report-chart-area"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{top:10,right:10,bottom:0,left:0}}><CartesianGrid stroke="#e4ece7" vertical={false}/><XAxis dataKey="label" tick={{fontSize:10}} minTickGap={17}/><YAxis tick={{fontSize:11}} width={42}/><Tooltip formatter={(v:any)=>[Number(v).toFixed(2)+' W','Peak power']}/><Line type="monotone" dataKey="peakWatts" stroke="#e5a23c" strokeWidth={2.5} dot={period==='year'} connectNulls={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></div></article>
   </div>:<div className="report-empty"><WifiOff size={25}/><strong>No cloud measurements received for this period</strong><span>Check the ESP32 connection, or select another reporting period.</span></div>}
   <div className="report-tablewrap"><table><thead><tr><th>Time bucket (PHT)</th><th>Energy (kWh)</th><th>Peak (W)</th><th>Est. cost (PHP)</th><th>Readings</th></tr></thead><tbody>{data.map(p=><tr key={p.key}><td>{p.key}</td><td>{p.energyKwh===null?'No data':fmt(p.energyKwh,4)}</td><td>{fmt(p.peakWatts,2)}</td><td>{p.samples?php(p.costPhp):'—'}</td><td>{p.samples||'—'}</td></tr>)}</tbody></table></div>
   <p className="fineprint">Reported slots indicate at least one upload received; they do not prove device uptime. A missing slot does not mean zero energy use. Cost is an estimate, not monetary savings. Offline minute-level readings are not reconstructed.</p>
  </>}
 </section>;
}
function ReportKpi({icon,title,value,detail}:{icon:React.ReactNode;title:string;value:string;detail:string}){return <article className="report-kpi"><div className="report-kpi-title">{icon}<span>{title}</span></div><strong>{value}</strong><small>{detail}</small></article>}
