import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, applySuggestion, parseVocabularyCSV } from '../web/engine.js';

test('finds conservative spelling and punctuation rules', () => {
  const issues = analyze('I definately  agree!!');
  assert.ok(issues.some(i => i.category === 'spelling' && i.replacements.includes('definitely')));
  assert.ok(issues.some(i => i.id === 'punctuation-double-space'));
  assert.ok(issues.some(i => i.id === 'punctuation-repeat'));
});
test('feature flags disable categories', () => {
  const issues = analyze('I definately  agree!!', { spelling: false, punctuation: false, grammar: false, clarity: false, structure: false });
  assert.equal(issues.length, 0);
});
test('does not flag correct there are or cannot', () => {
  assert.equal(analyze('There are many books. I cannot attend.').length, 0);
});
test('safe grammar samples preserve case and offer exact corrections', () => {
  const issues = analyze('We discuss about plans. We made alot of progress. Their are details. I look forward to hear from you.');
  assert.deepEqual(issues.filter(i => i.category === 'grammar').map(i => i.replacements[0]), ['discuss', 'a lot', 'There are', 'look forward to hearing']);
});
test('applySuggestion validates offered replacement and stale offsets', () => {
  const issue = analyze('I definately agree.').find(i => i.category === 'spelling');
  assert.equal(applySuggestion('I definately agree.', issue, 'definitely'), 'I definitely agree.');
  assert.throws(() => applySuggestion('Changed text.', issue, 'definitely'), /Stale/);
  assert.throws(() => applySuggestion('I definately agree.', issue, 'certainly'), /not offered/);
});
test('structure suggestions require complete sentences', () => {
  const incomplete = analyze('This is a sentence with many words that keeps going and going and going and going and going and going', { grammar: false, spelling: false, punctuation: false, clarity: false });
  assert.equal(incomplete.some(i => i.category === 'structure'), false);
  const complete = analyze('This is a sentence with many words that keeps going and going and going and going and going and going.', { grammar: false, spelling: false, punctuation: false, clarity: false });
  assert.equal(complete.some(i => i.category === 'structure'), true);
});
test('CSV parser handles quoted commas, headers, and escaped quotes', () => {
  assert.deepEqual(parseVocabularyCSV('word,meaning,context\n"due process","fair process, legal","replace with \'fair process\'"\n"he said ""hello""",greeting,'), [
    { word: 'due process', meaning: 'fair process, legal', context: "replace with 'fair process'" },
    { word: 'he said "hello"', meaning: 'greeting' }
  ]);
});
test('vocabulary is advisory and never replaces with imported context', () => {
  const issues = analyze('The report is good.', { grammar: false, spelling: false, punctuation: false, clarity: false, structure: false, vocab: true, vocabulary: [{ word: 'good', meaning: 'positive', context: 'favorable' }] });
  assert.equal(issues.length, 1); assert.deepEqual(issues[0].replacements, []); assert.equal(issues[0].source, 'user-vocabulary');
  assert.match(issues[0].message, /unverified/);
});
test('empty input is safe', () => assert.deepEqual(analyze(''), []));

test('fixes the requested greeting and common pronoun agreement', () => {
  const issues = analyze('Hii, I is trying to connect with you. He are ready. We is here.');
  assert.deepEqual(issues.filter(i => i.category === 'grammar').map(i => [i.original, i.replacements[0]]), [
    ['I is', 'I am'], ['He are', 'He is'], ['We is', 'We are']
  ]);
  assert.deepEqual(issues.filter(i => i.category === 'spelling').map(i => [i.original, i.replacements[0]]), [['Hii', 'Hi']]);
});

test('covers negative agreement, repeats, multiline, and Unicode offsets', () => {
  const text = 'They does not agree. She do not agree.\n🙂 I is ready. I is ready.';
  const issues = analyze(text);
  assert.equal(issues.filter(i => i.category === 'grammar' && i.original === 'I is').length, 2);
  assert.ok(issues.some(i => i.original === 'They does not' && i.replacements[0] === 'They do not'));
  assert.ok(issues.some(i => i.original === 'She do not' && i.replacements[0] === 'She does not'));
  const unicodeIssue = issues.find(i => i.original === 'I is' && i.offset > 20);
  assert.equal(applySuggestion(text, unicodeIssue, 'I am'), text.replace('🙂 I is', '🙂 I am'));
});

test('does not rewrite correct or quoted metalinguistic text', () => {
  assert.equal(analyze('I am ready. They are ready. “I is” is an example.').filter(i => i.category === 'grammar').length, 0);
});

test('retains every original spelling correction and stable spelling IDs', () => {
  const issues = analyze('recieve seperate occurence definately adress', { structure: false });
  assert.deepEqual(issues.map(i => i.replacements[0]), ['receive', 'separate', 'occurrence', 'definitely', 'address']);
  assert.equal(issues.at(-1).id, 'spelling-adress');
});

test('finds conservative basic subject agreement without overcorrecting', () => {
  const text = 'I has one. You has two. We has three. They has four. He have one. She have two. It have value. You was late. We was ready. They was there.';
  const issues = analyze(text, { structure: false }).filter(i => i.category === 'grammar');
  assert.deepEqual(issues.map(i => [i.original, i.replacements[0]]), [
    ['I has', 'I have'], ['You has', 'You have'], ['We has', 'We have'], ['They has', 'They have'],
    ['He have', 'He has'], ['She have', 'She has'], ['It have', 'It has'],
    ['You was', 'You were'], ['We was', 'We were'], ['They was', 'They were'],
  ]);
  assert.equal(analyze('I have one. You have two. We have three. They have four. He has one. She has two. It has value. I was late. He were ready.', { structure: false }).filter(i => i.category === 'grammar').length, 0);
});

test('guards have agreement in that, if, and wish subjunctive contexts and protects quotes', () => {
  const text = 'That he have options is unusual. If she have time, call. I wish it have value. “I has a quote. He have one.” I has outside.';
  const issues = analyze(text, { structure: false }).filter(i => i.category === 'grammar');
  assert.deepEqual(issues.map(i => [i.original, i.replacements[0]]), [['I has', 'I have']]);
});

test('repairs only the finite verbs in the conservative did auxiliary list', () => {
  const text = "I did went home. You didn't saw it. We did not ate. They DID WROTE notes. I did go home. She did walked home.";
  const issues = analyze(text, { structure: false }).filter(i => i.category === 'grammar');
  assert.deepEqual(issues.map(i => [i.original, i.replacements[0]]), [
    ['did went', 'did go'], ["didn't saw", "didn't see"], ['did not ate', 'did not eat'], ['DID WROTE', 'DID WRITE'],
  ]);
});

test('agreement fixes preserve exact UTF-16 offsets and reanalysis becomes clean', () => {
  const text = '🙂 I has arrived. They was ready.';
  const issues = analyze(text, { structure: false }).filter(i => i.category === 'grammar');
  const afterFirst = applySuggestion(text, issues[0], issues[0].replacements[0]);
  assert.equal(afterFirst, '🙂 I have arrived. They was ready.');
  assert.throws(() => applySuggestion(afterFirst, issues[1], issues[1].replacements[0]), /Stale/);
  const remaining = analyze(afterFirst, { structure: false }).find(i => i.original === 'They was');
  assert.equal(applySuggestion(afterFirst, remaining, 'They were'), '🙂 I have arrived. They were ready.');
  assert.equal(analyze('🙂 I have arrived. They were ready.', { structure: false }).filter(i => i.category === 'grammar').length, 0);
});

test('grammar toggle disables all added agreement rules', () => {
  assert.equal(analyze('I has one. You was late. I did went home.', { grammar: false, structure: false }).length, 0);
});
