export async function handleRequests(request,env,headers={}){
 const reply=(data,status=200)=>Response.json(data,{status,headers:{...headers,'cache-control':'no-store'}});
 const site=new URL(request.url).searchParams.get('site');
 if(!['dog','rides'].includes(site))return reply({error:'Choose a site.'},400);
 if(!['GET','POST'].includes(request.method))return reply({error:'Method not allowed.'},405);
 try{
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS feature_requests (id TEXT PRIMARY KEY, site TEXT NOT NULL, idea TEXT NOT NULL, created INTEGER NOT NULL, author TEXT NOT NULL)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS feature_requests_site_date ON feature_requests(site,created)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS feature_requests_author_date ON feature_requests(author,created)').run();
  if(request.method==='POST'){
   const reader=request.body?.getReader();let size=0,chunks=[];
   if(!reader)return reply({error:'Write an idea first.'},400);
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();return reply({error:'Please keep your idea under 400 characters.'},413);}chunks.push(value);}
   const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
   let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{return reply({error:'Invalid request.'},400);}
   const idea=typeof body.idea==='string'?body.idea.trim():'';
   if(idea.length<5||idea.length>400)return reply({error:'Use 5–400 characters for your idea.'},400);
   const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(request.headers.get('CF-Connecting-IP')||'local'));
   const author=Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
   const now=Date.now();
   const result=await env.DB.prepare('INSERT INTO feature_requests(id,site,idea,created,author) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM feature_requests WHERE author=? AND created>?)<5').bind(crypto.randomUUID(),site,idea,now,author,author,now-3600000).run();
   if(!result.meta.changes)return reply({error:'Thanks for the ideas! Try again in an hour.'},429);
  }
  const rows=await env.DB.prepare('SELECT id,idea,created FROM feature_requests WHERE site=? ORDER BY created DESC,id LIMIT 50').bind(site).all();
  return reply({requests:rows.results});
 }catch{return reply({error:'The request log is unavailable. Please try again.'},503);}
}
