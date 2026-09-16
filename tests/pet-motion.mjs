import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../../savetheworld/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.clock.install();
 await page.goto('http://127.0.0.1:8095/dog/');
 await page.locator('#auth').waitFor({state:'visible'});
 const positions=[];
 // Advance the quiet intervals and inspect actual animated positions along the route.
 for(let i=0;i<22;i++){
  await page.clock.runFor(5000);
  const position=await page.locator('#pet-wanderer').evaluate(el=>{
   for(const animation of el.getAnimations()) animation.finish();
   const r=el.getBoundingClientRect();
   const blockers=[...document.querySelectorAll('.auth-card,.brand,.header-actions,.heading h1')].map(e=>e.getBoundingClientRect());
   return {x:r.x,y:r.y,overlap:blockers.some(b=>r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top)};
  });
  assert.equal(position.overlap,false,'puppy must stay clear of the page content');positions.push(position);
 }
 assert(positions.some(p=>p.y<200),'puppy should reach the top of the page');
 assert(positions.some(p=>p.x>700),'puppy should explore both sides of the page');
 await page.emulateMedia({reducedMotion:'reduce'});
 const before=await page.locator('#pet-wanderer').boundingBox();
 await page.clock.runFor(20000);
 assert.deepEqual(await page.locator('#pet-wanderer').boundingBox(),before);
 console.log('PASS: puppy travels around the page without crossing content, and reduced motion stops travel.');
}finally{await browser.close();}
