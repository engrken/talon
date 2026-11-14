'use client';

import {useEffect,useRef,useState} from 'react';
import {AlertTriangle,CheckCircle2,Clipboard,PlugZap,ShieldCheck,Terminal,Unplug} from 'lucide-react';

type Port = {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options:{baudRate:number}):Promise<void>;
  close():Promise<void>;
};
type PortReader = ReadableStreamDefaultReader<Uint8Array>;
type SerialApi = {requestPort():Promise<Port>};
type NavigatorWithSerial = Navigator & {serial?:SerialApi};

const HELP = [
  {command:'h',name:'Help',detail:'Show the commands provided by the installed firmware.'},
  {command:'d',name:'Live raw diagnostics',detail:'Show RAW ADC counts and calibrated mV. When safely grounded, GPIO35 should read near zero.'},
  {command:'g',name:'Calibrate GPIO35 ground zero',detail:'Only after disconnecting the sensor, grounding GPIO35 with all power removed, then powering the ESP32 by USB.'},
  {command:'u',name:'Clear GPIO35 calibration',detail:'Restore the default GPIO35 raw-zero threshold.'},
  {command:'z',name:'Calibrate ACS712 no-load zero',detail:'The ACS712 IP+ / IP- current path must carry no current.'},
] as const;

export default function CalibrationConsole({adminKey}:{adminKey:string}){
  const [verified,setVerified]=useState(false);
  const [verifiedKey,setVerifiedKey]=useState('');
  const [verifying,setVerifying]=useState(false);
  const [supported,setSupported]=useState(false);
  const [connected,setConnected]=useState(false);
  const [busy,setBusy]=useState(false);
  const [voltage,setVoltage]=useState('5.00');
  const [current,setCurrent]=useState('1.00');
  const [message,setMessage]=useState('');
  const [output,setOutput]=useState('');
  const portRef=useRef<Port|null>(null);
  const readerRef=useRef<PortReader|null>(null);
  const readTaskRef=useRef<Promise<void>|null>(null);
  const activeRef=useRef(false);

  useEffect(()=>{setSupported(Boolean(window.isSecureContext && (navigator as NavigatorWithSerial).serial))},[]);
  useEffect(()=>{setVerified(false)},[adminKey]);

  useEffect(()=>()=>{ // Release serial locks when navigating away from the administration page.
    activeRef.current=false;
    void (async()=>{
      try{await readerRef.current?.cancel()}catch{}
      try{await readTaskRef.current}catch{}
      try{await portRef.current?.close()}catch{}
    })();
  },[]);

  function append(chunk:string){setOutput(previous=>(previous+chunk).slice(-16000))}
  async function verifyAdmin(){
    if(!adminKey.trim())return;
    setVerifying(true);setVerified(false);setMessage('');
    try{
      const response=await fetch('/api/admin/devices',{headers:{'x-admin-key':adminKey},cache:'no-store'});
      if(!response.ok)throw Error(response.status===401?'Invalid administrator token':'Unable to verify administrator access');
      setVerifiedKey(adminKey);
      setVerified(true);
      setMessage('Administrator access verified for this browser session.');
    }catch(error){setMessage(String(error))}
    finally{setVerifying(false)}
  }

  async function readPort(port:Port){
    if(!port.readable)return;
    const reader=port.readable.getReader();
    readerRef.current=reader;
    const decoder=new TextDecoder();
    try{
      while(activeRef.current){
        const result=await reader.read();
        if(result.done)break;
        if(result.value)append(decoder.decode(result.value,{stream:true}));
      }
    }catch(error){
      if(activeRef.current)setMessage('Serial connection interrupted: '+String(error));
    }finally{
      append(decoder.decode());
      try{reader.releaseLock()}catch{}
      readerRef.current=null;
      if(activeRef.current){
        activeRef.current=false;
        setConnected(false);
        setMessage('ESP32 serial stream ended. Disconnect and reconnect the USB cable if needed.');
        try{await port.close()}catch{}
        if(portRef.current===port)portRef.current=null;
      }
    }
  }

  async function connect(){
    if(!verified||verifiedKey!==adminKey||connected||busy)return;
    const api=(navigator as NavigatorWithSerial).serial;
    if(!window.isSecureContext||!api){setMessage('Direct USB is supported in desktop Chrome/Edge over HTTPS. Use Arduino Serial Monitor on other browsers.');return}
    setBusy(true);setMessage('');
    try{
      const port=await api.requestPort();
      await port.open({baudRate:115200});
      portRef.current=port;
      activeRef.current=true;
      setConnected(true);
      append('\n[Connected to ESP32 at 115200 baud, newline mode]\n');
      readTaskRef.current=readPort(port);
    }catch(error){
      setMessage('USB connection was not established: '+String(error)+'. Close Arduino Serial Monitor and other applications using the port, then retry.');
    }finally{setBusy(false)}
  }

  async function disconnect(){
    if(busy)return;
    setBusy(true);
    activeRef.current=false;
    try{
      await readerRef.current?.cancel();
      await readTaskRef.current;
      await portRef.current?.close();
      append('\n[Serial port disconnected]\n');
      setMessage('USB serial connection closed.');
    }catch(error){setMessage('Port cleanup: '+String(error))}
    finally{
      portRef.current=null;readTaskRef.current=null;setConnected(false);setBusy(false);
    }
  }

  async function send(command:string){
    if(!verified||verifiedKey!==adminKey||!connected||busy||!portRef.current?.writable)return;
    const verb=command.split(' ')[0];
    const prompts:Record<string,string>={
      g:'Safety check: ESP32 and station power were OFF before changing the GPIO35 wiring. The voltage sensor output is DISCONNECTED from GPIO35; GPIO35 is connected to GND; only then was the ESP32 powered from USB. Confirm before calibrating ground zero.',
      u:'Clear the previously saved GPIO35 raw-ground-zero calibration and restore its default threshold?',
      z:'Confirm there is NO current through the ACS712 IP+ / IP- conductor. The ESP32 may remain powered; the measured conductor must be unloaded.',
      v:'Confirm the displayed voltage matches an actual DMM-verified DC input, not an assumed or nominal value. Apply this calibration?',
      i:'Confirm this is a stable, verified positive current measured with a suitable rated ammeter. The ACS712-30A cannot resolve very small currents accurately. Apply this calibration?',
    };
    if(prompts[verb]&&!window.confirm(prompts[verb]))return;
    setBusy(true);setMessage('');
    try{
      const writer=portRef.current.writable.getWriter();
      try{
        await writer.write(new TextEncoder().encode(command+'\n'));
        append('\n> '+command+'\n');
      }finally{writer.releaseLock()}
    }catch(error){setMessage('Command not sent: '+String(error))}
    finally{setBusy(false)}
  }

  function sendReference(kind:'v'|'i'){
    const raw=kind==='v'?voltage:current;
    const val=Number(raw);
    if(!/^\d+(?:\.\d{1,2})?$/.test(raw)||!Number.isFinite(val)||val<=0||val>30){
      setMessage('Enter a positive, DMM-verified reference up to 30, with no more than two decimal places.');
      return;
    }
    if(kind==='i'&&val<0.2){setMessage('Use a measured current of at least 0.20 A for ACS712-30A calibration; readings below about 200 mA are not reliably resolved.');return}
    void send(kind+' '+val.toFixed(2));
  }

  async function copy(command:string){
    try{await navigator.clipboard.writeText(command);setMessage('Copied '+command+' to clipboard. Paste into Serial Monitor set to 115200 baud and Newline.')}
    catch{setMessage('Clipboard unavailable. Select the command text and copy it manually.')}
  }
  const accessOk=verified&&verifiedKey===adminKey;
  const canSend=accessOk&&connected&&!busy;

  return <section className="panel calibration-panel" aria-label="Local ESP32 sensor calibration">
    <div className="panelheading">
      <div><span className="eyebrow">LOCAL DEVICE MAINTENANCE</span><h2><Terminal size={21}/> Sensor diagnostics &amp; calibration</h2></div>
      <span className="calibration-baud">115200 baud · Newline (LF)</span>
    </div>
    <p className="calibration-intro">Run the existing ESP32 firmware commands without typing them. USB actions happen <strong>only on the physically connected ESP32</strong>; they are never issued over the public cloud dashboard.</p>
    <div className="calibration-safety" role="note">
      <AlertTriangle size={20}/>
      <div><strong>Important electrical safety</strong>
        <p>Never directly ground a GPIO pin while it is connected to an energized sensor output. For <code>g</code>, turn all power OFF, disconnect the voltage-sensor signal from GPIO35, connect GPIO35 to GND, then power the ESP32 from USB. Power OFF again before restoring the original wiring. Use a DMM or suitable ammeter for reference calibration.</p>
      </div>
    </div>
    <div className="calibration-grid">
      <div>
        <h3><ShieldCheck size={17}/> Local USB access</h3>
        <p className="fineprint">Verify the administrator setup token above. Connecting additionally requires a user-approved local USB device selection; no firmware secrets are transmitted to this web page.</p>
        <div className="calibration-buttons">
          <button type="button" className="ghostbutton" disabled={!adminKey||verifying||connected} onClick={verifyAdmin}><ShieldCheck size={15}/>{accessOk?'Access verified':verifying?'Verifying…':'Verify administrator'}</button>
          {!connected?<button type="button" className="primarybutton" disabled={!accessOk||busy||!supported} onClick={connect}><PlugZap size={15}/> Connect ESP32</button>:
            <button type="button" className="ghostbutton" disabled={busy} onClick={disconnect}><Unplug size={15}/> Disconnect</button>}
        </div>
        {!supported&&<p className="fineprint">Web Serial requires desktop Chrome or Edge with HTTPS and a USB-connected ESP32. Firefox, Safari, and most mobile browsers can use the copy-and-paste instructions instead.</p>}
        <p className="fineprint"><strong>Connection:</strong> USB cable must support data. Close Arduino Serial Monitor before connecting here. No calibration is performed automatically.</p>
        {message&&<p className="noticeline" role="status">{message}</p>}
        <div className="calibration-terminal-header"><span><Terminal size={14}/> ESP32 output</span><button type="button" className="ghostbutton" onClick={()=>setOutput('')}>Clear output</button></div>
        <pre className="calibration-terminal" aria-label="ESP32 serial monitor output">{output||'Connect the ESP32, then select Help or Read diagnostics to view its serial response.'}</pre>
      </div>
      <div>
        <h3><CheckCircle2 size={17}/> Firmware commands</h3>
        <div className="calibration-command-list">
          {HELP.map(c=><div className="calibration-command" key={c.command}>
            <div><code>{c.command}</code> <strong>{c.name}</strong><p>{c.detail}</p></div>
            <div className="calibration-command-actions"><button type="button" disabled={!canSend} onClick={()=>void send(c.command)}>Send</button><button type="button" aria-label={'Copy '+c.command} onClick={()=>void copy(c.command)}><Clipboard size={14}/></button></div>
          </div>)}
          <div className="calibration-command"><div><code>v {voltage}</code> <strong>Calibrate bus voltage</strong><p>Enter the actual voltage measured at the sensor input using a DMM. 5.00 V is an example for experimental operation.</p>
              <label className="calibration-reference">Verified voltage (V)<input type="number" min="0.01" max="30" step="0.01" value={voltage} onChange={e=>setVoltage(e.target.value)}/></label>
            </div><div className="calibration-command-actions"><button type="button" disabled={!canSend} onClick={()=>sendReference('v')}>Send</button><button type="button" onClick={()=>void copy('v '+Number(voltage).toFixed(2))} aria-label="Copy voltage calibration"><Clipboard size={14}/></button></div></div>
          <div className="calibration-command"><div><code>i {current}</code> <strong>Calibrate current</strong><p>Enter a DMM-verified positive load current (for example, 1.00 A). The ACS712-30A cannot accurately resolve currents below about 200 mA.</p>
              <label className="calibration-reference">Verified current (A)<input type="number" min="0.2" max="30" step="0.01" value={current} onChange={e=>setCurrent(e.target.value)}/></label>
            </div><div className="calibration-command-actions"><button type="button" disabled={!canSend} onClick={()=>sendReference('i')}>Send</button><button type="button" onClick={()=>void copy('i '+Number(current).toFixed(2))} aria-label="Copy current calibration"><Clipboard size={14}/></button></div></div>
        </div>
      </div>
    </div>
    <p className="fineprint"><strong>Experimental bench mode:</strong> 4.0–6.5 V. Normal charging-station operation is around 12 V. ACS712-30A measurements near 5 V below roughly 200 mA cannot be calibrated into true milliamp-level precision; use a shunt-type sensor if precision is required. Commands must already be supported by the installed ESP32 firmware.</p>
  </section>;
}
