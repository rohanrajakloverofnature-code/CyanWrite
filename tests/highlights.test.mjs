import test from 'node:test';
import assert from 'node:assert/strict';
import {highlightSegments} from '../web/highlights.js';
const issue=(offset,original,category='grammar')=>({offset,length:original.length,original,category});
test('preserves draft text and marks exact offsets including emoji and newlines',()=>{
 const text='😀 Hii,\nI is here.';
 const parts=highlightSegments(text,[issue(3,'Hii','spelling'),issue(8,'I is')]);
 assert.equal(parts.map(s=>s.text).join(''),text);
 assert.deepEqual(parts.filter(s=>s.category).map(s=>s.text),['Hii','I is']);
});
test('ignores stale, negative, empty and out-of-range issues',()=>{
 assert.deepEqual(highlightSegments('Hello',[issue(0,'Bye'),issue(-1,'H'),issue(0,''),issue(20,'Hi')]),[{text:'Hello',category:null}]);
});
test('overlaps are partitioned with correctness ahead of style and no duplicated text',()=>{
 const parts=highlightSegments('Hii, I is here.',[issue(0,'Hii, I is here.','structure'),issue(0,'Hii','spelling'),issue(5,'I is')]);
 assert.equal(parts.map(s=>s.text).join(''),'Hii, I is here.');
 assert.equal(parts[0].category,'spelling');
 assert.equal(parts.find(s=>s.text==='I is').category,'grammar');
});
test('markup stays plain text, tabs, spaces and blank lines remain unchanged',()=>{
 const text='<img src=x onerror=alert(1)>\t\n\n  Hii';
 assert.equal(highlightSegments(text,[issue(text.length-3,'Hii','spelling')]).map(s=>s.text).join(''),text);
 assert.deepEqual(highlightSegments('',[]),[]);
});
