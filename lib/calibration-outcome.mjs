/**
 * Interpret actual ESP32 remote calibration responses. r8 uses CAL_OK saved zero
 * rather than CAL_SAVED. This helper must never infer success from HTTP "DONE".
 */
export function calibrationOutcome(command, rawOutput) {
 const output=typeof rawOutput==='string'?rawOutput.trim():'';
 const other={kind:'other',savedMv:null,backupMv:null};
 if(!output)return other;
 if(/^CAL_REJECTED\b/.test(output))return {...other,kind:'rejected'};
 if(command==='zc'&&/^CAL_READY\b/.test(output))return {...other,kind:'precheck_ready'};
 if(command==='za'){
  const match=/^CAL_OK\s+saved\s+zero\s+(-?\d+(?:\.\d+)?)\s*mV;\s*backup\s+(-?\d+(?:\.\d+)?)\s*mV\b/i.exec(output);
  if(match)return {kind:'saved',savedMv:Number(match[1]),backupMv:Number(match[2])};
  if(/^CAL_SAVED\b/.test(output))return {...other,kind:'saved'};
 }
 if(command==='zr'&&/^CAL_OK\b/.test(output))return {...other,kind:'rolled_back'};
 return other;
}
