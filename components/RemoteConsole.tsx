'use client';
import {useCallback,useEffect,useState} from 'react';
import {Activity,Cloud,RefreshCw,ShieldCheck,Terminal} from 'lucide-react';
type Entry={id:string;command:'h'|'d'|'zc'|'za'|'zr';state:string;requested_at:string;completed_at:string|null;output:string|null};
type Health={remoteReady:boolean;remoteZeroReady:boolean;remoteDiagnostics:boolean;firmware:string|null;lastSeen:string|null};
type NoiseSummary={reason:string;baselineMin:string;baselineMedian:string;baselineMax:string;baselineSpread:string;burstMin:string;burstMedian:string;burstMax:string;noisyBursts:string;zeroShift:string};
const noiseReasons:Record<string,string>={
 STABLE:'The signal passed the firmware limits. This is NOT proof of zero current; independent operator verification is still required before saving.',
 ISOLATED_BURST_SPIKES:'One or two ADC bursts exceeded the strict 8 mV limit. Calibration remains blocked, even if the baseline is otherwise steady.',
 REPEATED_BURST_NOISE:'Three or more bursts exceeded the strict 8 mV limit. Investigate the analog signal, supply, divider and grounding.',
 BASELINE_DRIFT:'The zero-current baseline moved by more than 4.5 mV during the 20-burst check. Investigate drift before calibrating.',
 SPIKES_AND_BASELINE_DRIFT:'Both burst noise and baseline drift exceeded the limits. Do not recalibrate yet.',
 ZERO_SHIFT_TOO_LARGE:'The proposed zero differs too much from the saved value. Recheck connections and sensor power.',
 IMPLAUSIBLE_SIGNAL:'The ACS712 signal is outside its expected ADC range. Verify sensor power and divider.',
 LOAD_SUPPLY_PRESENT:'The load supply is still detected. Disconnect and verify isolation before testing again.',
 LOAD_SUPPLY_REAPPEARED:'The load supply became active during testing. Calibration remains blocked.',
 INVALID_ADC:'One or more ADC measurements were invalid. Do not save a new zero.',
 IMPLAUSIBLE_ADC:'The ADC signal was implausible. Check the powered ACS712 sensor and wiring.'
};
function parseNoiseSummary(output:string|null):NoiseSummary|null{
 if(!output||!output.startsWith('CAL_'))return null;
 const values:Record<string,string>={};
 for(const match of output.matchAll(/([A-Za-z_]+)=([A-Za-z0-9._/-]+)/g))values[match[1]]=match[2];
 if(!values.baseline_min_mV||!values.burst_max_mV)return null;
 return {reason:values.reason||'UNKNOWN',baselineMin:values.baseline_min_mV,
  baselineMedian:values.baseline_med_mV,baselineMax:values.baseline_max_mV,
  baselineSpread:values.baseline_span_mV,burstMin:values.burst_min_mV,
  burstMedian:values.burst_med_mV,burstMax:values.burst_max_mV,
  noisyBursts:values.noisy_bursts,zeroShift:values.zero_shift_mV};
}
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
  if((command==='za'||command==='zr')&&!window.confirm('Confirm ALL load supplies are physically isolated, ACS712 IP+/IP- carries NO current and the sensor remains powered. Proceed with '+command+'?'))return;
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
 const noiseSummary=parseNoiseSummary(latestPreflight?.output||null);
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
  {verified&&<section className="remote-zero-panel" aria-label="Controlled remote ACS712 zero calibration">
    <div className="remote-zero-heading">
      <div><h3>ACS712 zero-current calibration</h3>
      <p className="fineprint">Read-only noise audit and deliberate zero calibration. Available after installing firmware v5.6.0-r3 or newer. The v5.6.0-r5 firmware reports detailed 20-burst statistics.</p></div>
      <span className={deviceHealth?.remoteZeroReady?'remote-zero-capable':'remote-zero-unavailable'}>
        {deviceHealth?.remoteZeroReady?'Pre-check available':'Calibration unavailable on this device'}
      </span>
    </div>
    <div className="remote-zero-check-panel">
      <div>
        <strong>Step 1 · Measure stability</strong>
        <p className="fineprint">The ESP32 evaluates 20 ADC bursts and will reject noise, baseline drift, or a connected load supply. No calibration is saved by this check.</p>
      </div>
      <button className="ghostbutton" type="button" disabled={!canCalibrate} onClick={()=>void send('zc')}>Run 20-burst stability check (zc)</button>
    </div>
    {latestScan?.state==='DONE'&&latestScan.output&&<div className={'remote-zero-summary '+(latestScan.output.startsWith('CAL_READY')?'remote-zero-summary-ready':'remote-zero-summary-rejected')} role="status">
       <strong>{latestScan.output.startsWith('CAL_READY')?'Pre-check passed · No calibration saved':'Pre-check rejected · No calibration saved'}</strong>
       {noiseSummary&&<><p>{noiseReasons[noiseSummary.reason]||'Review the firmware output; the zero reference was not changed.'}</p>
         <dl className="remote-noise-metrics">
           <div><dt>Baseline min / median / max</dt><dd>{noiseSummary.baselineMin} / {noiseSummary.baselineMedian} / {noiseSummary.baselineMax} mV</dd></div>
           <div><dt>20-burst baseline range</dt><dd>{noiseSummary.baselineSpread} mV <small>(limit 4.50 mV)</small></dd></div>
           <div><dt>Burst min / median / max</dt><dd>{noiseSummary.burstMin} / {noiseSummary.burstMedian} / {noiseSummary.burstMax} mV</dd></div>
           <div><dt>Noisy bursts</dt><dd>{noiseSummary.noisyBursts} <small>(each burst limit 8 mV)</small></dd></div>
           <div><dt>Zero offset shift</dt><dd>{noiseSummary.zeroShift} mV</dd></div>
         </dl></>}
       {!noiseSummary&&<p>Firmware did not return detailed v5.6.0-r5 statistics. See the raw response below for the rejection reason.</p>}
    </div>}
    {deviceHealth?.remoteZeroReady&&<fieldset className="remote-zero-verification">
      <legend>Step 2 · Operator verification (only after a successful pre-check)</legend>
      <label className="remote-zero-checkbox">
        <input type="checkbox" checked={noCurrentConfirmed} onChange={e=>setNoCurrentConfirmed(e.target.checked)}/>
        <span>I independently confirmed that <strong>all load supplies are isolated</strong>, no alternative current can pass through ACS712 IP+/IP−, and the ACS712 itself remains correctly powered. This cannot be verified from GPIO35 alone.</span>
      </label>
      <label className="remote-zero-phrase" htmlFor="talon-zero-confirm">
        Enter the exact phrase <code>ZERO {deviceId}</code> to save, or <code>ROLLBACK {deviceId}</code> to restore the previous value.
      </label>
      <input id="talon-zero-confirm" className="remote-zero-input" value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off" spellCheck={false} placeholder="Type exact confirmation phrase"/>
      <div className="remote-zero-buttons">
        <button className="primarybutton" type="button" disabled={!canCalibrate||!preflightReady||!noCurrentConfirmed||confirmation!=='ZERO '+deviceId} onClick={()=>void send('za')}>Save verified zero (za)</button>
        <button className="ghostbutton" type="button" disabled={!canCalibrate||!noCurrentConfirmed||confirmation!=='ROLLBACK '+deviceId} onClick={()=>void send('zr')}>Restore previous zero (zr)</button>
      </div>
      {!preflightReady&&<p className="fineprint">Saving a new zero requires a CAL_READY pre-check completed within the last 3 minutes. Rejected or expired checks never unlock saving.</p>}
    </fieldset>}
  </section>}
  {error&&<p className="noticeline" role="alert">{error}</p>}
  <div className="remote-results">{entries.length?entries.map(e=><article key={e.id}>
   <div className="remote-result-head"><strong><code>{e.command}</code> · {e.state}</strong><small>{new Date(e.requested_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}</small></div>
   <pre>{e.output||(e.state==='EXPIRED'?'Expired before the device responded. Check Wi-Fi.':'Awaiting ESP32 response…')}</pre>
  </article>):<p className="fineprint">No remote commands yet. Verify admin and select an online device.</p>}</div>
  <p className="fineprint">Commands normally arrive within about 30–60 seconds and expire after 3 minutes. Failed or unstable calibration attempts do not update the saved zero. Previous zero is retained for rollback. Remote arbitrary serial, firmware flashing, and GPIO operations remain disabled.</p>
 </section>
}