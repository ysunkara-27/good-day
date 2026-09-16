import {calendarRows} from './calendar-model.mjs';
import {schedule} from './model.mjs';

// Filtering changes presentation only. All busy Google events still constrain tasks.
export function buildAgenda(plan,rawEvents,day,timeZone,view='all'){
 const events=calendarRows(rawEvents,day,timeZone);
 const scheduled=schedule(plan,events.filter(event=>!event.allDay&&event.busy));
 return {events,scheduled,
  allDay:view==='tasks'?[]:events.filter(event=>event.allDay),
  rows:[...(view==='calendar'?[]:scheduled),...(view==='tasks'?[]:events.filter(event=>!event.allDay).map(event=>({...event,calendarEvent:true})))].sort((a,b)=>a.start-b.start)
 };
}
