import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../web/engine.js';
import { sentenceSpans } from '../web/structure.js';

const modes = ['normal','administrative','legal','formal','business','literary','high'];
const tone = (text, mode) => analyze(text, { mode, structure: false }).filter(x => x.category === 'tone');

test('supported register patterns work conservatively in every mode', () => {
  for (const mode of modes) {
    const items = tone('At this point in time, Dr. Rivera will review 12 files.', mode);
    assert.equal(items.length, 1, mode);
    assert.equal(items[0].replacements[0], 'Now, Dr. Rivera will review 12 files.', mode);
  }
});

test('register preserves names, numbers, modals, negation, and sentence kind', () => {
  const result = tone('Due to the fact that Amina cannot attend, the 2024 report will not change!', 'formal');
  assert.equal(result.length, 1);
  assert.equal(result[0].replacements[0], 'Because Amina cannot attend, the 2024 report will not change!');
});

test('quoted evidence remains verbatim while surrounding prose can be reviewed in every mode', () => {
  for (const mode of modes) {
    const text = 'The report says "at this point in time". At this point in time, the review continues.';
    const items = tone(text, mode);
    assert.equal(items.length, 1, mode);
    assert.equal(items[0].original, 'At this point in time, the review continues.');
    assert.equal(items[0].replacements[0], 'Now, the review continues.');
  }
});

test('sentence spans handle paragraphs, abbreviations, decimals, and closing quotes', () => {
  const spans = sentenceSpans('Dr. Lee used 3.14 units.\n\nHe said, "Wait!" Then left.');
  assert.deepEqual(spans.map(x => x.original), [
    'Dr. Lee used 3.14 units.',
    'He said, "Wait!"',
    'Then left.'
  ]);
});

test('unsupported wording is a no-op instead of an invented rewrite', () => {
  for (const mode of modes) assert.deepEqual(tone('The shell is intact.', mode), [], mode);
});

test('multi-sentence quoted evidence cannot be restructured or restyled in any mode',()=>{
 for(const mode of modes)for(const structureType of ['automatic','simple','complex','compound']){
  const text='“At this point in time, we wait. Because the office is closed, we cannot attend.”';
  assert.deepEqual(analyze(text,{mode,structureType}).filter(i=>['structure','tone'].includes(i.category)),[],`${mode}/${structureType}`);
 }
});
