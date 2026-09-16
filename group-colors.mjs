export const groupPalette={
 sage:{label:'Sage',paper:'#e9eedf',accent:'#b2c29c'},
 honey:{label:'Honey',paper:'#f3ead6',accent:'#d5bd82'},
 lavender:{label:'Lavender',paper:'#eee7ef',accent:'#c5afcb'},
 blue:{label:'Blue',paper:'#e4edf0',accent:'#a8c3cc'},
 peach:{label:'Peach',paper:'#f3e4da',accent:'#d7b49a'},
 rose:{label:'Rose',paper:'#f1e1e5',accent:'#ca9aa8'},
};
export const groupKey=name=>name.trim().toLowerCase();
export function groupColor(name,overrides={}){
 const key=groupKey(name);
 if(!key)return {paper:'#eeeedf',accent:'#b9bb97'};
 const choice=Object.hasOwn(overrides,key)?overrides[key]:null;
 if(choice&&Object.hasOwn(groupPalette,choice))return groupPalette[choice];
 const defaults={work:'sage',life:'honey','me time':'lavender'};
 if(Object.hasOwn(defaults,key))return groupPalette[defaults[key]];
 let hash=0;for(const char of key)hash=(hash*31+char.charCodeAt(0))>>>0;
 return Object.values(groupPalette)[hash%Object.keys(groupPalette).length];
}
export function validateGroupColor(body){
 if(typeof body?.name!=='string'||!body.name.trim()||body.name.trim().length>32||!(body.color===null||Object.hasOwn(groupPalette,body.color)))throw new Error('Choose a group name and one of the available colors.');
 return {name:groupKey(body.name),color:body.color};
}
export async function readGroupColors(env,userId){
 const rows=await env.DB.prepare('SELECT name,color FROM dog_group_colors WHERE user_id=?').bind(userId).all();
 return Object.fromEntries(rows.results.map(({name,color})=>[name,color]));
}
