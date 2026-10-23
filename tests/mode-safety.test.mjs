import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze} from '../web/engine.js';
const modes=['normal','administrative','legal','formal','business','literary','high'];
const styles=['automatic','simple','complex','compound'];
const changes=(text,mode,structureType='automatic')=>analyze(text,{mode,structureType}).filter(i=>i.replacements.length);

test('every mode has concrete reusable wording outcomes distinct from generic clause conversion',()=>{
 const fixtures=[
 ['normal','We will commence the review.','We will start the review.'],
 ['administrative','Please send in the application.','Please submit the application.'],
 ['legal','The parties act as per this agreement.','The parties act in accordance with this agreement.'],
 ['formal','Please get in touch with Amina.','Please contact Amina.'],
 ['business','Please do not hesitate to contact Amina.','Please contact Amina.'],
 ['literary','She moved in a very slow manner.','She moved slowly.'],
 ['high','This is very essential.','This is essential.']
 ];
 for(const [mode,text,expected]of fixtures)for(const style of styles){
  const tone=changes(text,mode,style).find(i=>i.category==='tone');assert.ok(tone,`${mode}/${style}`);assert.equal(tone.replacements[0],expected);assert.equal(tone.structureType,'unchanged');
 }
 assert.ok(!changes('We will commence the review.','formal').some(i=>i.replacements.includes('We will start the review.')),'normal-specific plain-language profile is not applied to formal');
});

test('quoted evidence resists spelling, grammar, clarity, and punctuation edits across all 28 combinations',()=>{
 const text='The witness said, “They is definately  ready!! This is very essential.”';
 for(const mode of modes)for(const style of styles)assert.deepEqual(changes(text,mode,style),[],`${mode}/${style}`);
});

test('nested clauses are not falsely labelled simple or compound by a shallow split',()=>{
 for(const mode of modes)for(const structureType of styles)for(const text of [
  'Because the office is closed, we cannot attend when the meeting starts.',
  'The team that Amina leads arrived, so the review started.',
  'Although the office is closed, we know that the review continues.'
 ])assert.equal(changes(text,mode,structureType).filter(i=>i.category==='structure').length,0,`${mode}/${structureType}: ${text}`);
});

test('legal obligations and conditions are structurally protected in every writing mode',()=>{
 for(const mode of modes)for(const style of styles)for(const text of [
  'The supplier shall pay because the buyer has approved the invoice.',
  'Because the notice arrived, the tenant must pay unless the court orders otherwise.'
 ])assert.equal(changes(text,mode,style).filter(i=>i.category==='structure').length,0,`${mode}/${style}`);
});

test('first-person pronoun remains capitalized inside structural rewrites',()=>{
 const issue=changes('Because I was late, I missed the train.','normal','compound').find(i=>i.category==='structure');
 assert.equal(issue.replacements[0],'I was late, so I missed the train.');
});

test('noun phrases without finite predicates do not generate invented clause rewrites',()=>{
 for(const style of styles)assert.equal(changes('The costs, the expenses.','normal',style).filter(i=>i.category==='structure').length,0);
});

test('negative modal cannot is retained in supported clause transformations in every mode',()=>{
 const source='Because the office is closed, we cannot attend.';
 for(const mode of modes)for(const [style,expected] of [
 ['simple','The office is closed. As a result, we cannot attend.'],
 ['complex','We cannot attend because the office is closed.'],
 ['compound','The office is closed, so we cannot attend.']
 ])assert.equal(changes(source,mode,style).find(i=>i.category==='structure')?.replacements[0],expected,`${mode}/${style}`);
});
