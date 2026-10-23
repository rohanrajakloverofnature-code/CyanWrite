import test from 'node:test';
import assert from 'node:assert/strict';
import {completedPrefix,automaticCheckKey,mergeSuggestions} from '../web/check-policy.js';

test('automatic review waits for punctuation and excludes the unfinished tail',()=>{
 assert.equal(completedPrefix('Please review this'), '');
 assert.equal(completedPrefix('  Please review this. Next unfinished'), '  Please review this.');
 assert.equal(completedPrefix('Are the records ready? Yes! Further'), 'Are the records ready? Yes!');
});
test('unfinished typing does not retrigger a paid review; completed sentences and settings do',()=>{
 const opts={mode:'legal',structureType:'automatic'};
 assert.equal(automaticCheckKey('Draft fragment',opts),'');
 assert.equal(automaticCheckKey('Please respond. N',opts),automaticCheckKey('Please respond. Next draft',opts));
 assert.notEqual(automaticCheckKey('Please respond.',opts),automaticCheckKey('Please respond. Next draft.',opts));
 assert.notEqual(automaticCheckKey('Please respond.',opts),automaticCheckKey('Please respond.',{...opts,mode:'business'}));
 assert.notEqual(automaticCheckKey('Please respond.',opts),automaticCheckKey('Please respond.',{...opts,structureType:'compound'}));
 assert.notEqual(automaticCheckKey('Please respond.',opts),automaticCheckKey('Please respond.',opts,[{word:'reply'}]));
});
test('AI sentence rewrites replace conflicting offline style edits but retain grammar fixes',()=>{
 const local=[{offset:0,length:15,original:'I is very busy.',category:'structure',replacements:['I is busy.']},{offset:0,length:4,original:'I is',category:'grammar',replacements:['I am']}];
 const remote=[{offset:0,length:15,original:'I is very busy.',category:'tone',source:'ai',replacements:['I am occupied.']}];
 const merged=mergeSuggestions(local,remote);
 assert.equal(merged.length,2);assert.ok(merged.includes(local[1]));assert.ok(merged.includes(remote[0]));assert.ok(!merged.includes(local[0]));
 assert.equal(mergeSuggestions(remote,remote).length,1);
});
test('unrelated local suggestions remain available with AI results',()=>{
 const first={offset:0,length:5,original:'Hello',category:'tone',replacements:['Good day']};
 const second={offset:8,length:4,original:'test',category:'structure',replacements:['review']};
 assert.equal(mergeSuggestions([first],[second]).length,2);
});

test('a duplicate correction returned by AI retains its AI attribution',()=>{
 const local={offset:0,length:4,original:'I is',category:'grammar',source:'local-rule',replacements:['I am']};
 const remote={...local,source:'ai'};
 assert.deepEqual(mergeSuggestions([local],[remote]),[remote]);
});
