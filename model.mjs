export const localDay = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function validateDay(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0,10)!==day) throw new Error('Choose a valid day.');
  return day;
}
export function validatePlan(plan) {
  if (!plan || !Number.isInteger(plan.start) || plan.start<0 || plan.start>1439 || !Array.isArray(plan.tasks) || plan.tasks.length>100) throw new Error('A day can hold up to 100 tasks. Choose a valid start time.');
  const ids=new Set();
  for(const task of plan.tasks){
    if(typeof task.id!=='string'||! /^[\w-]{1,60}$/.test(task.id)||ids.has(task.id)||typeof task.name!=='string'||!task.name.trim()||task.name.length>160||!Number.isInteger(task.minutes)||task.minutes<5||task.minutes>480||typeof task.group!=='string'||task.group.length>32||typeof task.done!=='boolean') throw new Error('Tasks need a name, 5–480 minutes, and an optional short group.');
    if(task.scheduledStart!=null&&(!Number.isInteger(task.scheduledStart)||task.scheduledStart<0||task.scheduledStart>1439))throw new Error('Choose a task start time between 00:00 and 23:59.');
    ids.add(task.id);
  }
  return {start:plan.start,tasks:plan.tasks.map(({id,name,minutes,group,done,scheduledStart})=>({id,name:name.trim(),minutes,group:group.trim(),done,...(scheduledStart==null?{}:{scheduledStart})}))};
}
// Fixed slots are never silently moved. Automatic tasks fill the available gaps.
// Calendar events reserve time but never become tasks or count toward progress.
export function schedule(plan,busyIntervals=[]) {
  const reserved=plan.tasks.filter(task=>task.scheduledStart!=null)
    .map(task=>({start:task.scheduledStart,end:task.scheduledStart+task.minutes}))
    .concat(busyIntervals).sort((a,b)=>a.start-b.start);
  let cursor=plan.start;
  const rows=plan.tasks.map(task=>{
    const fixed=task.scheduledStart!=null;
    let start=fixed?task.scheduledStart:cursor;
    if(!fixed){
      for(const slot of reserved){
        if(start+task.minutes<=slot.start)break;
        if(start<slot.end&&start+task.minutes>slot.start)start=slot.end;
      }
      cursor=start+task.minutes;
    }
    return {...task,start,end:start+task.minutes,fixed};
  }).sort((a,b)=>a.start-b.start);
  return rows.map(task=>({...task,overlap:busyIntervals.some(slot=>task.start<slot.end&&task.end>slot.start)||rows.some(other=>other.id!==task.id&&task.start<other.end&&task.end>other.start)}));
}
export function clockValue(minutes) {
  return minutes==null?'':`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
}
export function clockMinutes(value) {
  if(!value)return null;
  const [hours,minutes]=value.split(':').map(Number);
  return hours*60+minutes;
}
export function progress(tasks) { return tasks.length?Math.round(tasks.filter(t=>t.done).length/tasks.length*100):0; }
export function timeLabel(minutes) {const hour=Math.floor(minutes/60)%24;return `${hour%12||12}:${String(minutes%60).padStart(2,'0')} ${hour<12?'am':'pm'}${minutes>=1440?` +${Math.floor(minutes/1440)}d`:''}`;}
