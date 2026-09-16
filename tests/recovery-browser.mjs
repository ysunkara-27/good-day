import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:8097/');
 await page.locator('#auth-switch').click();
 await page.locator('#username').fill(`recovery_${Date.now()}`);
 await page.locator('#password').fill('test-password-123');
 await page.locator('#auth-submit').click();
 await expect(page.locator('#workspace')).toBeVisible();await page.locator('#close-account').click();
 const originalToken=await page.evaluate(()=>localStorage.getItem('good-day-token'));
 await page.route('**/dog/day?*',route=>route.abort());
 await page.reload();
 await expect(page.locator('#load-error')).toBeVisible();
 await expect(page.locator('#retry-load')).toBeInViewport();
 await expect(page.locator('#loading')).toBeHidden();
 assert.equal(await page.evaluate(()=>localStorage.getItem('good-day-token')),originalToken);
 await page.unroute('**/dog/day?*');
 await page.locator('#retry-load').click();
 await expect(page.locator('#workspace')).toBeVisible();await expect(page.locator('#load-error')).toBeHidden();
 await expect(page.locator('#notice')).toBeHidden();
 // A dropped connection recovers when the browser announces it is online again.
 await page.route('**/dog/day?*',route=>route.abort());await page.reload();
 await expect(page.locator('#load-error')).toBeVisible();await page.unroute('**/dog/day?*');
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await expect(page.locator('#workspace')).toBeVisible();
 // Expired sessions show login, never an empty planner or a retry loop.
 await page.route('**/dog/day?*',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'Please log in again.'})}));
 await page.reload();await expect(page.locator('#auth')).toBeVisible();await expect(page.locator('#load-error')).toBeHidden();
 assert.equal(await page.evaluate(()=>localStorage.getItem('good-day-token')),null);
 assert.deepEqual(errors,[]);
 console.log('PASS: failed startup has a visible retry, preserves login, recovers online, and expired sessions return to login.');
}finally{await browser.close();}
