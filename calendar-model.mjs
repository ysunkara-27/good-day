// Google instances are expanded server-side. Display and scheduling use the
// viewer's local wall clock, the same convention as manually timed tasks.
export function calendarRows(events,day,timeZone){
 const formatter=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const minute=value=>{
  const date=new Date(value);if(!Number.isFinite(date.getTime()))return NaN;
  const values=Object.fromEntries(formatter.formatToParts(date).map(p=>[p.type,p.value]));
  const key=`${values.year}-${values.month}-${values.day}`;
  return (Date.parse(key)-Date.parse(day))/86400000*1440+Number(values.hour)*60+Number(values.minute);
 };
 return events.flatMap(event=>{
  if(event.start?.date){return event.start.date<=day&&event.end?.date>day?[{...event,allDay:true}]:[];}
  if(!event.start?.dateTime||!event.end?.dateTime)return [];
  let start=minute(event.start.dateTime),end=minute(event.end.dateTime);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=0||start>=1440)return [];
  // A fall-back clock change can make an event end earlier by wall clock.
  if(end<=start)end=start+(Date.parse(event.end.dateTime)-Date.parse(event.start.dateTime))/60000;
  start=Math.max(0,start);end=Math.min(1440,end);
  return end>start?[{...event,allDay:false,start,end}]:[];
 });
}
export function calendarWindow(day){
 const from=new Date(`${day}T00:00:00`),to=new Date(from);to.setDate(to.getDate()+1);
 return {from:from.toISOString(),to:to.toISOString(),zone:Intl.DateTimeFormat().resolvedOptions().timeZone};
}
