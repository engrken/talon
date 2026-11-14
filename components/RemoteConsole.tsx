'use client';
import {useCallback,useEffect,useState} from 'react';
import {Activity,Cloud,RefreshCw,ShieldCheck,Terminal} from 'lucide-react';
type Entry={id:number;command:'h'|'d';state:string;requested_at:string;completed_at:string|null;output:string|null};
export default function RemoteConsole({adminKey}:{adminKey:string}){
 const [devices,setDevices]=useState<{id:string;label:string;last_seen:string|null}[]>([]);
 const [deviceId,setDeviceId]=useState('');
 const [verifiedKey,setVerifiedKey]=useState('');
 const [entries,setEntries]=useState<Entry[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const verified=!!adminKey&&verifiedKey===adminKey;
 useEffect(()=>{setVerifiedKey('');setDevices([]);setDeviceId('');setEntries([])},[adminKey]);
 const load=useCallback(async(key:string,id:string)=>{
  if(!key||!id)return;
  try{
   const r=await fetch('/api/admin/commands?deviceId='+encodeURIComponent(id),{headers:{'x-admin-key':key},cache:'no-store'});
   const j=await r.json();if(!r.ok)throw Error(j.error||'Unable to retrieve commands');
   setEntries(j.rows||[]);setError('');
  }catch(e){setError(String(e))}
 },[]);
 useEffect(()=>{
  if(!verified||!deviceId)return;
  void load(adminKey,deviceId);
  const timer=setInterval(()=>void load(adminKey,deviceId),12000);
  return()=>clearInterval(timer);
 },[verified,adminKey,deviceId,load]);
 async function verify(){
  if(!adminKey.trim())return;
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/admin/devices',{headers:{'x-admin-key':adminKey},cache:'no-store'});
   const j=await r.json();if(!r.ok)throw Error(j.error||'Administrator token invalid');
   const options=j.devices||[];
   setDevices(options);setDeviceId(options[0]?.id||'');setVerifiedKey(adminKey);
  }catch(e){setError(String(e))}finally{setBusy(false)}
 }
 async function send(command:'h'|'d'){
  if(!verified||!deviceId||busy)return;
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/admin/commands',{method:'POST',
    headers:{'x-admin-key':adminKey,'Content-Type':'application/json'},
    body:JSON.stringify({deviceId,command}),cache:'no-store'});
   const j=await r.json();if(!r.ok)throw Error(j.error||'Command rejected');
   await load(adminKey,deviceId);
  }catch(e){setError(String(e))}finally{setBusy(false)}
 }
 const pending=entries.some(e=>['QUEUED','CLAIMED'].includes(e.state));
 return <section className="panel remote-console" aria-label="Remote Talon ESP32 diagnostics">
  <div className="panelheading"><div><span className="eyebrow">SECURE INTERNET DIAGNOSTICS</span><h2><Cloud size={19}/> Remote ESP32 command console</h2></div>
   <span className="calibration-baud">Firmware v5.7+ · HTTPS</span></div>
  <p className="fineprint">Commands are delivered to the station through its authenticated outbound HTTPS connection, without exposing USB serial or opening inbound ports. Only read-only <code>h</code> and <code>d</code> are supported remotely. Calibration requires local electrical verification.</p>
  <div className="remote-controls">
   <button className="ghostbutton" type="button" disabled={!adminKey||busy} onClick={verify}><ShieldCheck size={15}/>{verified?'Admin verified':'Verify administrator access'}</button>
   {verified&&<select aria-label="ESP32 device" value={deviceId} onChange={e=>setDeviceId(e.target.value)}>{devices.map(d=><option key={d.id} value={d.id}>{d.label} ({d.id})</option>)}</select>}
   <button className="primarybutton" disabled={!verified||!deviceId||busy||pending} onClick={()=>void send('h')}><Terminal size={15}/> Help (h)</button>
   <button className="primarybutton" disabled={!verified||!deviceId||busy||pending} onClick={()=>void send('d')}><Activity size={15}/> Read ADC (d)</button>
   <button className="ghostbutton" type="button" disabled={!verified||busy} onClick={()=>void load(adminKey,deviceId)}><RefreshCw size={15}/> Refresh</button>
  </div>
  {error&&<p className="noticeline" role="alert">{error}</p>}
  <div className="remote-results">{entries.length?entries.map(e=><article key={e.id}>
   <div className="remote-result-head"><strong><code>{e.command}</code> • {e.state}</strong><small>{new Date(e.requested_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}</small></div>
   <pre>{e.output|| (e.state==='EXPIRED'?'Expired before the station responded. Check Wi-Fi and firmware version.':'Awaiting ESP32 response…')}</pre>
  </article>):<p className="fineprint">No diagnostic commands recorded. Verify admin access and select a connected v5.7+ device.</p>}</div>
  <p className="fineprint">Requests expire after 3 minutes and are polled about every 30 seconds while the ESP32 is online. Remote calibration, shell commands, firmware flashing, and GPIO ground-zero operations are intentionally disabled.</p>
 </section>
}