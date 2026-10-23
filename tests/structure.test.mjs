import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze,applySuggestion} from '../web/engine.js';
const quiet={grammar:false,spelling:false,punctuation:false,clarity:false};
const rewrites=(text,options={})=>analyze(text,{...quiet,...options}).filter(x=>x.category==='structure'&&x.replacements.length);

test('compound causal rewrite preserves cause before effect and exact offsets',()=>{
  const text='Intro. The plan changed because costs increased.';
  const i=rewrites(text,{structureType:'compound'})[0];
  assert.equal(i.offset,text.indexOf('The plan'));
  assert.equal(i.original,'The plan changed because costs increased.');
  assert.equal(i.replacements[0],'Costs increased, so the plan changed.');
  assert.equal(i.patternId,'structure-causal');
  assert.equal(applySuggestion(text,i,i.replacements[0]),'Intro. Costs increased, so the plan changed.');
});
test('explicit structures produce actual matching full sentences',()=>{
  for(const [text,target,expected]of [
    ['The plan changed because costs increased.','simple','Costs increased. As a result, the plan changed.'],
    ['Because costs increased, the plan changed.','complex','The plan changed because costs increased.'],
    ['The plan changed because costs increased.','compound','Costs increased, so the plan changed.'],
    ['It rained, so the team continued.','complex','The team continued because it rained.'],
    ['Although it rained, the team continued.','compound','It rained, but the team continued.'],
    ['The plan changed, and the team adapted.','simple','The plan changed. The team adapted.']
  ]){const i=rewrites(text,{structureType:target})[0];assert.ok(i,`${target}: ${text}`);assert.equal(i.structureType,target);assert.equal(i.replacements[0],expected);}
});
test('automatic default avoids manufacturing unnecessary alternative structures',()=>{
  assert.deepEqual(rewrites('The plan changed because costs increased.'),[]);
  const text='The report was late, The client complained.';
  assert.equal(rewrites(text)[0].replacements[0],'The report was late. The client complained.');
  assert.deepEqual(rewrites(text),rewrites(text,{structureType:'unselected'}));
});
test('every writing mode has supported mode-conditioned wording',()=>{
  for(const [mode,text,expected]of [
    ['normal','We work in order to improve.','We work to improve.'],
    ['administrative','Please be advised that the meeting starts.','Please note that the meeting starts.'],
    ['legal','The delay occurred due to the fact that it rained.','The delay occurred because it rained.'],
    ['formal',"We can't attend.",'We cannot attend.'],
    ['business','Please be advised that the meeting starts.','Please note that the meeting starts.'],
    ['literary','She walked in a very quiet manner.','She walked quietly.'],
    ['high','With regard to the report, we work in order to improve.','Regarding the report, we work to improve.']
  ]){const i=rewrites(text,{mode})[0];assert.ok(i,mode);assert.equal(i.mode,mode);assert.equal(i.replacements[0],expected);}
});
test('legal obligations are not rewritten into changed duties',()=>{
  for(const structureType of ['automatic','simple','complex','compound']){
    const text='The supplier shall pay because the buyer has approved the invoice.';
    assert.deepEqual(rewrites(text,{mode:'legal',structureType}),[]);
  }
});
test('mode wording is applied to selected structure replacements too',()=>{
  const i=rewrites("We can't attend because the office is closed.",{mode:'formal',structureType:'compound'})[0];
  assert.equal(i.replacements[0],'The office is closed, so we cannot attend.');
});
test('abbreviations decimals contractions quotes and unfinished tails retain valid offsets',()=>{
  const text='Dr. Smith reviewed 3.14 results. "We can\'t attend because the office is closed." The plan changed because';
  const list=rewrites(text,{structureType:'compound'});
  assert.equal(list.length,1);assert.equal(list[0].original,'"We can\'t attend because the office is closed."');
  assert.equal(list[0].replacements[0],'"The office is closed, so we can\'t attend."');
  assert.ok(list.every(i=>text.slice(i.offset,i.offset+i.length)===i.original));
  assert.equal(rewrites('The plan changed because costs increased',{structureType:'compound'}).length,0);
});
test('questions, proper names, lists and legal modals are not corrupted',()=>{
  assert.equal(rewrites('Did the plan change because costs increased?',{structureType:'compound'}).length,0);
  assert.equal(rewrites('We changed the plan because Alice was late.',{structureType:'compound'})[0].replacements[0],'Alice was late, so we changed the plan.');
  assert.equal(rewrites('We met Alice, Bob, and Carol.',{structureType:'simple'}).length,0);
});
test('whole-sentence candidates include enabled correctness corrections',()=>{
  const i=analyze('We definately changed the plan because costs increased.',{structureType:'compound'}).find(x=>x.category==='structure');
  assert.equal(i.replacements[0],'Costs increased, so we definitely changed the plan.');
  assert.match(analyze('We definately changed the plan because costs increased.',{structureType:'compound',spelling:false}).find(x=>x.category==='structure').replacements[0],/definately/);
});
