import test from 'node:test';
import assert from 'node:assert/strict';
import { PROVIDERS, requestAI, resolveModel } from '../web/ai.js';
import { createNativeTransport } from '../web/native-ai.js';

const text = 'The plan changed.';
const options = { grammar: true };
const response = body => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });
const analyzeBody = { issues: [] };
const analyzeReply = { choices: [{ message: { content: JSON.stringify(analyzeBody) } }] };
const translateReply = { choices: [{ message: { content: JSON.stringify({ translation: 'योजना बदल गई।' }) } }] };

for (const [provider, expected] of [
  ['gemini', 'gemini-3.8-flash'],
  ['openai', 'gpt-4o-mini'],
  ['deepseek', 'deepseek-flash']
]) {
  test(`resolveModel supplies the ${provider} default for a blank override`, () => {
    assert.equal(resolveModel(provider, ''), expected);
    assert.equal(resolveModel(provider, '   '), expected);
    assert.equal(resolveModel(provider, undefined), expected);
    assert.equal(resolveModel(provider, null), expected);
    assert.equal(PROVIDERS[provider].model, expected);
  });
}

test('resolveModel trims valid overrides and normalizes the optional Gemini models prefix', () => {
  assert.equal(resolveModel('openai', '  gpt-4.1-mini  '), 'gpt-4.1-mini');
  assert.equal(resolveModel('deepseek', '  deepseek-v4-pro  '), 'deepseek-v4-pro');
  assert.equal(resolveModel('gemini', '  gemini-2.5-flash  '), 'gemini-2.5-flash');
  assert.equal(resolveModel('gemini', ' models/gemini-2.5-flash '), 'gemini-2.5-flash');
});

test('Anthropic and custom providers require a nonblank model', () => {
  for (const provider of ['anthropic', 'custom']) {
    for (const override of ['', '  ', undefined, null]) {
      assert.throws(() => resolveModel(provider, override), /model/i);
    }
  }
});

test('resolver rejects numeric-only and malformed model identifiers before transport', () => {
  for (const provider of Object.keys(PROVIDERS)) {
    assert.throws(() => resolveModel(provider, 2), /model/i);
    assert.throws(() => resolveModel(provider, '  2  '), /model/i);
  }
  assert.throws(() => resolveModel('gemini', 'models/gemini-2.5-flash/bad'), /model/i);
  assert.throws(() => resolveModel('gemini', 'models/openai-4o-mini'), /gemini/i);
  assert.throws(() => resolveModel('gemini', 'gemini-2.5-flash?x=1'), /model/i);
  assert.throws(() => resolveModel('openai', {}), /model/i);
  assert.throws(() => resolveModel('deepseek', false), /model/i);
});

test('requestAI never transports an invalid numeric model for any provider', async () => {
  let calls = 0;
  const transport = async () => { calls += 1; return response(analyzeReply); };
  for (const provider of Object.keys(PROVIDERS)) {
    await assert.rejects(requestAI({
      task: 'analyze',
      text,
      options,
      config: { provider, baseUrl: `https://${provider}.example/v1`, model: 2, apiKey: 'secret-key' },
      transport
    }), /model/i);
  }
  assert.equal(calls, 0);
});

test('requestAI uses resolved Gemini model in analyze and translate URLs', async () => {
  const urls = [];
  const transport = async (url) => {
    urls.push(url);
    return response({ candidates: [{ content: { parts: [{ text: JSON.stringify(urls.length === 1 ? analyzeBody : { translation: 'नमस्ते।' }) }] } }] });
  };
  const config = { provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: ' models/gemini-2.5-flash ', apiKey: 'secret-key' };
  assert.deepEqual(await requestAI({ task: 'analyze', text, options, config, transport }), analyzeBody);
  assert.deepEqual(await requestAI({ task: 'translate', text, motherTongue: 'Hindi', config, transport }), { translation: 'नमस्ते।' });
  assert.match(urls[0], /\/models\/gemini-2\.5-flash:generateContent$/);
  assert.match(urls[1], /\/models\/gemini-2\.5-flash:generateContent$/);
  assert.equal(urls.some(url => url.includes('models/models/')), false);
});

test('requestAI sends both tasks through the native bridge using the resolved model', async () => {
  const host = {};
  const calls = [];
  let bridgeTransport;
  const bridge = {
    requestAI(id, url, headers, body) {
      calls.push({ id, url, headers: JSON.parse(headers), body: JSON.parse(body) });
      const payload = calls.length === 1 ? analyzeReply : translateReply;
      queueMicrotask(() => host.__cyanAIReply(id, 200, JSON.stringify(payload)));
    }
  };
  bridgeTransport = createNativeTransport(bridge, host);
  const config = { provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: '  gpt-4o-mini  ', apiKey: 'secret-key' };
  assert.deepEqual(await requestAI({ task: 'analyze', text, options, config, transport: bridgeTransport }), analyzeBody);
  assert.deepEqual(await requestAI({ task: 'translate', text, motherTongue: 'Hindi', config, transport: bridgeTransport }), { translation: 'योजना बदल गई।' });
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.match(call.url, /\/chat\/completions$/);
    assert.equal(call.body.model, 'gpt-4o-mini');
    assert.equal(call.headers.Authorization, 'Bearer secret-key');
  }
});
