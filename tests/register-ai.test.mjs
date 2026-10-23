import test from 'node:test';
import assert from 'node:assert/strict';
import { requestAI } from '../web/ai.js';

const response = body => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });
const config = { provider: 'openai', baseUrl: 'https://provider.test/v1', model: 'test-model', apiKey: 'test-key' };

async function promptFor(options = {}) {
  let prompt;
  await requestAI({
    text: 'Hey, what are you doing there? What the hell are you here for?',
    options,
    config,
    transport: async (_url, init) => {
      prompt = JSON.parse(init.body).messages[0].content;
      return response({ choices: [{ message: { content: '{"issues":[]}' } }] });
    }
  });
  return prompt;
}

test('formal and legal prompts distinguish register from grammar and neutralize unsafe casual language', async () => {
  for (const mode of ['administrative', 'legal', 'formal', 'business', 'high']) {
    const prompt = await promptFor({ mode, structureType: 'automatic' });
    assert.match(prompt, /register .* distinct from grammar/i);
    assert.match(prompt, /neutralize casual, slang, insulting, or profane language/i);
    assert.match(prompt, /Preserve verbatim quoted text/i);
    assert.match(prompt, /no issue\/replacement rather than guessing/i);
  }
});

test('structure instructions preserve sentence function and requested clause shape', async () => {
  const prompt = await promptFor({ mode: 'formal', structureType: 'compound' });
  assert.match(prompt, /For simple use independent clauses/i);
  assert.match(prompt, /for complex retain a main and subordinate clause/i);
  assert.match(prompt, /for compound coordinate independent clauses/i);
  assert.match(prompt, /Do not change a question or exclamation into an assertion/i);
  assert.match(prompt, /only to complete sentences/i);
});

test('normal and literary prompts preserve everyday or expressive voice', async () => {
  for (const mode of ['normal', 'literary']) {
    const prompt = await promptFor({ mode, structureType: 'automatic' });
    assert.match(prompt, mode === 'normal' ? /preserve the everyday voice/i : /literary preserves expressive voice/i);
  }
});
