import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../../savetheworld/package.json',import.meta.url));
const {chromium,expect}=require('@playwright/test');
const browser=await chromium.launch({channel:'chrome',headless:true});
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
try{
 for(const scenario of ['normal','no-trailing-slash','missing-css','missing-module','slow-css','no-javascript']){
  const context=await browser.newContext({javaScriptEnabled:scenario!=='no-javascript',viewport:{width:1024,height:700}});
  const page=await context.newPage();
  if(scenario==='no-trailing-slash')await page.route('http://127.0.0.1:8095/dog',route=>route.fulfill({contentType:'text/html',body:html}));
  if(scenario==='missing-css')await page.route('**/dog/style.css',route=>route.abort());
  if(scenario==='missing-module')await page.route('**/dog/group-colors.mjs',route=>route.abort());
  if(scenario==='slow-css')await page.route('**/dog/workspace.css',async route=>{await new Promise(resolve=>setTimeout(resolve,1000));await route.continue();});
  await page.goto('http://127.0.0.1:8095/dog'+(scenario==='no-trailing-slash'?'':'/'),{waitUntil:'domcontentloaded'});
  if(['normal','no-trailing-slash','slow-css'].includes(scenario)){
   await expect(page.locator('html')).toHaveAttribute('data-boot','ready');
   await expect(page.locator('#auth')).toBeVisible();await expect(page.locator('#boot-screen')).toBeHidden();
  }else if(scenario==='no-javascript'){
   assert.match(await page.locator('noscript').evaluate(el=>el.textContent),/needs JavaScript/);await page.screenshot({path:'/private/tmp/good-day-no-javascript.png'});await expect(page.locator('.topbar')).toBeHidden();
  }else{
   await expect(page.locator('#boot-retry')).toBeVisible({timeout:15000});
   await expect(page.locator('#boot-message')).toHaveText('The planner could not finish loading.');
   await expect(page.locator('.topbar')).toBeHidden();
   assert.equal(await page.locator('#boot-screen').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 254, 249)');
   await page.screenshot({path:`/private/tmp/good-day-${scenario}.png`});
  }
  console.log('PASS:',scenario);await context.close();
 }
}finally{await browser.close();}
