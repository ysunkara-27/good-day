import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
if(process.env.RUN_LIVE_TASKPUP!=='1')throw new Error('Set RUN_LIVE_TASKPUP=1 to create a disposable production smoke-test account.');
const site='https://www.taskpup.lol',api='https://hooraas-rides-api.sunkarayashaswi.workers.dev';
for(const suffix of ['/','/privacy/','/terms/']){
 const legacy=await fetch(`https://ysunkara.com/dog${suffix}`);
 assert.equal(legacy.status,200);assert.equal(new URL(legacy.url).origin,site);assert.equal(new URL(legacy.url).pathname,suffix);
 const response=await fetch(`${site}${suffix}`);assert.equal(response.status,200);
}
for(const origin of ['https://taskpup.lol',site]){
 const preflight=await fetch(`${api}/dog/day`,{method:'OPTIONS',headers:{origin,'access-control-request-method':'PUT','access-control-request-headers':'authorization,content-type'}});
 assert(preflight.ok);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
}
// Create through the original site's origin, then sign in on Taskpup to exercise account continuity.
const username=`migration_${Date.now()}`,password=randomUUID();
const signup=await fetch(`${api}/dog/signup`,{method:'POST',headers:{origin:'https://ysunkara.com','content-type':'application/json'},body:JSON.stringify({username,password})});
assert.equal(signup.status,200);
await writeFile('/private/tmp/taskpup-smoke-account.json',JSON.stringify({username}));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],badAssets=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.url().startsWith(site)&&r.status()>=400)badAssets.push(`${r.status()} ${r.url()}`);});
 await page.goto(site);await expect(page.locator('#auth')).toBeVisible();
 await page.locator('#username').fill(username);await page.locator('#password').fill(password);await page.locator('#auth-submit').click();
 await expect(page.locator('#workspace')).toBeVisible();
 await page.locator('#task-name').fill('Migration smoke test');await page.locator('#add-task').click();
 await expect(page.locator('.task-title')).toHaveText('Migration smoke test');
 await page.reload();await expect(page.locator('.task-title')).toHaveText('Migration smoke test');
 const status=await page.evaluate(async api=>{const r=await fetch(`${api}/dog/google/status`,{headers:{authorization:`Bearer ${localStorage.getItem('good-day-token')}`}});return {status:r.status,data:await r.json()};},api);
 assert.equal(status.status,200);assert.equal(status.data.ready,true);
 const authURL=await page.evaluate(async api=>{const r=await fetch(`${api}/dog/google/connect`,{method:'POST',headers:{authorization:`Bearer ${localStorage.getItem('good-day-token')}`,'content-type':'application/json'},body:'{}'});return (await r.json()).url;},api);
 const google=new URL(authURL);assert.equal(google.origin,'https://accounts.google.com');assert.equal(google.searchParams.get('redirect_uri'),`${api}/dog/google/callback`);
 const callback=await fetch(`${api}/dog/google/callback?state=${encodeURIComponent(google.searchParams.get('state'))}&code=smoke-test-not-a-real-code`,{redirect:'manual'});
 assert.equal(callback.status,303);const target=new URL(callback.headers.get('location'));assert.equal(target.origin,site);assert.equal(target.pathname,'/');
 for(const size of [{width:1440,height:900},{width:1366,height:768},{width:1024,height:650},{width:390,height:650}]){
  await page.setViewportSize(size);await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight+1),false,JSON.stringify(size));
 }
 await page.screenshot({path:'/private/tmp/taskpup-live-mobile.png'});
 await page.setViewportSize({width:1440,height:900});await page.screenshot({path:'/private/tmp/taskpup-live-desktop.png'});
 await page.getByRole('button',{name:'Edit Migration smoke test',exact:true}).click();await page.locator('#delete-task').click();await expect(page.locator('.task-row')).toHaveCount(0);
 await page.locator('#account').click();await page.locator('#logout').click();await expect(page.locator('#auth')).toBeVisible();
 assert.deepEqual(errors,[]);assert.deepEqual(badAssets,[]);
 console.log('PASS: production legacy redirects, legal pages, CORS, existing-origin account login, save/reload/delete/logout, Google readiness and callback, four viewport sizes, no JS or asset errors.');
 console.log(`Disposable account for cleanup: ${username}`);
}finally{await browser.close();}
