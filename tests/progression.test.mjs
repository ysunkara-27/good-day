import {test} from 'node:test';
import assert from 'node:assert/strict';
import {progression,hourlyQuote,canPlayground} from '../progression.mjs';
test('streak keeps yesterday alive, ignores future dates, and deduplicates receipts',()=>{const p=progression(['2026-09-14','2026-09-15','2026-09-16','2026-09-16','2026-09-18'],'2026-09-17',15);assert.equal(p.streak,3);assert.equal(p.best,3);assert.equal(p.activeDays,3);assert.equal(p.xp,150);assert.equal(p.level,2);assert.deepEqual(p.companions,['biscuit','mochi']);});
test('a break resets current streak but keeps companions and personal best',()=>{const p=progression(['2026-09-14','2026-09-15','2026-09-16'],'2026-09-19');assert.equal(p.streak,0);assert.equal(p.best,3);assert(p.companions.includes('mochi'));});
test('streak spans month, year and leap-day boundaries',()=>{assert.equal(progression(['2024-02-28','2024-02-29','2024-03-01'],'2024-03-01').streak,3);assert.equal(progression(['2025-12-31','2026-01-01'],'2026-01-01').streak,2);});
test('quotes rotate on the hour and playground permission only belongs to authenticated Yash',()=>{assert.equal(hourlyQuote(0),hourlyQuote(3599999));assert.notEqual(hourlyQuote(0),hourlyQuote(3600000));assert(canPlayground({username:'yash'}));assert(!canPlayground({username:'someone'}));assert(!canPlayground(null));});
