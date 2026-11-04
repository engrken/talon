
'use client';
import {useEffect,useState} from 'react';
import {Activity,Cloud,HardDrive,Wifi,WifiOff,Monitor,PlugZap,RefreshCw} from 'lucide-react';
type Health={seen_at:string;firmware:string;uptime_seconds:number;free_heap_bytes:number;wifi_connected:boolean;wifi_rssi_dbm:number;lcd_initialized:boolean;sensor_verified:boolean;supply_present:boolean;sensor_fault:string;station_status:string;cloud_last_result:string};
type Event={received_at:string;firmware:string;uptime_seconds:number;wifi_rssi_dbm:number;lcd_initialized:boolean;sensor_verified:boolean;supply_present:boolean;sensor_fault:string;station_status:string;cloud_last_result:string;event_type:string};
type Result={rows:Event[];page:number;limit:number;total:number;pages:number};
function when(value?:string|null){return value?new Date(value).toLocaleString('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'}):'No report yet'}
function words(s:string){return s.replaceAll('_',' ').toLowerCase()}
function bus(s:string){return s==='OK'?'Normal':s==='LOW_USB_BUS'?'Low 12 V bus':s==='NO_SUPPLY'?'No supply':'Unverified sensor'}
export default function StationHealth({health,lastSeen}:{health?:Health|null;lastSeen?:string|null}){
 const [page,setPage]=useState(1),[limit,setLimit]=useState(10),[now,setNow]=useState(Date.now());
 const [history,setHistory]=useState<Result>({rows:[],page:1,limit:10,total:0,pages:0}),[error,setError]=useState('');
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),5000);return()=>clearInterval(id)},[]);
 useEffect(()=>{let active=true;async function load(){try{const r=await fetch('/api/public/status-history?page='+page+'&limit='+limit,{cache:'no-store'});if(!r.ok)throw Error('History unavailable');const j=await r.json();if(active){setHistory(j);setError('')}}catch(e){if(active)setError(String(e))}}
 load();const id=setInterval(load,60000);return()=>{active=false;clearInterval(id)}},[page,limit]);
 const online=!!lastSeen&&now-new Date(lastSeen).getTime()<180000;
 const fresh=!!health?.seen_at&&now-new Date(health.seen_at).getTime()<180000;
 const h=online&&fresh?health:null;
 return <section className="panel station-health" aria-label="Station health and historical status">
  <div className="panelheading"><div><span className="eyebrow">HARDWARE & CONNECTIVITY</span><h2>Station health and equipment status</h2></div><span className="muted"><RefreshCw size={13}/> Last heartbeat: {when(health?.seen_at||lastSeen)}</span></div>
  <p className="fineprint">ESP32 uploads every 60 seconds. After three minutes without contact the dashboard marks it offline. It cannot directly inspect disconnected equipment; uninstrumented modules and ports are not reported as healthy.</p>
  <div className="health-grid">
   <StatusCard icon={<Activity size={20}/>} label="ESP32 controller" value={online?'Online':'Offline / not reporting'} state={online?'good':'bad'} detail={h?'Firmware '+h.firmware+' · uptime '+Math.floor(h.uptime_seconds/60)+' minutes':'Waiting for authenticated heartbeat'}/>
   <StatusCard icon={online?<Wifi size={20}/>:<WifiOff size={20}/>} label="Internet / cloud" value={online?'Cloud reachable':'No recent cloud contact'} state={online?'good':'bad'} detail={h?'Wi-Fi RSSI '+h.wifi_rssi_dbm+' dBm · prior upload '+words(h.cloud_last_result):'Wi-Fi status unknown while offline'}/>
   <StatusCard icon={<Monitor size={20}/>} label="LCD display" value={!h?'Unknown':h.lcd_initialized?'Initialized':'Initialization failed'} state={!h?'unknown':h.lcd_initialized?'good':'bad'} detail="16 × 2 LCD shows local status when cloud access fails"/>
   <StatusCard icon={<Activity size={20}/>} label="ACS712 and voltage sensors" value={!h?'Unknown':h.sensor_verified?'Verified reading':h.station_status==='NO_SUPPLY'?'No supply':'Unverified reading'} state={!h?'unknown':h.sensor_verified?'good':'warn'} detail={h?'Diagnostic: '+words(h.sensor_fault):'No fresh sensor diagnosis'}/>
   <StatusCard icon={<PlugZap size={20}/>} label="12 V charging supply" value={!h?'Unknown':bus(h.station_status)} state={!h?'unknown':h.station_status==='OK'?'good':'warn'} detail="Advisory bus measurement, not a protective disconnect"/>
   <StatusCard icon={<HardDrive size={20}/>} label="Solar panel, controller and battery" value="Not independently monitored" state="unknown" detail="No PV production, battery SOC, or charge-controller instrumentation"/>
   <StatusCard icon={<PlugZap size={20}/>} label="Four USB charging modules" value="Unmonitored" state="unknown" detail="Aggregate current does not identify a failed module"/>
   <StatusCard icon={<PlugZap size={20}/>} label="Eight USB charging ports" value="Unmonitored" state="unknown" detail="Port-level status requires additional sensors"/>
   <StatusCard icon={<Cloud size={20}/>} label="Physical DC energy meter" value="Independent fallback" state="unknown" detail="Remains available locally without Wi-Fi or ESP32"/>
  </div>
  <div className="panelheading health-history-title"><div><span className="eyebrow">STATUS AUDIT LOG</span><h2>Historical station status</h2></div><label className="history-controls">Rows <select aria-label="Status log page size" value={limit} onChange={e=>{setLimit(Number(e.target.value));setPage(1)}}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label></div>
  {error&&<p className="noticeline">{error}</p>}
  <div className="tablewrap"><table><thead><tr><th>Time (PHT)</th><th>Event</th><th>Station</th><th>Sensor</th><th>LCD</th><th>Wi-Fi RSSI</th><th>Firmware</th></tr></thead><tbody>
  {history.rows.map((r,i)=><tr key={r.received_at+i}><td>{when(r.received_at)}</td><td>{words(r.event_type)}</td><td><span className={'pill '+(r.station_status==='OK'?'good':'warning')}>{bus(r.station_status)}</span></td><td>{r.sensor_verified?'Verified':words(r.sensor_fault)}</td><td>{r.lcd_initialized?'Initialized':'Init failed'}</td><td>{r.wifi_rssi_dbm} dBm</td><td>{r.firmware}</td></tr>)}
  {!history.rows.length&&<tr><td colSpan={7} className="tableempty">No status reports yet; logs begin after a v5.3.0 firmware upload.</td></tr>}
  </tbody></table></div>
  <div className="pagination"><span>{history.total} records · Page {history.page} of {Math.max(1,history.pages)}</span><div><button type="button" disabled={page<=1} onClick={()=>setPage(v=>v-1)}>Previous</button><button type="button" disabled={page>=history.pages} onClick={()=>setPage(v=>v+1)}>Next</button></div></div>
 </section>
}
function StatusCard({icon,label,value,state,detail}:{icon:React.ReactNode;label:string;value:string;state:'good'|'warn'|'bad'|'unknown';detail:string}){return <div className={'health-card '+state}><div className="health-card-label">{icon}<span>{label}</span></div><strong>{value}</strong><small>{detail}</small></div>}
