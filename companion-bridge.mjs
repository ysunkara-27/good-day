import {validatePet} from './pet-profile.mjs';

// A display-only boundary. Never publish the account token, tasks, calendar,
// username, care memories, or URLs to the browser companion.
export function companionSnapshot({pet,care,focused=false,signedIn=false}) {
  if (!signedIn) return {version:1,connected:false};
  if (!pet || !care) return null; // Loading/offline is not a logout.
  return {
    version:1,connected:true,pet:validatePet(pet),
    care:{used:Math.max(0,Math.min(7,Number(care.used)||0)),unlocked:Math.max(0,Math.min(3,Number(care.unlocked)||0))},
    focused:!!focused,
  };
}
let current=null,last='';
export function publishCompanion(state) {
  const snapshot=companionSnapshot(state);
  if (!snapshot) return;
  current=snapshot;const encoded=JSON.stringify(snapshot);
  if(encoded===last)return;
  last=encoded;emit();
}
function emit(){if(current&&typeof document!=='undefined')document.dispatchEvent(new CustomEvent('taskpup:companion-state',{detail:JSON.stringify(current)}));}
if(typeof document!=='undefined')document.addEventListener('taskpup:companion-request',emit);
