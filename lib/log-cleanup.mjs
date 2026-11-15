// Selection and exact device-bound confirmation are shared by the UI and API.
// Records do not carry a reliable test/production flag; no automatic deletion.
export const CLEANUP_SCOPES=Object.freeze(['diagnostics','calibrations','status','telemetry']);
export const CLEANUP_DAYS=Object.freeze([0,7,30,90]);
export const CLEANUP_LABELS=Object.freeze({
 diagnostics:'Remote diagnostic commands',
 calibrations:'Calibration command history',
 status:'Station status events',
 telemetry:'Measurement and energy history'
});
export function expectedCleanupPhrase(scope,deviceId){
 if(!CLEANUP_SCOPES.includes(scope)||typeof deviceId!=='string')return null;
 return 'CLEAR '+scope.toUpperCase()+' '+deviceId;
}
export function validateCleanupRequest(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const {deviceId,scope,olderThanDays,confirmation,acknowledged}=value;
 if(typeof deviceId!=='string'||!/^[A-Z0-9-]{5,48}$/.test(deviceId))return null;
 if(!CLEANUP_SCOPES.includes(scope)||!CLEANUP_DAYS.includes(olderThanDays))return null;
 if(acknowledged!==true||confirmation!==expectedCleanupPhrase(scope,deviceId))return null;
 return {deviceId,scope,olderThanDays};
}
