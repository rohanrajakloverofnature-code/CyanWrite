import test from 'node:test';
import assert from 'node:assert/strict';
import { promptFor, requestAI, validateAIResult } from '../web/ai.js';

const modes = ['normal','administrative','legal','formal','business','literary','high'];
const styles = ['automatic','simple','complex','compound'];
const text = 'The review changed because costs increased.';
const response = { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: '{"issues":[]}' } }] }) };

test('mocked AI reaches all seven modes and four sentence styles', async () => {
  let count = 0;
  for (const mode of modes) for (const structureType of styles) {
    let prompt;
    await requestAI({ text, options: { mode, structureType }, config: { provider: 'openai', baseUrl: 'https://mock.example/v1', model: 'mock-model', apiKey: 'test-only' }, transport: async (_url, init) => { count++; prompt = JSON.parse(init.body).messages[0].content; return response; } });
    assert.match(prompt, new RegExp(`Writing mode: ${mode}\\.`));
    assert.match(prompt, new RegExp(`Requested structure: ${structureType}\\.`));
    assert.match(prompt, /Categorize each finding accurately/);
  }
  assert.equal(count, 28);
});

test('validator accepts clear categories and rejects disabled or malformed categories', () => {
  const issues = [
    { offset: 0, length: text.length, original: text, category: 'grammar', replacements: ['The review changed as costs increased.'], message: 'grammar finding' },
    { offset: 0, length: text.length, original: text, category: 'structure', replacements: ['Costs increased, so the review changed.'], message: 'structure finding' },
    { offset: 0, length: text.length, original: text, category: 'tone', replacements: ['The review changed, as costs increased.'], message: 'tone finding' }
  ];
  assert.equal(validateAIResult({ issues }, text, { structureType: 'compound' }).issues.length, 3);
  assert.equal(validateAIResult({ issues: [{ ...issues[0], category: 'structure' }] }, text, { structure: false, structureType: 'compound' }).issues.length, 0);
  assert.equal(validateAIResult({ issues: [{ ...issues[0], category: 'tone', offset: 0, length: 10, original: 'The review' }] }, text).issues.length, 0);
});

test('structure validator does not accept tone-only wording as a requested compound rewrite', () => {
  const item = { offset: 0, length: text.length, original: text, category: 'structure', replacements: ['The review changed as costs increased.'], message: 'tone only' };
  assert.deepEqual(validateAIResult({ issues: [item] }, text, { structureType: 'compound' }), { issues: [] });
});
