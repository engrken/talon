'use client';
import StationHealth from '@/components/StationHealth';
import Reports from '@/components/Reports';
import EnergyInsights from '@/components/EnergyInsights';
import {useEffect,useMemo,useState} from 'react';
import {AreaChart,Area,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis,BarChart,Bar} from 'recharts';
import {Sun,Wifi,WifiOff,BatteryCharging,Activity,Zap,CalendarDays,Download,ArrowUpRight,RefreshCw,Server,ShieldCheck,TrendingUp,Clock3,ChevronLeft,ChevronRight,Info,Radio,PlugZap} from 'lucide-react';
type Reading={observed_at:string;volts:number;amps:number;watts:number;delta_wh:number;energy_wh:number;status:string;received_at?:string};
type Day={day:string;energy_wh:number;peak_watts:number;samples:number;cost_php:number|null;rate:number|null};
type Overview={device:null|{id:string;label:string;last_seen:string|null};latest:Reading|null;daily:Day[];rates:{billing_month:string;rate:number}[];health?:{seen_at?:string;sensor_verified:boolean;current_status?:string;voltage_status?:string;supply_mode?:string;low_current_estimate?:boolean}|null};
function phDate(d=new Date()){return d.toLocaleDateString('sv-SE',{timeZone:'Asia/Manila'})}
function clock(stamp:string){return new Date(stamp).toLocaleTimeString('en-PH',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit',hour12:false})}
function peso(n:number){return new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n)}
function age(stamp:string|null|undefined,now:number){if(!stamp)return 'No uploads yet';const seconds=Math.max(0,Math.floor((now-new Date(stamp).getTime())/1000));if(!Number.isFinite(seconds))return 'Time unavailable';if(seconds<60)return 'Less than a minute ago';if(seconds<3600)return Math.floor(seconds/60)+' min ago';if(seconds<86400)return Math.floor(seconds/3600)+' hr ago';return Math.floor(seconds/86400)+' days ago'}

export default function Dashboard(){
 const [overview,setOverview]=useState<Overview|null>(null);const [rows,setRows]=useState<Reading[]>([]);
 const [date,setDate]=useState(phDate());const [metric,setMetric]=useState<'watts'|'volts'|'amps'>('watts');const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [lastRefresh,setLastRefresh]=useState('');const [refreshKey,setRefreshKey]=useState(0);const [now,setNow]=useState(0);
 useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),10000);return()=>clearInterval(timer)},[]);
 function moveDate(days:number){const shifted=phDate(new Date(new Date(date+'T12:00:00+08:00').getTime()+days*86400000));if(shifted<=phDate())setDate(shifted)}
 useEffect(()=>{let active=true;async function load(){try{const r=await fetch('/api/public/overview',{cache:'no-store'});if(!r.ok)throw Error('Server returned '+r.status);const data=await r.json();if(active){setOverview(data);setError('');setLastRefresh(new Date().toLocaleTimeString('en-PH',{timeZone:'Asia/Manila'}));}}catch(e){if(active)setError(String(e))}finally{if(active)setLoading(false)}}load();const id=setInterval(load,20000);return()=>{active=false;clearInterval(id)}},[refreshKey]);
 useEffect(()=>{let active=true;async function load(){try{const r=await fetch('/api/public/history?date='+encodeURIComponent(date),{cache:'no-store'});if(!r.ok)throw Error('Unable to fetch history');const data=await r.json();if(active)setRows(data.rows||[])}catch{if(active)setRows([])}}load();const id=setInterval(load,30000);return()=>{active=false;clearInterval(id)}},[date,refreshKey]);
 const latest=overview?.latest;
 const health=overview?.health;
 const online=!!overview?.device?.last_seen&&now>0&&now-new Date(overview.device.last_seen).getTime()<180000;
 const freshSample=!!latest?.observed_at&&now>0&&now-new Date(latest.observed_at).getTime()<180000;
 const healthFresh=!!health?.seen_at&&now>0&&now-new Date(health.seen_at).getTime()<180000;
 const validVoltage=online&&freshSample&&!!latest&&(!healthFresh||(health?.voltage_status?health.voltage_status==='OK':health?.sensor_verified!==false));
 const validCurrent=online&&freshSample&&!!latest&&(!healthFresh||(health?.current_status?health.current_status==='OK':health?.sensor_verified!==false));
 const currentEstimate=healthFresh&&health?.supply_mode==='EXPERIMENTAL';
 const todayDate=phDate();
 const todayMs=new Date(todayDate+'T00:00:00+08:00').getTime();
 const dateKeys=Array.from({length:7},(_,i)=>phDate(new Date(todayMs-i*86400000)));
 const recentDays=(overview?.daily||[]).filter(v=>dateKeys.includes(v.day)&&Number(v.samples)>0);
 const totalWeek=recentDays.reduce((s,v)=>s+Number(v.energy_wh||0),0);
 const weekCost=recentDays.length&&recentDays.every(v=>v.cost_php!==null)?recentDays.reduce((s,v)=>s+Number(v.cost_php||0),0):null;
 const today=overview?.daily?.find(v=>v.day===todayDate);
 const todayWh=Number(today?.energy_wh||0);
 const todayHasData=Number(today?.samples||0)>0;
 const chartData=useMemo(()=>rows.map((r,i)=>({time:clock(r.observed_at),stamp:r.observed_at,watts:Number(r.watts),volts:Number(r.volts),amps:Number(r.amps),seq:i})),[rows]);
 const daily=Array.from({length:14},(_,i)=>{const day=phDate(new Date(todayMs-(13-i)*86400000));const sample=overview?.daily?.find(v=>v.day===day);return {day:day.slice(5),kwh:sample&&Number(sample.samples)>0?Number(sample.energy_wh)/1000:null}});
 const hasDaily=daily.some(v=>v.kwh!==null);
 const showLive=online&&freshSample;
 const stationMode=showLive&&healthFresh?(health?.supply_mode==='EXPERIMENTAL'?'Experimental • 5 V':health?.supply_mode==='OPERATIONAL'?'Operational • 12 V':'Supply mode unverified'):'Monitoring latest cloud reports';
 const chartUnits=metric==='watts'?'W':metric==='volts'?'V':'A';
 const selectedLabel=date===todayDate?'Today':new Date(date+'T12:00:00+08:00').toLocaleDateString('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium'});
 return <main className="page">
  <a href="#monitoring" className="skip-link">Skip to measurements</a>
  <header className="topnav"><a className="brand" href="/" aria-label="Barangay Talon dashboard home"><img className="brand-logo" src="/talon-logo.svg" alt="Barangay Talon Solar Charging Station" width="250" height="58"/></a>
   <nav className="navright" aria-label="Main navigation"><a className="navlink section-link" href="#monitoring">Monitoring</a><a className="navlink section-link" href="#visual-analytics">Insights</a><a className="navlink section-link" href="#reports">Reports</a><a className="navlink section-link" href="#health">Station health</a><a className="navlink" href="/guide">Help <ArrowUpRight size={14}/></a><a className="navlink admin-nav" href="/admin">Admin <ArrowUpRight size={14}/></a></nav></header>
  <section className="hero"><div className="hero-copy"><div className="eyebrow">BARANGAY TALON <span className="point"/> PUBLIC ENERGY MONITORING</div><h1>Charging station <span>overview</span></h1><p>Understand the station's measured electrical supply, review energy trends, and see when the ESP32 last reported to the cloud.</p><div className="hero-meta"><span><Radio size={15}/> ESP32-powered monitoring</span><span><Clock3 size={15}/> Philippine Standard Time (UTC+8)</span></div></div>
   <div className={'statusbox '+(showLive?'active':'inactive')} role="status" aria-live="polite"><div className="statusicon">{showLive?<Wifi size={24}/>:<WifiOff size={24}/>}</div><div><strong>{loading&&!overview?'Checking station…':!overview?.device?'Station not configured':showLive?'Receiving recent readings':online?'No recent measurement':'No recent cloud contact'}</strong><small>{age(overview?.device?.last_seen,now)}</small><span className="statusmode">{stationMode}</span></div></div>
  </section>
  <div className="dashboard-toolbar"><div><span className={'live-indicator '+(showLive?'is-live':'')}>{showLive?'RECENT DATA':'HISTORICAL / UNAVAILABLE'}</span><span className="toolbar-date">Last cloud refresh: {lastRefresh||'Checking…'}</span></div><button className="refresh-button" type="button" onClick={()=>setRefreshKey(v=>v+1)} aria-label="Refresh station data"><RefreshCw size={15}/> Refresh data</button></div>
  {error&&<div className="notice">Could not retrieve the cloud data: {error}</div>}
  {!loading&&!overview?.device&&<div className="notice">No station has been provisioned yet. Deploy the database and register the ESP32 through the <a href="/admin">administrator page</a>. The dashboard will update after the first upload.</div>}
  <section className="stats" aria-label="Key station statistics">
   <Metric icon={<Zap size={19}/>} label="Charging power" value={validVoltage&&validCurrent?Number(latest!.watts).toFixed(2)+' W':'—'} foot="Instantaneous measured converter input power"/>
   <Metric icon={<PlugZap size={19}/>} label="Supply voltage" value={validVoltage?Number(latest!.volts).toFixed(2)+' V':'—'} foot={validVoltage?'Measured at converter input':'Awaiting verified voltage reading'}/>
   <Metric icon={<Activity size={19}/>} label="Charging current" value={validCurrent?Number(latest!.amps).toFixed(3)+' A':'—'} foot={validCurrent?(currentEstimate?'Low-current values are estimates':'Measured aggregate current'):'Current sensor data not verified'}/>
   <Metric icon={<BatteryCharging size={19}/>} label="Energy today" value={todayHasData?(todayWh/1000).toFixed(3)+' kWh':'No data'} foot={todayHasData?Number(today!.samples).toLocaleString('en-PH')+' cloud readings recorded':'Awaiting cloud measurements today'}/>
   <Metric icon={<TrendingUp size={19}/>} label="Peak power today" value={todayHasData&&today?.peak_watts!=null?Number(today.peak_watts).toFixed(1)+' W':'—'} foot="Highest cloud sample recorded today"/>
   <Metric icon={<Sun size={19}/>} label="Today's cost equivalent" value={!todayHasData?'No data':today?.cost_php!=null?peso(Number(today.cost_php)):'Rate not set'} foot={today?.rate!=null?'Estimated at ₱'+Number(today.rate).toFixed(2)+'/kWh':'Estimated grid equivalent, not savings'}/>
  </section>
  <section className="insight-strip" aria-label="Recent usage context">
   <div><span>Last 7 calendar days</span><strong>{recentDays.length?(totalWeek/1000).toFixed(3)+' kWh':'No cloud data'}</strong><small>{recentDays.length} of 7 days have measurements</small></div>
   <div><span>7-day grid cost equivalent</span><strong>{weekCost===null?'Not available':peso(weekCost)}</strong><small>Requires rates for all recorded readings</small></div>
   <div><span>Latest measurement</span><strong>{latest?.observed_at?age(latest.observed_at,now):'Not available'}</strong><small>{showLive?'Verified recent cloud sample':'Past readings may not reflect current load'}</small></div>
  </section>
  <section className="middlegrid" id="monitoring"><article className="panel large"><div className="panelheading"><div><span className="eyebrow">MEASUREMENT HISTORY</span><h2>Charging performance</h2></div><div className="actions date-actions"><button className="date-step" type="button" onClick={()=>moveDate(-1)} aria-label="Previous day"><ChevronLeft size={16}/></button><input aria-label="Select measurement date" type="date" max={todayDate} value={date} onChange={e=>setDate(e.target.value)}/><button className="date-step" type="button" onClick={()=>moveDate(1)} disabled={date>=todayDate} aria-label="Next day"><ChevronRight size={16}/></button><a className="action" href={'/api/public/export?date='+encodeURIComponent(date)} title="Download selected day's measurements"><Download size={15}/> CSV</a></div></div>
   <div className="chart-subheading"><span>{selectedLabel} · {rows.length.toLocaleString('en-PH')} readings</span><span className="muted">Cloud-received measurements only</span></div>
   <div className="tabs" role="group" aria-label="Measurement to chart">{(['watts','volts','amps'] as const).map(v=><button key={v} type="button" aria-pressed={metric===v} className={metric===v?'selected':''} onClick={()=>setMetric(v)}>{v==='watts'?'Power (W)':v==='volts'?'Voltage (V)':'Current (A)'}</button>)}</div>
   <div className="chartwrap" role="img" aria-label={'Measured '+metric+' over time for '+selectedLabel}>{chartData.length?<ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{top:8,right:8,left:-8,bottom:0}}><defs><linearGradient id="powerGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#16976e" stopOpacity={0.24}/><stop offset="100%" stopColor="#16976e" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#e8eeeb" vertical={false}/><XAxis dataKey="time" tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#71837b'}} minTickGap={35}/><YAxis tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#71837b'}} width={48}/><Tooltip labelFormatter={(_,payload)=>payload?.[0]?.payload?.stamp?new Date(payload[0].payload.stamp).toLocaleString('en-PH',{timeZone:'Asia/Manila'}):''} formatter={(v:any)=>[Number(v).toFixed(metric==='amps'?3:2)+' '+chartUnits,metric==='watts'?'Power':metric==='volts'?'Voltage':'Current']}/><Area type="monotone" dataKey={metric} stroke="#138c6b" strokeWidth={2.6} dot={false} fill="url(#powerGradient)" isAnimationActive={false}/></AreaChart></ResponsiveContainer>:<div className="empty">No cloud readings for this date. Try another day or check the station connection.</div>}</div>
   <p className="fineprint">Time is shown in Philippine Standard Time. A missing sample is not proof of zero usage; missed offline minutes are not reconstructed.</p></article>
   <article className="panel"><div className="panelheading"><div><span className="eyebrow">DAILY ENERGY</span><h2>Last 14 calendar days</h2></div><CalendarDays color="#66877a" size={19}/></div>
   <div className="chartwrap smaller">{hasDaily?<ResponsiveContainer width="100%" height="100%"><BarChart data={daily} margin={{top:8,right:8,left:-6,bottom:0}}><CartesianGrid stroke="#e8eeeb" vertical={false}/><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{fontSize:10,fill:'#71837b'}} minTickGap={12}/><YAxis tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#71837b'}} width={43}/><Tooltip formatter={(v:any)=>[Number(v).toFixed(4)+' kWh','Recorded energy']}/><Bar dataKey="kwh" fill="#198a6e" radius={[5,5,0,0]} maxBarSize={28} isAnimationActive={false}/></BarChart></ResponsiveContainer>:<div className="empty">Energy trends will appear after measurements are uploaded.</div>}</div>
   <div className="chart-note"><Info size={16}/><span>Missing days are left blank—not treated as zero consumption.</span></div>
   <div className="totalstrip"><div><span>Last 7 days recorded</span><strong>{recentDays.length?(totalWeek/1000).toFixed(3)+' kWh':'No data'}</strong></div><div><span>Days with data</span><strong>{recentDays.length} / 7</strong></div></div></article></section>
  <EnergyInsights rows={rows} selectedDate={date} todayDate={todayDate} health={health}/>
  <div id="health"><StationHealth health={overview?.health as any} lastSeen={overview?.device?.last_seen}/></div>
  <Reports/>
  <section className="panel logs" id="records"><div className="panelheading"><div><span className="eyebrow">MEASUREMENT AUDIT TRAIL</span><h2>Recent measurement logs</h2></div><span className="muted"><RefreshCw size={13}/> {rows.length} entries on {date}</span></div><div className="tablewrap"><table><thead><tr><th>Time (PHT)</th><th>Voltage</th><th>Current</th><th>Power</th><th>Energy delta</th><th>Supply status</th></tr></thead><tbody>{[...rows].reverse().slice(0,20).map((r,i)=><tr key={r.observed_at+i}><td>{clock(r.observed_at)}</td><td>{Number(r.volts).toFixed(2)} V</td><td>{Number(r.amps).toFixed(3)} A</td><td>{Number(r.watts).toFixed(2)} W</td><td>{Number(r.delta_wh).toFixed(3)} Wh</td><td><span className={'pill '+(['OK','EXPERIMENTAL'].includes(r.status)?'good':'warning')}>{r.status.replaceAll('_',' ')}</span></td></tr>)}{!rows.length&&<tr><td className="tableempty" colSpan={6}>No recorded measurements on the selected date.</td></tr>}</tbody></table></div><p className="fineprint">Showing up to 20 most recent rows for the selected date. Use CSV export in the performance chart for the full available day (up to 1,500 readings).</p></section>
  <footer><div><Server size={16}/> Barangay Talon Solar Charging Station • ESP32 monitoring</div><p>Voltage, current, power and energy describe the monitored DC supply to the USB converters, including intentional 5 V experimental testing. These values are not PV generation, battery state of charge, individual USB-port consumption, or verified electricity-bill savings. A separate physical DC meter remains an offline fallback.</p></footer>
 </main>
}
function Metric({icon,label,value,foot}:{icon:React.ReactNode,label:string,value:string,foot:string}){return <div className="metriccard"><div className="metricicon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{foot}</small></div>}
