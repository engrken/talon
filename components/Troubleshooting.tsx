'use client';
import {AlertTriangle,CheckCircle2,Lightbulb} from 'lucide-react';
type Health={seen_at:string;firmware?:string;lcd_initialized:boolean;sensor_verified:boolean;sensor_fault:string;station_status:string;wifi_rssi_dbm:number;cloud_last_result:string;current_status?:string;voltage_status?:string;supply_mode?:string;low_current_estimate?:boolean};
type Advice={id:string;title:string;check:string;action:string};
export function identifyProblems(h:Health|null|undefined,online:boolean):Advice[]{
 if(!online)return [{id:'offline',title:'ESP32 not reporting to the cloud',
  check:'Confirm the ESP32 has stable power and that its local Wi-Fi access point is visible. Read the local LCD status.',
  action:'Connect to Talon Charging Station, open http://192.168.4.1/setup and verify the internet Wi-Fi, HTTPS ingest URL, device token and clock synchronization. If the AP is missing, inspect the ESP32 supply.'}];
 if(!h)return [{id:'no-health',title:'Current health report unavailable',
   check:'The ESP32 upload is recent, but no independent sensor status has arrived.',
   action:'Upload the latest v5.6+ firmware without erasing saved settings; verify the local LCD and HTTPS cloud configuration.'}];
 const problems:Advice[]=[];
 if(!h.lcd_initialized)problems.push({id:'lcd',title:'LCD failed to initialize',
  check:'Check regulated 5 V, LCD GND, I²C GPIO21/GPIO22, contrast and the bidirectional 3.3 V↔5 V shifter.',
  action:'Isolate power before reseating connections, then reboot and check Serial Monitor diagnostics.'});
 const version=h.firmware?.match(/^(\\d+)\\.(\\d+)\\./);
 const independent=!!version&&(Number(version[1])>5||(Number(version[1])===5&&Number(version[2])>=6));
 if(independent){
  if(h.current_status==='CHECK')problems.push({id:'current',title:'ACS712 current sensor — check signal',
   check:'Inspect the series IP+→IP− direction, a stable 5 V sensor supply, the shared ground, GPIO34 and 20 kΩ/10 kΩ divider. The saved zero calibration may have drifted.',
   action:'With no current through IP+/IP−, recalibrate using the Serial Monitor command z. Compare current against a correctly connected, rated DC ammeter. Persistent negative current may mean reversed direction; isolate power before changing wiring.'});
  if(h.voltage_status==='CHECK')problems.push({id:'voltage',title:'Voltage sensor — check signal',
   check:'Compare load voltage against a multimeter. Inspect voltage sensor input and GPIO35 through the 20 kΩ/10 kΩ divider.',
   action:'Isolate power before inspecting terminals. Recalibrate with a verified reference only if the wiring and measured bus are correct.'});
  if(h.voltage_status==='NO_INPUT')problems.push({id:'no-input',title:'No voltage input detected',
   check:'Determine whether the DC supply is intentionally OFF. A zero reading does not distinguish an off supply from a disconnected voltage sensor.',
   action:'If 5 V or 12 V is expected, measure the load bus independently and inspect voltage sensor wiring; do not assume the module has failed.'});
  if(h.supply_mode==='UNVERIFIED'&&h.voltage_status==='OK')problems.push({id:'unknown-voltage',title:'Unclassified supply voltage',
   check:'The measured bus falls outside the recognized 4.0–6.5 V experimental and 10.5–15.5 V operational ranges.',
   action:'Verify bus voltage and source selection with a multimeter. A 7–10 V supply must not be silently labeled as a 5 V experiment.'});
 } else if(!h.sensor_verified)problems.push({id:'legacy',title:'Legacy combined sensor fault',
   check:'The older firmware reports '+String(h.sensor_fault).replaceAll('_',' ').toLowerCase()+' without independent current/voltage diagnostics.',
   action:'Use the Serial Monitor raw ADC diagnostics and install v5.6.0 to identify which sensor channel is suspect.'});
 if(h.station_status==='LOW_USB_BUS'&&h.supply_mode!=='EXPERIMENTAL')problems.push({id:'lowbus',title:'Low operational charging voltage',
   check:'Compare voltage with a multimeter and check for supply sag under load.',
   action:'Reduce unsafe load and inspect DC supply, protection and wiring as appropriate. A valid 5 V experiment should not generate this warning.'});
 if(h.wifi_rssi_dbm<=-75)problems.push({id:'weak-wifi',title:'Weak Wi-Fi signal',
   check:'RSSI is '+h.wifi_rssi_dbm+' dBm; this can cause intermittent cloud uploads.',
   action:'Improve 2.4 GHz coverage or move the ESP32 closer to the router.'});
 if(h.cloud_last_result==='ERROR')problems.push({id:'cloud',title:'Previous cloud upload failed',
   check:'Inspect local /api/live status and look for HTTPS errors, time-sync errors or invalid credentials.',
   action:'Verify NTP, internet connectivity, trusted TLS root, cloud URL and the existing device token.'});
 return problems;
}
export default function Troubleshooting({health,online,lastSeen}:{health:Health|null|undefined;online:boolean;lastSeen?:string|null}){
 const problems=identifyProblems(health,online);
 return <section className="troubleshooting" aria-label="Automatic troubleshooting guidance">
  <div className="troubleshoot-head"><Lightbulb size={19}/><div><h3>Automatic troubleshooting guide</h3><p>Independent signal checks identify the affected channel, but cannot prove a sensor is physically broken.</p></div></div>
  {problems.length?<div className="troubleshoot-items">{problems.map(p=><article key={p.id} className="troubleshoot-item"><div className="troubleshoot-item-title"><AlertTriangle size={17}/><strong>{p.title}</strong></div><p><b>What to check:</b> {p.check}</p><p><b>What to do:</b> {p.action}</p></article>)}</div>:
   <div className="troubleshoot-clear"><CheckCircle2 size={18}/> No confirmed diagnostics in the latest ESP32 report. Experimental 5 V operation is intentional and does not trigger a low-12 V alarm.</div>}
  {health?.supply_mode==='EXPERIMENTAL'&&<p className="fineprint">Experimental 5 V mode: currents below about 200 mA cannot be resolved reliably by the ACS712-30A. The mA display is approximate, rounded to 50 mA; use a shunt monitor for precision.</p>}
  {!online&&lastSeen&&<p className="fineprint">Last cloud contact: {new Date(lastSeen).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}. Remote diagnosis cannot update until the ESP32 reconnects.</p>}
  <p className="fineprint">Safety: Isolate DC power before changing wiring. Use suitable rated instruments for live measurements.</p>\n  <p><a className="troubleshoot-guide-link" href="/guide#diagnostics">Open complete troubleshooting and calibration guide →</a></p>
 </section>;
}
