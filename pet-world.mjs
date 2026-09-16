// Small deterministic geometry layer: the dog and toys may only occupy free space.
export const petSize={width:56,height:60};
export function freePoint(point,obstacles,bounds){
 const {x,y}=point,{width,height}=petSize;
 return x>=8&&y>=8&&x+width<=bounds.width-8&&y+height<=bounds.height-8&&obstacles.every(r=>x+width<=r.left||x>=r.right||y+height<=r.top||y>=r.bottom);
}
function crosses(a,b,r){
 let low=0,high=1;
 for(const [start,delta,min,max] of [[a.x,b.x-a.x,r.left,r.right],[a.y,b.y-a.y,r.top,r.bottom]]){
  if(Math.abs(delta)<0.001){if(start<=min||start>=max)return false;continue;}
  let lo=(min-start)/delta,hi=(max-start)/delta;if(lo>hi)[lo,hi]=[hi,lo];
  low=Math.max(low,lo);high=Math.min(high,hi);if(low>=high)return false;
 }
 return high>0&&low<1;
}
export function clearPath(a,b,obstacles,bounds){
 if(!freePoint(a,obstacles,bounds)||!freePoint(b,obstacles,bounds))return false;
 return obstacles.every(r=>!crosses(a,b,{left:r.left-petSize.width,right:r.right,top:r.top-petSize.height,bottom:r.bottom}));
}
export function findPath(from,to,obstacles,bounds){
 if(!freePoint(from,obstacles,bounds)||!freePoint(to,obstacles,bounds))return null;
 if(clearPath(from,to,obstacles,bounds))return [from,to];
 const nodes=[from,to];
 for(const r of obstacles){
  for(const x of [r.left-petSize.width-6,r.right+6])for(const y of [r.top-petSize.height-6,r.bottom+6]){
   const point={x,y};if(freePoint(point,obstacles,bounds))nodes.push(point);
  }
 }
 for(const x of [8,bounds.width-petSize.width-8])for(const y of [8,bounds.height-petSize.height-8]){const point={x,y};if(freePoint(point,obstacles,bounds))nodes.push(point);}
 const distance=nodes.map(()=>Infinity),previous=[],visited=new Set();distance[0]=0;
 while(visited.size<nodes.length){
  let current=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(current<0||distance[i]<distance[current]))current=i;
  if(current<0||!Number.isFinite(distance[current]))break;
  if(current===1){const path=[];for(let i=1;i!=null;i=previous[i])path.unshift(nodes[i]);return path;}
  visited.add(current);
  for(let i=0;i<nodes.length;i++){
   if(visited.has(i)||!clearPath(nodes[current],nodes[i],obstacles,bounds))continue;
   const cost=distance[current]+Math.hypot(nodes[i].x-nodes[current].x,nodes[i].y-nodes[current].y);
   if(cost<distance[i]){distance[i]=cost;previous[i]=current;}
  }
 }
 return null;
}
