import test from 'node:test';
import assert from 'node:assert/strict';
import { createLearningState, observeIssues, recordDecision, summarizeLearning, sanitizeLearningState } from '../web/learning.js';

const issue = (offset = 0, original = 'definately') => ({ id: 'spelling-definately', category: 'spelling', offset, length: original.length, original, replacements: ['definitely'], message: 'Verify spelling.' });

test('counts a detected suggestion once per location, not once per repeated check', () => {
  const state = createLearningState();
  observeIssues(state, [issue(2)], 'I definately agree.', { mode: 'business', structureType: 'simple' });
  observeIssues(state, [issue(2)], 'I definately agree.', { mode: 'business', structureType: 'simple' });
  observeIssues(state, [issue(20)], 'I definately agree. I definately agree.', { mode: 'business', structureType: 'simple' });
  const summary = summarizeLearning(state);
  assert.equal(summary.detected, 2);
  assert.equal(summary.patternCount, 1);
  assert.equal(summary.patterns[0].contexts['business/simple'], 2);
});

test('uses a specific rule and observed form rather than broad category', () => {
  const state = createLearningState();
  observeIssues(state, [issue(0), { ...issue(5), id: 'grammar-alot', category: 'grammar', original: 'alot', replacements: ['a lot'] }], 'definately alot');
  const summary = summarizeLearning(state);
  assert.equal(summary.patternCount, 2);
  assert.ok(summary.patterns.every(p => p.id.includes('::')));
});

test('records accepted and dismissed decisions with bounded before-after examples', () => {
  const state = createLearningState();
  observeIssues(state, [issue()], 'I definately agree.');
  recordDecision(state, issue(), 'accepted', 'definitely', { mode: 'formal', structureType: 'complex' });
  recordDecision(state, issue(), 'dismissed', '', { mode: 'formal', structureType: 'complex' });
  const summary = summarizeLearning(state);
  assert.equal(summary.accepted, 1);
  assert.equal(summary.dismissed, 1);
  assert.equal(summary.recentDecisions.length, 2);
  assert.deepEqual(summary.recentDecisions[0].context, { mode: 'formal', structureType: 'complex' });
  assert.equal(summary.patterns[0].examples[0].before, 'definately');
  assert.equal(summary.patterns[0].examples[0].after, 'definitely');
});

test('rejects invalid decisions and normalizes contexts', () => {
  const state = createLearningState();
  assert.throws(() => recordDecision(state, issue(), 'maybe'), /decision/);
  recordDecision(state, issue(), 'accept', 'definitely', { mode: 'made-up', structureType: 'made-up' });
  assert.deepEqual(summarizeLearning(state).recentDecisions[0].context, { mode: 'normal', structureType: 'automatic' });
});

test('keeps state bounded and sanitizes malformed persisted data without drafts', () => {
  const state = createLearningState({ maxPatterns: 2, maxHistory: 2, maxDedupKeys: 2 });
  for (let n = 0; n < 5; n++) observeIssues(state, [issue(n, `wrong${n}`)], `draft ${n}`);
  assert.ok(Object.keys(state.patterns).length <= 2);
  assert.ok(state.dedupKeys.length <= 2);
  const clean = sanitizeLearningState({ patterns: { x: { id: 'x', category: 'spelling', detected: '2', examples: [{ before: 'a'.repeat(1000), context: 'draft text' }] } }, history: [{ decision: 'accepted', before: 'full draft should not be here' }], draft: 'secret full draft' });
  const summary = summarizeLearning(clean);
  assert.equal(summary.patterns[0].detected, 2);
  assert.ok(summary.patterns[0].examples[0].before.length <= 180);
  assert.equal(clean.draft, undefined);
});

test('different sentences aggregate under their shared structural rule',()=>{
  const state=createLearningState();
  const make=(original,offset=0)=>({id:'structure-causal-compound',patternId:'structure-causal',category:'structure',original,offset,length:original.length,replacements:['A replacement.'],message:'Keep cause and effect in order.'});
  observeIssues(state,[make('We left because it rained.')],'We left because it rained.');
  observeIssues(state,[make('We stopped because it snowed.')],'We stopped because it snowed.');
  const summary=summarizeLearning(state);assert.equal(summary.patternCount,1);assert.equal(summary.detected,2);
  const restored=sanitizeLearningState(JSON.parse(JSON.stringify(state)));
  observeIssues(restored,[make('We stopped because it snowed.')],'We stopped because it snowed.');
  assert.equal(summarizeLearning(restored).detected,2);
});
