import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupColor,validateGroupColor,groupPalette} from '../group-colors.mjs';
test('group assignments normalize case and keep automatic colors stable',()=>{
 assert.deepEqual(validateGroupColor({name:' WORK ',color:'rose'}),{name:'work',color:'rose'});
 assert.equal(groupColor('Work',{work:'rose'}),groupPalette.rose);
 assert.deepEqual(groupColor(' study '),groupColor('Study'));
 assert.equal(groupColor('work'),groupPalette.sage);
 assert.deepEqual(validateGroupColor({name:'Work',color:null}),{name:'work',color:null});
 for(const body of [{name:'',color:'rose'},{name:'x',color:'red'},{name:'x',color:'__proto__'}])assert.throws(()=>validateGroupColor(body));
 assert.doesNotThrow(()=>groupColor('__proto__'));
});
