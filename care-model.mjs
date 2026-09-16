// Daily care is earned from completed planner tasks, never from elapsed time,
// repeated clicks, calendar events, or running a timer.
export const careActions = [
  {id:'meal',bit:1,level:1,title:'Meal',verb:'Serve meal',need:'Hungry',satisfied:'Fed'},
  {id:'walk',bit:2,level:2,title:'Walk',verb:'Go sniffing',need:'Restless',satisfied:'Exercised'},
  {id:'rest',bit:4,level:3,title:'Rest',verb:'Tuck in',need:'Needs settling',satisfied:'Cozy'},
];
export function careDay(zone='UTC',now=new Date()){
 try{
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
 }catch{throw new Error('Choose a valid time zone.');}
}
export function earnedLevel(tasks){
 const done=tasks.filter(task=>task.done).length,total=tasks.length;
 if(!done)return 0;
 if(done===total)return 3;
 return done>=Math.ceil(total/2)?2:1;
}
export function careView(row,tasks,lifetime=0,last=null){
 const unlocked=Math.max(row?.unlocked||0,earnedLevel(tasks));
 const used=row?.used||0,done=tasks.filter(task=>task.done).length,total=tasks.length;
 const thresholds=[1,Math.max(1,Math.ceil(total/2)),Math.max(1,total)];
 return {
  day:row.day,unlocked,used,lifetime,last,
  needs:careActions.map((action,index)=>({...action,done:!!(used&action.bit),ready:unlocked>=action.level&&!(used&action.bit),remaining:Math.max(0,thresholds[index]-done)})),
  tricks:['paw','spin','roll'].filter((_,index)=>lifetime>=[3,8,15][index]),
 };
}
// Stable personality and seeded behavior vary timing without a heavy simulation.
export function personality(name='Biscuit'){
 let hash=0;for(const char of name)hash=(hash*31+char.codePointAt(0))>>>0;
 return ['curious','sleepy','bouncy'][hash%3];
}
export function idleBehavior({care,focused=false,quiet=false,sequence=0,character='curious'}){
 if(focused||quiet)return 'sleep';
 if(care?.used===7)return sequence%4===0?'stretch':'curl';
 if(!(care?.used&1))return sequence%3===0?'bowl':'sniff';
 if(!(care?.used&2))return sequence%3===0?'bow':'explore';
 return character==='sleepy'||sequence%3===0?'yawn':'sit';
}
