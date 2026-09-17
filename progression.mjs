export const companions = [
 {id:'biscuit',name:'Biscuit',species:'dog',coat:'honey',days:0},
 {id:'mochi',name:'Mochi',species:'cat',coat:'cream',days:3},
 {id:'pepper',name:'Pepper',species:'dog',coat:'cloud',days:7},
 {id:'cocoa',name:'Cocoa',species:'dog',coat:'cocoa',days:14},
 {id:'luna',name:'Luna',species:'cat',coat:'cloud',days:30},
];
const previous=day=>{const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-1);return date.toISOString().slice(0,10);};
export function progression(days,today,lifetime=0){
 const dates=[...new Set(days)].filter(d=>d<=today).sort();let best=0,chain=0,last;
 for(const date of dates){chain=last===previous(date)?chain+1:1;best=Math.max(best,chain);last=date;}
 const earned=new Set(dates);let cursor=earned.has(today)?today:previous(today),streak=0;
 while(earned.has(cursor)){streak++;cursor=previous(cursor);}
 return {streak,best,activeDays:dates.length,xp:lifetime*10,level:1+Math.floor(lifetime/10),companions:companions.filter(p=>p.days<=best).map(p=>p.id)};
}
export const encouragements=[
 'One step in front of another. That is how a long way begins.',
 'Small actions compound. Today’s little win is tomorrow’s head start.',
 'You do not need a perfect day. Give the next task a little attention.',
 'Consistency is built one return at a time. Welcome back.',
 'A few focused minutes count. Start where you are.',
 'Progress can be quiet. The small things you finish still add up.',
 'Rest is part of the rhythm. Come back when you are ready.',
 'Your next step can be smaller than you think.',
 'Keep showing up. Repetition turns effort into a habit.',
 'A missed day does not erase what you have built.',
 'Do one useful thing, then let that be enough to begin.',
 'Little by little is still forward.',
];
export const hourlyQuote=(time=Date.now())=>encouragements[Math.floor(time/3600000)%encouragements.length];
export const canPlayground=user=>user?.username==='yash';
