'use client';
import {useEffect,useState} from 'react';
import {AlertTriangle,Database,RefreshCw,ShieldCheck,Trash2} from 'lucide-react';
type Scope='diagnostics'|'calibrations'|'status'|'telemetry';
type Device={id:string;label:string};
type Counts={diagnostics:number;calibrations:number;status:number;telemetry:number};
const areas:{key:Scope;title:string;description:string;impact:string;highRisk:boolean}[]=[
 {key:'diagnostics',title:'Remote diagnostic commands',description:'Previously completed h / d commands and their ADC output. Active commands are always preserved.',impact:'Does not affect calibration, telemetry or status history.',highRisk:false},
 {key:'calibrations',title:'Calibration test history',description:'Completed or expired zc / za / zr results, including noise-test logs.',impact:'Does not alter the ESP32 stored calibration, but deletes the pre-check authorization history.',highRisk:false},
 {key:'status',title:'Station status / connectivity events',description:'Historical changes and periodic snapshots in the status audit log.',impact:'Preserves the latest health snapshot, but removes past fault and restart history.',highRisk:false},
 {key:'telemetry',title:'Energy and measurement history',description:'Individual historical voltage, current, power and watt-hour records.',impact:'Changes historical charts, usage summaries, energy totals and estimated costs. For test-only data, check the dates carefully.',highRisk:true}
];
export default function LogManagement({adminKey}:{adminKey:string}){
 const [devices,setDevices]=useState<Device[]>([]);
 const [deviceId,setDeviceId]=useState('');
 const [days,setDays]=useState(7);
 const [counts,setCounts]=useState<Counts|null>(null);
 const [auditCount,setAuditCount]=useState(0);
 const [selected,setSelected]=useState<Scope|null>(null);
 const [confirmation,setConfirmation]=useState('');
 const [ack,setAck]=useState(false);
 const [busy,setBusy]=useState(false);
 const [feedback,setFeedback]=useState('');
 const [authorized,setAuthorized]=useState(false);
 useEffect(()=>{setDevices([]);setDeviceId('');setCounts(null);setAuditCount(0);setSelected(null);setConfirmation('');setAck(false);setFeedback('');setAuthorized(false)},[adminKey]);
 useEffect(()=>{setSelected(null);setConfirmation('');setAck(false);setCounts(null)},[deviceId,days]);
 async function refresh(id:string,age:number,key=adminKey){
  if(!id||!key)return;
  const res=await fetch('/api/admin/logs?deviceId='+encodeURIComponent(id)+'&olderThanDays='+age,
   {headers:{'x-admin-key':key},cache:'no-store'});
  const json=await res.json();
  if(!res.ok)throw Error(json.error||'Could not load log counts');
  setCounts(json.counts);setAuditCount(json.auditEntries||0);
 }
 async function load(){
  if(busy||!adminKey)return;
  setBusy(true);setFeedback('');
  try{
   const r=await fetch('/api/admin/devices',{headers:{'x-admin-key':adminKey},cache:'no-store'});
   const j=await r.json();
   if(!r.ok)throw Error(j.error||'Admin authorization failed');
   const options=(j.devices||[]) as Device[];
   setDevices(options);setAuthorized(true);
   const first=options.find(x=>x.id===deviceId)?.id||options[0]?.id||'';
   setDeviceId(first);
   if(first)await refresh(first,days);
  }catch(e){setAuthorized(false);setFeedback('Could not load records: '+String(e))}
  finally{setBusy(false)}
 }
 async function clear(){
  if(!selected||!deviceId||!counts||counts[selected]===0||!ack||confirmation!=='CLEAR '+selected.toUpperCase()+' '+deviceId||busy)return;
  const category=areas.find(x=>x.key===selected)!;
  if(!window.confirm('Permanently delete '+counts[selected]+' '+category.title+' records for '+deviceId+'? This cannot be undone.'))return;
  setBusy(true);setFeedback('');
  try{
   const r=await fetch('/api/admin/logs',{method:'POST',headers:{'Content-Type':'application/json','x-admin-key':adminKey},
    body:JSON.stringify({deviceId,scope:selected,olderThanDays:days,acknowledged:true,confirmation}),cache:'no-store'});
   const j=await r.json();if(!r.ok)throw Error(j.error||'Deletion failed');
   setFeedback('Removed '+j.deleted+' '+category.title.toLowerCase()+' entries for '+deviceId+'. Settings, active commands and live device health were retained.');
   setSelected(null);setConfirmation('');setAck(false);
   await refresh(deviceId,days);
  }catch(e){setFeedback('No cleanup confirmed: '+String(e))}
  finally{setBusy(false)}
 }
 return <section id="log-maintenance" className="panel log-maintenance" aria-label="Administrator log cleanup">
  <div className="panelheading"><div><span className="eyebrow">STORAGE & TEST LOG MAINTENANCE</span><h2><Database size={20}/> Manage stored logs</h2></div>
   <span className="muted"><ShieldCheck size={15}/> Administrator only</span></div>
  <p className="fineprint">Use these controls to remove unneeded test and diagnostic records from Neon. Each module is independent; no records are deleted automatically. Logs are not marked as “test” or “production,” so review the selected device and date range first. Deleting rows lets PostgreSQL reuse space, but its reported storage size may not drop immediately.</p>
  <div className="log-management-toolbar">
   <button type="button" className="ghostbutton" disabled={!adminKey||busy} onClick={()=>void load()}><RefreshCw size={15}/>{busy?'Loading…':'Load devices & log counts'}</button>
   {authorized&&devices.length>0&&<><label>Device<select value={deviceId} onChange={e=>setDeviceId(e.target.value)}>{devices.map(d=><option key={d.id} value={d.id}>{d.label} ({d.id})</option>)}</select></label>
   <label>Delete records<select value={days} onChange={e=>setDays(Number(e.target.value))}>
    <option value={7}>Older than 7 days</option><option value={30}>Older than 30 days</option>
    <option value={90}>Older than 90 days</option><option value={0}>All eligible history</option>
   </select></label>
   <button type="button" className="ghostbutton" disabled={busy||!deviceId} onClick={()=>{setBusy(true);void refresh(deviceId,days).catch(e=>setFeedback(String(e))).finally(()=>setBusy(false))}}>Refresh counts</button></>}
  </div>
  {!adminKey&&<p className="fineprint">Enter the administrator setup token above to manage logs.</p>}
  {authorized&&deviceId&&!counts&&<p className="fineprint">Select Refresh counts to view removable records for this retention window.</p>}
  {counts&&<><div className="log-management-grid">
   {areas.map(area=><article key={area.key} className={'log-management-area '+(area.highRisk?'high-risk':'')}>
    <div className="log-management-area-head"><strong>{area.title}</strong><span>{counts[area.key].toLocaleString('en-PH')} eligible</span></div>
    <p>{area.description}</p><small>{area.impact}</small>
    <button type="button" className={area.highRisk?'dangerbutton':'ghostbutton'} disabled={busy||counts[area.key]===0} onClick={()=>{setSelected(area.key);setConfirmation('');setAck(false);setFeedback('')}}><Trash2 size={15}/> Clear {area.highRisk?'measurement history':'logs'}</button>
   </article>)}
   </div>
   <p className="fineprint">Cleanup audit records retained: {auditCount}. Device credentials, settings, electricity rates, the latest health snapshot, and pending commands are excluded from cleanup.</p>
   {selected&&<div className="log-management-confirm" role="group" aria-label="Confirm selected log deletion">
    <strong><AlertTriangle size={17}/> Permanent deletion: {areas.find(x=>x.key===selected)?.title}</strong>
    <p>{counts[selected]} eligible records for <b>{deviceId}</b> ({days===0?'all dates':'older than '+days+' days'}). {areas.find(x=>x.key===selected)?.impact}</p>
    <label className="log-management-ack"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/> I understand that the selected records will be permanently deleted and cannot be restored without a backup.</label>
    <label>Type <code>CLEAR {selected.toUpperCase()} {deviceId}</code>
     <input value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off" spellCheck={false} placeholder={'CLEAR '+selected.toUpperCase()+' '+deviceId}/></label>
    <div className="log-management-actions">
     <button type="button" className="dangerbutton" disabled={busy||!ack||confirmation!=='CLEAR '+selected.toUpperCase()+' '+deviceId} onClick={()=>void clear()}>Permanently clear selected {selected==='telemetry'?'measurements':'logs'}</button>
     <button type="button" className="ghostbutton" disabled={busy} onClick={()=>{setSelected(null);setConfirmation('');setAck(false)}}>Cancel</button>
    </div>
   </div>}
  </>}
  {feedback&&<p className="noticeline" role="status">{feedback}</p>}
 </section>
}
