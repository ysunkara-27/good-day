export function mountFeatureLog({site,api,host}){
 const button=document.createElement('button');button.type='button';button.className='feature-log-link';button.textContent='Ideas & requests';host.append(button);
 const dialog=document.createElement('dialog');dialog.className='feature-log';
 dialog.innerHTML='<div class="heading"><h2>Ideas & requests</h2><button type="button" aria-label="Close request log">×</button></div><p>A small spot for what we should build next.</p><form><label>Your idea<textarea required minlength="5" maxlength="400" placeholder="One thing that would make this better…"></textarea></label><small>Public log. Please leave out private information. Latest 50 requests.</small><button type="submit">Add request</button></form><p role="status"></p><ol></ol>';
 document.body.append(dialog);const status=dialog.querySelector('[role=status]'),list=dialog.querySelector('ol'),form=dialog.querySelector('form');
 async function load(idea){
  const response=await fetch(`${api}/requests?site=${site}`,{method:idea?'POST':'GET',headers:idea?{'Content-Type':'application/json'}:{},...(idea?{body:JSON.stringify({idea})}:{}),signal:AbortSignal.timeout(15000)});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load requests.');
  list.replaceChildren();for(const row of data.requests){const li=document.createElement('li'),time=document.createElement('small');li.textContent=row.idea;time.textContent=new Date(row.created).toLocaleDateString();li.append(time);list.append(li);}
  status.textContent=idea?'Added to the request log.':data.requests.length?'':'No requests yet. What would you like to see?';
 }
 button.onclick=async()=>{dialog.showModal();status.textContent='Loading…';try{await load();}catch(error){status.textContent=error.message;}};
 dialog.querySelector('[aria-label="Close request log"]').onclick=()=>dialog.close();
 form.onsubmit=async event=>{event.preventDefault();const submit=form.querySelector('button'),input=form.querySelector('textarea'),idea=input.value.trim();submit.disabled=true;status.textContent='Saving…';try{await load(idea);input.value='';}catch(error){status.textContent=error.message;}finally{submit.disabled=false;}};
}
