// A destructive reset requires both administrator authentication (in the API route)
// and this exact, deliberate, device-specific confirmation phrase.
export function validateResetRequest(body) {
 if (!body || typeof body!=='object' || Array.isArray(body)) return null;
 if (typeof body.deviceId!=='string' || !/^[A-Z0-9-]{5,48}$/.test(body.deviceId)) return null;
 if (body.confirmation!==('RESET '+body.deviceId)) return null;
 return body.deviceId;
}
// The firmware energyWh counter is cumulative since its last reboot.
// After a cloud history reset, the next upload from the same boot must establish
// a fresh baseline, not re-import the energy that was just deleted.
export function nextEnergyDeltaWh(previous, energyWh, seq) {
 if(!Number.isFinite(energyWh)||energyWh<0||!Number.isSafeInteger(seq)||seq<1)return 0;
 if(previous===null||previous===undefined){
  return seq===1?energyWh:0;
 }
 const p=Number(previous);
 return Number.isFinite(p)?Math.max(0,energyWh-p):0;
}
