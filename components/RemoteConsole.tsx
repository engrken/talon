'use client';
import {useCallback,useEffect,useState} from 'react';
import {Activity,Cloud,RefreshCw,ShieldCheck,Terminal} from 'lucide-react';
type Entry={id:string;command:'h'|'d'|'zc'|'za'|'zr';state:string;requested_at:string;completed_at:string|null;output:string|null};
type Health={remoteReady:boolean;remoteZeroReady:boolean;remoteDiagnostics:boolean;firmware:string|null;lastSeen:string|null};
export default function RemoteConsole({adminKey}:{adminKey:string}){
 const [devices,setDevices]=useState<{id:string;label:string;last_seen:string|null}[]>([]);
 const [deviceId,setDeviceId]=useState('');
 const [verifiedKey,setVerifiedKey]=useState('');
 const [entries,setEntries]=useState<Entry[]>([]);
 const [deviceHealth,setDeviceHealth]=useState<Health|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [noCurrentConfirmed,setNoCurrentConfirmed]=useState(false);
 const [confirmation,setConfirmation]=useState('');
 const verified=!!adminKey&&verifiedKey===adminKey;
 useEffect(()=>{setVerifiedKey('');setDevices([]);setDeviceId('');setEntries([]);setDeviceHealth(null);setNoCurrentConfirmed(false);setConfirmation('')},[adminKey]);
 const load=useCallback(async(key:string,id:string)=>{
  if(!key||!id)return;
  try{
   const r=await fetch('/api/admin/commands?deviceId='+encodeURIComponent(id),{headers:{'x-admin-key':key},cache:'no-store'});
   const j=await r.json();if(!r.ok)throw Error(j.error||'Unable to retrieve commands');
   setEntries(j.rows||[]);setDeviceHealth({remoteReady:j.remoteReady===true,remoteZeroReady:j.remoteZeroReady===true,remoteDiagnostics:j.remoteDiagnostics===true,firmware:j.firmware||null,lastSeen:j.lastSeen||null});setError('');
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
 async function send(command:'h'|'d'|'zc'|'za'|'zr'){
  if(!verified||!deviceId||busy)return;
  if((command==='za'||command==='zr')&&!window.confirm('Confirm LED load supply is PHYSICALLY DISCONNECTED and ACS712 IP+/IP- has ZERO current. Proceed with '+command+'?'))return;
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/admin/commands',{method:'POST',
    headers:{'x-admin-key':adminKey,'Content-Type':'application/json'},
    body:JSON.stringify({deviceId,command,noCurrentConfirmed,confirmation}),cache:'no-store'});
   const j=await r.json();if(!r.ok)throw Error(j.error||'Command rejected');
   setNoCurrentConfirmed(false);setConfirmation('');
   await load(adminKey,deviceId);
  }catch(e){setError(String(e))}finally{setBusy(false)}
 }
 const pending=entries.some(e=>['QUEUED','CLAIMED'].includes(e.state));
 const canSend=verified&&!!deviceId&&!!deviceHealth?.remoteReady&&!busy&&!pending;
 const canCalibrate=canSend&&!!deviceHealth?.remoteZeroReady;
 const latestPreflight=entries.find(e=>e.command==='zc');
 const preflightReady=!!latestPreflight&&latestPreflight.state==='DONE'&&!!latestPreflight.output?.startsWith('CAL_READY')&&Date.now()-new Date(latestPreflight.completed_at||0).getTime()<180000;
 return <section className="panel remote-console" aria-label="Remote Talon ESP32 diagnostics">
  <div className="panelheading"><div><span className="eyebrow">SECURE INTERNET DIAGNOSTICS</span><h2><Cloud size={19}/> Remote ESP32 command console</h2></div>
   <span className="calibration-baud">Firmware v5.6 · HTTPS</span></div>
  <p className="fineprint">ESP32 initiates authenticated HTTPS requests over Wi-Fi. The <code>h</code> and <code>d</code> commands remain read-only; no laptop USB connection, extra pins, or open inbound ports are required.</p>
  {verified&&deviceId&&deviceHealth&&<p className="fineprint" role="status"><strong>Device firmware:</strong> {deviceHealth.firmware||'Not reported'} · <strong>Remote diagnostics:</strong> {deviceHealth.remoteReady?'Online and ready':deviceHealth.remoteDiagnostics?'Supported, device offline':'Requires v5.6 remote patch'}{deviceHealth.lastSeen?' · Last contact '+new Date(deviceHealth.lastSeen).toLocaleString('en-PH',{timeZone:'Asia/Manila'}):''}</p>}
  <div className="remote-controls">
   <button className="ghostbutton" type="button" disabled={!adminKey||busy} onClick={verify}><ShieldCheck size={15}/>{verified?'Admin verified':'Verify administrator access'}</button>
   {verified&&<select aria-label="ESP32 device" value={deviceId} onChange={e=>{setDeviceId(e.target.value);setEntries([]);setDeviceHealth(null);setConfirmation('');setNoCurrentConfirmed(false)}}>{devices.map(d=><option key={d.id} value={d.id}>{d.label} ({d.id})</option>)}</select>}
   <button className="primarybutton" disabled={!canSend} onClick={()=>void send('h')}><Terminal size={15}/> Help (h)</button>
   <button className="primarybutton" disabled={!canSend} onClick={()=>void send('d')}><Activity size={15}/> Read ADC (d)</button>
   <button className="ghostbutton" type="button" disabled={!verified||busy} onClick={()=>void load(adminKey,deviceId)}><RefreshCw size={15}/> Refresh</button>
  </div>
  {verified&&<div className="remote-zero-panel">
    <h3>Controlled remote ACS712 zero calibration</h3>
    <p className="fineprint">Available only after flashing v5.6.0-r3 and receiving its capability heartbeat. The ESP32 tests 20 ADC samples and refuses to save a zero if the monitored load supply is present or ADC readings fluctuate. <strong>This cannot independently prove zero current.</strong> Never run while any load is energized.</p>
    <p className="fineprint">Current capability: {deviceHealth?.remoteZeroReady?'Ready for zero pre-check':'Not enabled on this firmware / device offline'}</p>
    <button className="ghostbutton" type="button" disabled={!canCalibrate} onClick={()=>void send('zc')}>Run no-load stability pre-check (zc)</button>
    {deviceHealth?.remoteZeroReady&&<>
      <label className="remote-confirm-label"><input type="checkbox" checked={noCurrentConfirmed} onChange={e=>setNoCurrentConfirmed(e.target.checked)}/> I physically confirmed the LED 5 V supply is disconnected, ACS712 IP+/IP− carries no current, and the sensor itself remains powered.</label>
      <label className="remote-confirm-label">For calibration, type <code>ZERO {deviceId}</code>. For rollback, type <code>ROLLBACK {deviceId}</code>.
       <input value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off" spellCheck={false} placeholder="Exact confirmation phrase"/>
      </label>
      <div className="remote-controls">
        <button className="primarybutton" type="button" disabled={!canCalibrate||!preflightReady||!noCurrentConfirmed||confirmation!=='ZERO '+deviceId} onClick={()=>void send('za')}>Save verified zero (za)</button>
        <button className="ghostbutton" type="button" disabled={!canCalibrate||!noCurrentConfirmed||confirmation!=='ROLLBACK '+deviceId} onClick={()=>void send('zr')}>Restore previous zero (zr)</button>
      </div>
      {!preflightReady&&<p className="fineprint">A successful CAL_READY result from the last 3 minutes is required before saving a new zero.</p>}
    </>}
  </div>}
  {error&&<p className="noticeline" role="alert">{error}</p>}
  <div className="remote-results">{entries.length?entries.map(e=><article key={e.id}>
   <div className="remote-result-head"><strong><code>{e.command}</code> · {e.state}</strong><small>{new Date(e.requested_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}</small></div>
   <pre>{e.output||(e.state==='EXPIRED'?'Expired before the device responded. Check Wi-Fi.':'Awaiting ESP32 response…')}</pre>
  </article>):<p className="fineprint">No remote commands yet. Verify admin and select an online device.</p>}</div>
  <p className="fineprint">Commands normally arrive within about 30–60 seconds and expire after 3 minutes. Failed or unstable calibration attempts do not update the saved zero. Previous zero is retained for rollback. Remote arbitrary serial, firmware flashing, and GPIO operations remain disabled.</p>
 </section>
}