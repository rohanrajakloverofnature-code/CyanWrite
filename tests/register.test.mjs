import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze,applySuggestion} from '../web/engine.js';

const screenshot='Hey, what are you doing there? What the hell are you here for?';
const suggestions=(text,options={})=>analyze(text,{mode:'legal',...options}).filter(x=>['tone','structure'].includes(x.category));

test('screenshot yields two completed legal questions with exact whole-sentence offsets',()=>{
  const list=suggestions(screenshot);
  assert.equal(list.length,2);
  assert.deepEqual(list.map(x=>x.replacements[0]),['What are you doing there?','What are you here for?']);
  for(const i of list){
    assert.equal(screenshot.slice(i.offset,i.offset+i.length),i.original);
    assert.equal(i.mode,'legal');
    assert.equal(i.category,'tone');
    assert.equal(i.structureType,'unchanged');
    assert.match(i.message,/wording suggestion only/);
  }
  let applied=screenshot;
  for(const i of [...list].reverse())applied=applySuggestion(applied,i,i.replacements[0]);
  assert.equal(applied,'What are you doing there? What are you here for?');
  assert.equal(screenshot,'Hey, what are you doing there? What the hell are you here for?');
});

test('every selected structure keeps legal question tone review without falsely claiming conversion',()=>{
  for(const structureType of ['automatic','simple','complex','compound']){
    const list=suggestions(screenshot,{structureType});
    assert.equal(list.length,2,structureType);
    assert.ok(list.every(i=>i.replacements[0].endsWith('?')));
    assert.ok(list.every(i=>i.structureType==='unchanged'));
    if(structureType!=='automatic')assert.ok(list.every(i=>i.message.includes(`requested ${structureType} structure is not being claimed`)));
  }
});

test('professional registers neutralize supported profanity; normal and literary retain voice',()=>{
  for(const mode of ['administrative','legal','formal','business','high']){
    const list=suggestions('Why the hell are you here?',{mode});
    assert.equal(list[0].replacements[0],'Why are you here?',mode);
    assert.equal(list[0].mode,mode);
  }
  for(const mode of ['normal','literary'])assert.deepEqual(suggestions(screenshot,{mode}),[],mode);
});

test('tone does not fire before sentence completion and applies to exclamations without inventing statements',()=>{
  assert.deepEqual(suggestions('What the hell are you here for'),[]);
  assert.equal(suggestions('What the hell are you doing!')[0].replacements[0],'What are you doing!');
  assert.equal(suggestions('Hey, what are you doing there? Why the hell')[0].original,'Hey, what are you doing there?');
});

test('legal mode preserves quoted evidence including multi-sentence quotations and mixed quoted clauses',()=>{
  for(const text of [
    '"What the hell are you here for?"',
    '“Hey, what are you doing there? What the hell are you here for?”',
    "'Hey, what the hell are you here for?'",
    '‘Hey, what the hell are you here for?’',
    'The witness said, "What the hell are you here for?"',
    'The clause says "shall pay", so the buyer must pay.',
    '"We can\'t attend because the office is closed."',
  ])assert.deepEqual(suggestions(text,{structureType:'compound'}),[],text);
  const text='"What the hell?" Why the hell are you here?';
  const list=suggestions(text);
  assert.equal(list.length,1);
  assert.equal(list[0].original,'Why the hell are you here?');
});

test('religious references, titles and lexical substrings are not censored',()=>{
  for(const text of ['The doctrine describes hell.','The town is called Hell.','The shell is intact.','Hell is discussed in the book.'])assert.deepEqual(suggestions(text),[],text);
});

test('mode-only suggestions remain available without structure checks and respect both feature switches',()=>{
  assert.equal(suggestions(screenshot,{structure:false}).length,2);
  assert.equal(suggestions(screenshot,{clarity:false}).length,2);
  assert.deepEqual(suggestions(screenshot,{structure:false,clarity:false}),[]);
});

test('selected structural transformations also use neutral register and retain legal modals',()=>{
  const i=suggestions('We can\'t attend because the office is closed.',{mode:'business',structureType:'compound'})[0];
  assert.equal(i.structureType,'compound');
  assert.equal(i.replacements[0],'The office is closed, so we cannot attend.');
  for(const structureType of ['simple','complex','compound']){
    assert.deepEqual(suggestions('The supplier shall pay because the buyer has approved the invoice.',{structureType}),[]);
    const j=suggestions('Hey, the supplier shall pay.',{structureType})[0];
    assert.ok(j.replacements[0].includes('shall pay'));
  }
});

test('safe correctness fixes are folded into mode-only whole-sentence suggestions',()=>{
  const text='Hey, what the hell is the adress?';
  assert.equal(suggestions(text)[0].replacements[0],'What is the address?');
  assert.equal(suggestions(text,{spelling:false})[0].replacements[0],'What is the adress?');
});
