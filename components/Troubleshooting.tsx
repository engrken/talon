
'use client';
import {AlertTriangle,CheckCircle2,Lightbulb} from 'lucide-react';
type Health={seen_at:string;lcd_initialized:boolean;sensor_verified:boolean;sensor_fault:string;station_status:string;wifi_rssi_dbm:number;cloud_last_result:string};
type Advice={id:string;title:string;check:string;action:string};
export function identifyProblems(h:Health|null|undefined,online:boolean):Advice[]{
 if(!online)return [{id:'offline',title:'ESP32 not reporting to the cloud',
  check:'Check whether the ESP32 has power and whether the open “Talon Charging Station” Wi-Fi is visible. Read the LCD for the internet or cloud error.',
  action:'Join the local AP, then open http://192.168.4.1/setup using the existing admin credentials. Confirm router Wi-Fi details, internet service, HTTPS /api/ingest URL, device ID and token, and NTP time synchronization. If the AP is absent, inspect the ESP32 power supply and restart it.'}];
 if(!h)return [{id:'legacy',title:'Health telemetry missing',
  check:'A recent device upload was received, but no compatible LCD/sensor health heartbeat is available.',
  action:'Install ESP32 firmware v5.4.0 without erasing NVS settings. Check the local cloud endpoint and token. Older measurement uploads continue working but cannot display component health.'}];
 const p:Advice[]=[];
 if(!h.lcd_initialized)p.push({id:'lcd',title:'LCD initialization failed',
   check:'Verify the regulated 5 V LCD supply and ground, contrast control, SDA GPIO21, SCL GPIO22, I²C level shifter and backpack connection.',
   action:'Disconnect power before rewiring. Reseat cables, confirm the BSS138 level shifter has both 3.3 V and 5 V, then reboot the ESP32. Inspect serial monitor diagnostics if the screen stays blank.'});
 if(!h.sensor_verified){
  const cases:Record<string,{title:string;check:string;action:string}>={
   NO_SUPPLY:{title:'Charging supply not detected',check:'Is the 12 V load bus intentionally switched off? Check voltage at the load bus and voltage sensor terminals with a suitable multimeter.',action:'If power is expected, check the DC breaker, upstream output and voltage sensor wiring. A zero reading alone does not identify a failed component.'},
   LOW_UNVERIFIED:{title:'Voltage below verified range',check:'Compare the bus voltage with a multimeter and inspect voltage sensor terminals and GPIO35 signal divider.',action:'Isolate power before repairing connections. If the voltage is normal on the meter, recalibrate the sensor with a verified reference.'},
   HIGH_VOLT:{title:'Voltage reading exceeds sensor range',check:'Measure the DC bus and verify the 0–25 V sensor input, 20 kΩ/10 kΩ divider and GPIO35 wiring.',action:'Isolate the circuit and confirm the signal never exceeds safe ESP32 ADC levels. Correct the connection and recalibrate against a meter.'},
   NEG_CURRENT:{title:'ACS712 current reading is negative',check:'Check ACS712 IP+/IP− orientation, GPIO34 divider, and the no-load ACS zero reference.',action:'Switch off power before changing the sensor direction. Calibrate the zero point only with no current, then verify with a known load.'},
   HIGH_CURRENT:{title:'Excessive measured current',check:'Verify current with a suitably rated meter and inspect for overload or short circuits.',action:'Stop unsafe operation, inspect wiring and DC-rated protection, and do not bypass breakers or disguise the warning by increasing software limits.'},
   INVALID_ANALOG:{title:'Invalid analog sensor data',check:'Inspect the sensor power supplies, common ground, analog signal dividers and ADC connections.',action:'Isolate power before restoring loose wiring. Confirm ADC voltages remain safe, then restart and calibrate.'}
  };
  const d=cases[h.sensor_fault]||{title:'Unverified sensor reading',check:'Check both analog sensors and their ground reference.',action:'Verify stable sensor power and calibrate against a known meter.'};
  p.push({id:'sensor-'+h.sensor_fault,...d});
 }else if(h.station_status==='LOW_USB_BUS')p.push({id:'low-bus',title:'Low 12 V supply warning',
  check:'Compare the measured charging supply voltage with a multimeter. The 12 V threshold is advisory.',
  action:'If unexpectedly low, reduce load and inspect the power distribution and wiring. If intentionally using a lower-voltage bench setup, review the warning threshold and calibration.'});
 if(h.wifi_rssi_dbm<=-75)p.push({id:'wifi',title:'Weak Wi-Fi signal',
  check:'Reported signal strength: '+h.wifi_rssi_dbm+' dBm, which can interrupt uploads.',
  action:'Improve the 2.4 GHz signal, move the router or station closer, and reduce interference.'});
 if(h.cloud_last_result==='ERROR')p.push({id:'cloud',title:'Previous cloud upload failed',
  check:'This heartbeat arrived, but a previous attempt failed. Check the LCD and local /api/live for an HTTP error.',
  action:'For repeated failures, verify internet connectivity, NTP, trusted TLS certificates, the HTTPS endpoint and device token.'});
 return p;
}
export default function Troubleshooting({health,online,lastSeen}:{health:Health|null|undefined;online:boolean;lastSeen?:string|null}){
 const problems=identifyProblems(health,online);
 return <section className="troubleshooting" aria-label="Automatic troubleshooting guidance">
  <div className="troubleshoot-head"><Lightbulb size={19}/><div><h3>Automatic troubleshooting guide</h3><p>Suggestions use the ESP32’s most recent report; they do not remotely diagnose uninstrumented equipment.</p></div></div>
  {problems.length? <div className="troubleshoot-items">{problems.map(p=><article key={p.id} className="troubleshoot-item">
    <div className="troubleshoot-item-title"><AlertTriangle size={17}/><strong>{p.title}</strong></div>
    <p><b>What to check:</b> {p.check}</p><p><b>What to do:</b> {p.action}</p>
   </article>)}</div>:<div className="troubleshoot-clear"><CheckCircle2 size={18}/> No issues in the most recent ESP32 health report. Other station equipment is not verified by these sensors.</div>}
  {!online&&lastSeen&&<p className="fineprint">Last cloud contact: {new Date(lastSeen).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}. No new diagnoses can arrive until the ESP32 reconnects.</p>}
  <p className="fineprint">Safety: Isolate DC power before changing wiring. Live measurements should be performed by qualified personnel using rated equipment.</p>
 </section>
}
