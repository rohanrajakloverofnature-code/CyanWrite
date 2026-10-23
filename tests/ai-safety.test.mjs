import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAIResult} from '../web/ai.js';
const issue=(text,replacement,category='tone')=>({offset:0,length:text.length,original:text,category,replacements:[replacement],message:'Review this change.'});
const validate=(text,replacement,category='tone',structureType='automatic')=>validateAIResult({issues:[issue(text,replacement,category)]},text,{mode:'legal',structureType}).issues;

test('AI rejects changed modal identity, not just a changed number of modals',()=>{
 for(const category of ['tone','structure','grammar','clarity'])assert.deepEqual(validate('The tenant shall pay.','The tenant may pay.',category),[]);
});
test('AI rejects removed, reversed, or substituted conditions and negation',()=>{
 for(const [a,b]of [
 ['The tenant must pay unless the court objects.','The tenant must pay.'],
 ['The tenant must pay unless the court objects.','The tenant must pay if the court objects.'],
 ['The tenant must not pay.','The tenant must pay.']
 ])assert.deepEqual(validate(a,b),[]);
});
test('AI permits safe contraction expansion without changing modal force',()=>{
 assert.equal(validate("We can't attend.",'We cannot attend.').length,1);
 assert.equal(validate("We won't attend.",'We will not attend.').length,1);
});
test('AI rejects wording-only structural claims even for automatic or already complex text',()=>{
 for(const structureType of ['automatic','complex'])assert.deepEqual(validate('We cannot attend because the office is closed.','We cannot attend because the office is shut.','structure',structureType),[]);
});
test('AI preserves genuine split, cause/effect recombination, and clause reordering fixtures',()=>{
 const source='Because the office is closed, we cannot attend.';
 for(const [style,replacement]of [
 ['simple','The office is closed. As a result, we cannot attend.'],
 ['complex','We cannot attend because the office is closed.'],
 ['compound','The office is closed, so we cannot attend.']
 ])assert.equal(validate(source,replacement,'structure',style).length,1,style);
});
test('AI preserves quoted evidence even when a provider categorizes the edit as grammar',()=>{
 const text='The witness said, “They is ready.”';const offset=text.indexOf('They is');
 assert.deepEqual(validateAIResult({issues:[{offset,length:7,original:'They is',category:'grammar',replacements:['They are'],message:'Agreement.'}]},text).issues,[]);
});
