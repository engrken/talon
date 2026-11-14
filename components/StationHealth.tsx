'use client';
import {useEffect,useState} from 'react';
import Troubleshooting from '@/components/Troubleshooting';
import {Activity,Wifi,WifiOff,Monitor,PlugZap,RefreshCw} from 'lucide-react';
type Channel='OK'|'CHECK'|'UNKNOWN'|'NO_INPUT';
type Mode='OPERATIONAL'|'EXPERIMENTAL'|'UNVERIFIED'|'NO_SUPPLY';
type Health={seen_at:string;firmware:string;uptime_seconds:number;wifi_rssi_dbm:number;lcd_initialized:boolean;sensor_verified:boolean;supply_present:boolean;sensor_fault:string;station_status:string;cloud_last_result:string;current_status?:Channel;voltage_status?:Channel;supply_mode?:Mode;low_current_estimate?:boolean;acs_vcc_monitor_enabled?:boolean;acs_vcc_healthy?:boolean;acs_vcc_v?:number};
type Event={received_at:string;firmware:string;uptime_seconds:number;wifi_rssi_dbm:number;lcd_initialized:boolean;sensor_verified:boolean;supply_present:boolean;sensor_fault:string;station_status:string;cloud_last_result:string;event_type:string;current_status?:Channel;voltage_status?:Channel;supply_mode?:Mode;low_current_estimate?:boolean};
type Result={rows:Event[];page:number;limit:number;total:number;pages:number};
function when(value?:string|null){return value?new Date(value).toLocaleString('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'}):'No report yet'}
function words(s:string){return String(s||'UNKNOWN').replaceAll('_',' ').toLowerCase()}
function bus(s:string){return s==='OK'?'Normal 12 V':s==='EXPERIMENTAL'?'Experimental 5 V':s==='LOW_USB_BUS'?'Low 12 V bus':s==='NO_SUPPLY'?'No supply':'Unverified reading'}
function displayChannel(s:Channel|undefined,legacy:string){
 if(s==='OK')return 'Signal valid';
 if(s==='CHECK')return 'Check sensor signal';
 if(s==='NO_INPUT')return 'No voltage input';
 return legacy==='OLD'?'Legacy report':s==='UNKNOWN'?'Not separately verified':'Awaiting diagnosis';
}
export default function StationHealth({health,lastSeen}:{health?:Health|null;lastSeen?:string|null}){
 const [page,setPage]=useState(1),[limit,setLimit]=useState(10),[now,setNow]=useState(Date.now());
 const [history,setHistory]=useState<Result>({rows:[],page:1,limit:10,total:0,pages:0}),[error,setError]=useState('');
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),5000);return()=>clearInterval(id)},[]);
 useEffect(()=>{let active=true;async function load(){try{const r=await fetch('/api/public/status-history?page='+page+'&limit='+limit,{cache:'no-store'});if(!r.ok)throw Error('History unavailable');const j=await r.json();if(active){setHistory(j);setError('')}}catch(e){if(active)setError(String(e))}}
 load();const id=setInterval(load,60000);return()=>{active=false;clearInterval(id)}},[page,limit]);
 const online=!!lastSeen&&now-new Date(lastSeen).getTime()<180000;
 const fresh=!!health?.seen_at&&now-new Date(health.seen_at).getTime()<180000;
 const h=online&&fresh?health:null;
 const fw=h?.firmware?.match(/^(\d+)\.(\d+)\./);
 const legacy=!!h&&(!fw||Number(fw[1])<5||(Number(fw[1])===5&&Number(fw[2])<6));
 const mode=h?.supply_mode || 'UNVERIFIED';
 const current=h?.current_status;
 const voltage=h?.voltage_status;
 return <section className="panel station-health" aria-label="Station health and historical status">
  <div className="panelheading"><div><span className="eyebrow">HARDWARE & CONNECTIVITY</span><h2>ESP32 and measured supply status</h2></div><span className="muted"><RefreshCw size={13}/> Last heartbeat: {when(health?.seen_at||lastSeen)}</span></div>
  <p className="fineprint">The ESP32 reports approximately every minute. Statuses are signal plausibility checks, not conclusive hardware self-tests. Equipment without sensors is excluded.</p>
  <div className="health-grid">
   <StatusCard icon={<Activity size={20}/>} label="ESP32 controller" value={online?'Online':'Offline / not reporting'} state={online?'good':'bad'} detail={h?'Firmware '+h.firmware+' · uptime '+Math.floor(h.uptime_seconds/60)+' minutes':'Waiting for authenticated heartbeat'}/>
   <StatusCard icon={online?<Wifi size={20}/>:<WifiOff size={20}/>} label="Internet / WebApp" value={online?'Cloud contact verified':'No recent cloud contact'} state={online?'good':'bad'} detail={h?'Wi-Fi RSSI '+h.wifi_rssi_dbm+' dBm · prior upload '+words(h.cloud_last_result):'Local Wi-Fi cannot be confirmed remotely'}/>
   <StatusCard icon={<Monitor size={20}/>} label="LCD display" value={!h?'Unknown':h.lcd_initialized?'Initialized':'Initialization failed'} state={!h?'unknown':h.lcd_initialized?'good':'bad'} detail="Local readings remain available when cloud access fails"/>
   <StatusCard icon={<Activity size={20}/>} label="Current sensor • ACS712" value={!h?'Unknown':displayChannel(current,legacy?'OLD':'NEW')} state={!h||!current||current==='UNKNOWN'?'unknown':current==='OK'?'good':'warn'} detail={legacy?'v5.6+ required for independent channel status':current==='CHECK'?'Check ACS712 zero, direction, ADC GPIO34, 5 V power':'Checks electrical plausibility; not precision at 1 mA'}/>
   <StatusCard icon={<Activity size={20}/>} label="Voltage sensor • 0–25 V" value={!h?'Unknown':displayChannel(voltage,legacy?'OLD':'NEW')} state={!h||!voltage||voltage==='UNKNOWN'?'unknown':voltage==='OK'?'good':'warn'} detail={voltage==='NO_INPUT'?'Supply off or measurement signal absent — not proof of damage':'Independent GPIO35 voltage-signal validation'}/>
   <StatusCard icon={<PlugZap size={20}/>} label="Supply mode" value={!h?'Unknown':legacy?bus(h.station_status):mode==='EXPERIMENTAL'?'Experimental • 5 V':mode==='OPERATIONAL'?'Operational • 12 V':bus(h.station_status)} state={!h||legacy?'unknown':mode==='EXPERIMENTAL'?'good':mode==='OPERATIONAL'?'good':'warn'} detail={mode==='EXPERIMENTAL'?'Intentional bench mode. Small current readings are estimates.':mode==='OPERATIONAL'?'Normal 12 V charging supply':'Advisory classification — verify using a multimeter'}/>
  </div>
  {h&&<div className="vcc-health-note"><strong>ACS712 sensor 5 V supply:</strong> {h.acs_vcc_monitor_enabled ? h.acs_vcc_healthy ? Number(h.acs_vcc_v||0).toFixed(3)+' V • compensation active' : 'CHECK sensor VCC / GPIO32 divider (out of range)' : 'Optional GPIO32 VCC sensing not enabled (existing calibration in use)'}<small>Load-bus 5 V or 12 V is separate from the ACS712 5 V sensor supply.</small></div>}
  <Troubleshooting health={h} online={online} lastSeen={lastSeen}/>
  <div className="panelheading health-history-title"><div><span className="eyebrow">STATUS AUDIT LOG</span><h2>Historical station status</h2></div><label className="history-controls">Rows <select aria-label="Status log page size" value={limit} onChange={e=>{setLimit(Number(e.target.value));setPage(1)}}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label></div>
  {error&&<p className="noticeline">{error}</p>}
  <div className="tablewrap"><table><thead><tr><th>Time (PHT)</th><th>Event</th><th>Supply mode</th><th>Current sensor</th><th>Voltage sensor</th><th>LCD</th><th>Wi-Fi RSSI</th><th>Firmware</th></tr></thead><tbody>
  {history.rows.map((r,i)=><tr key={r.received_at+i}><td>{when(r.received_at)}</td><td>{words(r.event_type)}</td><td><span className={'pill '+(['OK','EXPERIMENTAL'].includes(r.station_status)?'good':'warning')}>{r.supply_mode==='EXPERIMENTAL'?'Experimental 5 V':r.supply_mode==='OPERATIONAL'?'Operational 12 V':bus(r.station_status)}</span></td><td>{r.current_status&&r.current_status!=='UNKNOWN'?words(r.current_status):r.sensor_fault==='NEG_CURRENT'?'Negative current (legacy)':r.sensor_verified?'Legacy combined OK':'Not separately reported'}</td><td>{r.voltage_status&&r.voltage_status!=='UNKNOWN'?words(r.voltage_status):'Not separately reported'}</td><td>{r.lcd_initialized?'Initialized':'Init failed'}</td><td>{r.wifi_rssi_dbm} dBm</td><td>{r.firmware}</td></tr>)}
  {!history.rows.length&&<tr><td colSpan={8} className="tableempty">No status reports yet; logs begin after a compatible ESP32 heartbeat.</td></tr>}
  </tbody></table></div>
  <div className="pagination"><span>{history.total} records · Page {history.page} of {Math.max(1,history.pages)}</span><div><button type="button" disabled={page<=1} onClick={()=>setPage(v=>v-1)}>Previous</button><button type="button" disabled={page>=history.pages} onClick={()=>setPage(v=>v+1)}>Next</button></div></div>
 </section>
}
function StatusCard({icon,label,value,state,detail}:{icon:React.ReactNode;label:string;value:string;state:'good'|'warn'|'bad'|'unknown';detail:string}){return <div className={'health-card '+state}><div className="health-card-label">{icon}<span>{label}</span></div><strong>{value}</strong><small>{detail}</small></div>}
