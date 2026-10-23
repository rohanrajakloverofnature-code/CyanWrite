import test from 'node:test';
import assert from 'node:assert/strict';
import { PROVIDERS, requestAI, validateAIResult } from '../web/ai.js';
import { createNativeTransport } from '../web/native-ai.js';

const text = 'The plan changed.';
const config = model => ({
  provider: 'deepseek',
  baseUrl: 'https://api.deepseek.com',
  model,
  apiKey: 'deepseek-test-key'
});
const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => typeof body === 'string' ? body : JSON.stringify(body)
});
const completion = content => ({ choices: [{ message: { content } }] });

 test('DeepSeek preset exposes the default and both supported model IDs', () => {
  assert.deepEqual(PROVIDERS.deepseek, {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-flash',
    models: ['deepseek-flash', 'deepseek-v4-pro']
  });
});

test('both DeepSeek models use the exact HTTPS endpoint, bearer auth, and JSON-object format', async () => {
  for (const model of ['deepseek-flash', 'deepseek-v4-pro']) {
    let captured;
    const result = await requestAI({
      text,
      config: config(model),
      transport: async (url, init) => {
        captured = { url, init };
        return response(completion('{"issues":[]}'));
      }
    });
    assert.deepEqual(result, { issues: [] });
    assert.equal(captured.url, 'https://api.deepseek.com/chat/completions');
    assert.equal(captured.init.method, 'POST');
    assert.equal(captured.init.redirect, 'error');
    assert.equal(captured.init.headers.Authorization, 'Bearer deepseek-test-key');
    assert.equal(captured.init.headers['Content-Type'], 'application/json');
    const body = JSON.parse(captured.init.body);
    assert.equal(body.model, model);
    assert.equal(body.response_format.type, 'json_object');
    assert.equal(body.messages[0].role, 'user');
  }
});

test('DeepSeek accepts and validates an exact-span writing suggestion', async () => {
  const result = await requestAI({
    text,
    options: { grammar: true },
    config: config('deepseek-flash'),
    transport: async () => response(completion(JSON.stringify({ issues: [{
      offset: 0,
      length: 3,
      original: 'The',
      category: 'grammar',
      replacements: ['A'],
      message: 'Use the article consistently.'
    }] })))
  });
  assert.equal(result.issues.length, 1);
  assert.deepEqual(result.issues[0], {
    id: 'ai-grammar', source: 'ai', offset: 0, length: 3,
    original: 'The', category: 'grammar', replacements: ['A'],
    message: 'Use the article consistently.'
  });
  assert.deepEqual(validateAIResult({ issues: [{
    offset: 0, length: 3, original: 'The', category: 'grammar',
    replacements: ['The'], message: 'no-op'
  }] }, text, { grammar: true }), { issues: [] });
});

test('DeepSeek translation returns Hindi text only', async () => {
  const result = await requestAI({
    task: 'translate', text: 'Hello.', motherTongue: 'Hindi', config: config('deepseek-flash'),
    transport: async () => response(completion('{"translation":"नमस्ते।"}'))
  });
  assert.deepEqual(result, { translation: 'नमस्ते।' });
});

test('401, 429, and 500 errors are safe and do not expose payloads or keys', async () => {
  for (const status of [401, 429, 500]) {
    const secret = `provider-secret-${status}`;
    await assert.rejects(
      requestAI({
        text,
        config: { ...config('deepseek-flash'), apiKey: secret },
        transport: async () => response(JSON.stringify({ error: secret }), status)
      }),
      error => !error.message.includes(secret) && !error.message.includes('provider-secret') &&
        (status === 401 ? /authentication/i : status === 429 ? /rate limit/i : /temporarily unavailable/i).test(error.message)
    );
  }
});

test('abort errors propagate without being converted to a connection error', async () => {
  const controller = new AbortController();
  const pending = requestAI({
    text, signal: controller.signal, config: config('deepseek-flash'),
    transport: async (_url, init) => new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true });
    })
  });
  controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError' && !/connection failed/i.test(error.message));
});

test('invalid JSON is rejected and unsafe endpoints never reach transport', async () => {
  await assert.rejects(requestAI({
    text, config: config('deepseek-flash'),
    transport: async () => response(completion('{not-json'))
  }), /valid JSON/i);
  let calls = 0;
  for (const baseUrl of [
    'http://api.deepseek.com',
    'https://user:pass@api.deepseek.com',
    'https://api.deepseek.com?key=leak',
    'https://api.deepseek.com/#fragment'
  ]) {
    await assert.rejects(requestAI({
      text, config: { ...config('deepseek-flash'), baseUrl },
      transport: async () => { calls++; return response(completion('{"issues":[]}')); }
    }), /HTTPS/i);
  }
  assert.equal(calls, 0);
});

test('native transport bridge carries the exact DeepSeek request and resolves safely', async () => {
  const host = {};
  let bridgeCall;
  const bridge = { requestAI: (...args) => { bridgeCall = args; } };
  const native = createNativeTransport(bridge, host);
  const pending = requestAI({
    text, config: config('deepseek-v4-pro'), transport: native
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(bridgeCall[1], 'https://api.deepseek.com/chat/completions');
  const headers = JSON.parse(bridgeCall[2]);
  assert.equal(headers.Authorization, 'Bearer deepseek-test-key');
  assert.equal(JSON.parse(bridgeCall[3]).response_format.type, 'json_object');
  host.__cyanAIReply(bridgeCall[0], 200, JSON.stringify(completion('{"issues":[]}')));
  assert.deepEqual(await pending, { issues: [] });
});
