import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {localDay} from '../model.mjs';
const require=createRequire(import.meta.url);
const {chromium,expect}=require('@playwright/test');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},timezoneId:'America/New_York'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const now=new Date(),day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const tomorrow=new Date(`${day}T12:00:00`);tomorrow.setDate(tomorrow.getDate()+1);
 let connected=true,failed=false,reconnect=false;
 const events=[{id:'meeting',title:'Team check-in',busy:true,start:{dateTime:`${day}T09:00:00-04:00`},end:{dateTime:`${day}T10:00:00-04:00`},url:'https://calendar.google.com/calendar/u/0/r'},
 {id:'day',title:'Office closed',busy:true,start:{date:day},end:{date:localDay(tomorrow)}},
 {id:'html',title:'<img src=x onerror=alert(1)>',busy:false,start:{dateTime:`${day}T13:00:00-04:00`},end:{dateTime:`${day}T13:30:00-04:00`},url:null}];
 // Google is mocked at the API boundary: no real account or calendar is used.
 await page.route('**/dog/google/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/status'))return route.fulfill({json:{ready:true,connected,reconnect}});
  if(path.endsWith('/disconnect')){connected=false;return route.fulfill({json:{connected:false}});}
  if(path.endsWith('/events'))return failed?route.fulfill({status:502,json:{error:'Calendar could not refresh. Please try again.'}}):route.fulfill({json:{connected:true,events,updated:Date.now()}});
  return route.fulfill({status:503,json:{error:'Test provider is not connected.'}});
 });
 await page.goto('http://127.0.0.1:8097/');
 await page.locator('#auth-switch').click();await page.locator('#username').fill(`cal_${Date.now()}`);await page.locator('#password').fill('test-password-123');await page.locator('#auth-submit').click();await expect(page.locator('#onboarding-intro')).toBeVisible();await page.locator('#onboarding-done').click();
 await expect(page.locator('.calendar-event')).toHaveCount(2);
 await expect(page.locator('#all-day-events')).toContainText('Office closed');
 await expect(page.locator('#percent')).toHaveText('0%');assert.equal(await page.locator('.calendar-event input,.calendar-event button').count(),0);
 assert.equal(await page.locator('.calendar-event img').count(),0);
 await page.locator('#start').fill('09:00');await page.locator('#start').press('Tab');
 await page.locator('#group-details summary').click();await page.locator('#group').fill('Work');await page.locator('#group-color').selectOption('rose');await expect(page.locator('#group-color-status')).toHaveText('Group color saved.');
 await page.locator('#task-name').fill('Write a note');await page.locator('#add-task').click();
 await expect(page.getByRole('button',{name:'Change start time for Write a note'})).toContainText('10:00 am');
 assert.equal(await page.locator('.task-row:not(.calendar-event) .task-card').first().evaluate(el=>el.style.getPropertyValue('--paper')),'#f1e1e5');
 await page.reload();await expect(page.getByRole('checkbox',{name:'Complete: Write a note'})).toBeVisible();assert.equal(await page.locator('.task-row:not(.calendar-event) .task-card').first().evaluate(el=>el.style.getPropertyValue('--paper')),'#f1e1e5');
 await page.locator('[data-agenda="tasks"]').click();await expect(page.locator('.calendar-event')).toHaveCount(0);await expect(page.locator('#all-day-events')).toBeHidden();await expect(page.getByRole('button',{name:'Change start time for Write a note'})).toContainText('10:00 am');
 await page.locator('[data-agenda="calendar"]').click();await expect(page.locator('.calendar-event')).toHaveCount(2);await expect(page.getByRole('checkbox')).toHaveCount(0);
 await page.locator('[data-agenda="all"]').click();
 for(const [width,height] of [[1366,768],[1024,650],[390,650]]){
  await page.setViewportSize({width,height});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth),true,`Connected agenda fits ${width}x${height}`);
  await page.screenshot({path:`/private/tmp/good-day-connected-${width}.png`});
 }
 await page.setViewportSize({width:1440,height:1000});

 await page.getByRole('button',{name:'Change start time for Write a note'}).click();await page.locator('#edit-group-color').selectOption('lavender');await expect(page.locator('#edit-group-color-status')).toHaveText('Group color saved.');await page.locator('#edit-start').fill('09:15');await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('.overlap-chip')).toHaveCount(1);
 await page.getByRole('checkbox',{name:'Complete: Write a note'}).click();await expect(page.locator('#percent')).toHaveText('100%');
 await page.locator('#account').click();await expect(page.locator('#google-status')).toHaveText('Connected');
 await page.screenshot({path:'/private/tmp/good-day-calendar-account.png',fullPage:true});
 await page.locator('#close-account').click();
 await page.screenshot({path:'/private/tmp/good-day-calendar.png',fullPage:true});
 failed=true;await page.locator('#calendar-retry').click();await expect(page.locator('#calendar-status-text')).toContainText('Showing the last update');await expect(page.locator('.calendar-event')).toHaveCount(2);
 // Changing days after a failed refresh must not retain another day's events.
 await page.locator('#day').fill(localDay(tomorrow));await page.locator('#day').press('Tab');
 await expect(page.locator('.calendar-event')).toHaveCount(0);await expect(page.locator('#calendar-status-text')).toContainText('Calendar could not refresh');
 failed=false;await page.locator('#today').click();await expect(page.locator('.calendar-event')).toHaveCount(2);
 reconnect=true;await page.locator('#calendar-retry').click();await expect(page.locator('#calendar-status-text')).toContainText('needs reconnecting');
 await page.locator('#calendar-retry').click();await expect(page.locator('#google-connect')).toHaveText('Reconnect Google Calendar');
 await page.locator('#google-disconnect').click();await expect(page.locator('#google-connect')).toHaveText('Connect Google Calendar');await expect(page.locator('.calendar-event')).toHaveCount(0);await expect(page.locator('#all-day-events')).toBeHidden();
 await page.locator('#close-account').click();await expect(page.locator('#agenda-controls')).toBeHidden();await expect(page.locator('#calendar-status')).toBeHidden();
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);
 console.log('PASS: account menu, read-only event display, all-day display, safe event titles, tasks avoiding busy events, conflict flags, task-only progress, refresh failure retaining events, reconnect, disconnect, responsive layout. Google requests mocked.');
}finally{await browser.close();}
