import test from 'node:test';
import assert from 'node:assert/strict';
import { PROVIDERS, requestAI, validateAIResult } from '../web/ai.js';

const text = 'The plan changed because costs increased.';
const opts = { grammar: true, spelling: true, punctuation: true, clarity: true, structure: true, vocab: true, mode: 'legal', structureType: 'compound' };
const response = body => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });
const call = async (provider, body, config = {}) => {
  let got;
  const result = await requestAI({ task: 'analyze', text, options: opts, config: { provider, baseUrl: `https://${provider}.example/v1`, model: provider === 'gemini' ? 'gemini-test-model' : 'model-x', apiKey: 'secret-key', ...config }, transport: async (url, init) => { got = { url, init }; return response(body); } });
  return { result, got };
};

for (const [provider, body, expected] of [
  ['openai', { choices: [{ message: { content: '{"issues":[]}' } }] }, ['/chat/completions', 'Bearer secret-key']],
  ['custom', { choices: [{ message: { content: '```json\n{"issues":[]}\n```' } }] }, ['/chat/completions', 'Bearer secret-key']],
  ['gemini', { candidates: [{ content: { parts: [{ text: '{"issues":[]}' }] } }] }, ['/models/gemini-test-model:generateContent', 'secret-key']],
  ['anthropic', { content: [{ type: 'text', text: '{"issues":[]}' }] }, ['/messages', 'secret-key']]
]) test(`${provider} request uses its endpoint and authentication`, async () => {
  const { result, got } = await call(provider, body);
  assert.deepEqual(result, { issues: [] });
  assert.match(got.url, new RegExp(`${expected[0].replace(/[/:]/g, '\\$&')}$`));
  assert.equal(got.init.method, 'POST');
  assert.equal(got.init.redirect, 'error');
  assert.equal(got.init.headers[provider === 'gemini' ? 'x-goog-api-key' : provider === 'anthropic' ? 'x-api-key' : 'Authorization'], provider === 'gemini' || provider === 'anthropic' ? expected[1] : expected[1]);
  assert.equal(got.init.headers['x-goog-api-key']?.includes('secret-key') || got.init.headers['x-api-key']?.includes('secret-key') || got.init.headers.Authorization?.includes('secret-key'), true);
  assert.equal(got.init.url, undefined);
  assert.equal(JSON.parse(got.init.body).model, provider === 'gemini' ? undefined : 'model-x');
});

test('Anthropic includes required browser headers and Gemini key is not in URL', async () => {
  const { got: a } = await call('anthropic', { content: [{ type: 'text', text: '{"issues":[]}' }] });
  assert.equal(a.init.headers['anthropic-version'], '2023-06-01');
  assert.equal(a.init.headers['anthropic-dangerous-direct-browser-access'], 'true');
  const { got: g } = await call('gemini', { candidates: [{ content: { parts: [{ text: '{"issues":[]}' }] } }] });
  assert.equal(g.url.includes('secret-key'), false);
});

test('rejects missing credentials and unsafe endpoints without calling transport', async () => {
  let calls = 0, transport = async () => { calls++; return response({}); };
  await assert.rejects(requestAI({ text, config: { provider: 'openai', baseUrl: 'https://x.test', model: 'm' }, transport }), /API key/);
  await assert.rejects(requestAI({ text, config: { provider: 'openai', baseUrl: 'http://x.test', model: 'm', apiKey: 'k' }, transport }), /HTTPS/);
  await assert.rejects(requestAI({ text, config: { provider: 'openai', baseUrl: 'https://user:pass@x.test', model: 'm', apiKey: 'k' }, transport }), /HTTPS/);
  await assert.rejects(requestAI({ text, config: { provider: 'openai', baseUrl: 'https://x.test/a?key=k', model: 'm', apiKey: 'k' }, transport }), /HTTPS/);
  assert.equal(calls, 0);
});

test('provider errors are status-specific and never expose payload or secrets', async () => {
  const transport = async () => ({ ok: false, status: 401, text: async () => '{"error":"secret details"}' });
  await assert.rejects(requestAI({ text, config: { provider: 'openai', baseUrl: 'https://x.test/v1', model: 'm', apiKey: 'TOPSECRET' }, transport }), e => /authentication/i.test(e.message) && !e.message.includes('secret') && !e.message.includes('TOPSECRET'));
});

test('validation enforces toggles, exact UTF-16 offsets, schema, and no-op rules', () => {
  const result = validateAIResult({ issues: [
    { offset: 0, length: 4, original: 'The ', category: 'grammar', replacements: ['The '], message: 'no-op' },
    { offset: 1, length: 3, original: 'xxx', category: 'spelling', replacements: ['x'], message: 'bad span' },
    { offset: 0, length: 4, original: 'The ', category: 'grammar', replacements: ['A '], message: 'disabled' },
    { offset: 0, length: 4, original: 'The ', category: 'unknown', replacements: ['A'], message: 'bad category' }
  ] }, 'The plan.', { grammar: false, spelling: true });
  assert.deepEqual(result, { issues: [] });
});

test('structure suggestions must match complete sentence boundaries', () => {
  const valid = validateAIResult({ issues: [{ offset: 0, length: text.length, original: text, category: 'structure', replacements: ['Costs increased, so the plan changed.'], message: 'split' }] }, text, opts);
  assert.equal(valid.issues.length, 1);
  const incomplete = validateAIResult({ issues: [{ offset: 0, length: 18, original: 'The plan changed', category: 'structure', replacements: ['The plan changed.'], message: 'complete' }] }, text, opts);
  assert.deepEqual(incomplete, { issues: [] });
});

test('translation returns only the translation field and enforces size', async () => {
  const got = await requestAI({ task: 'translate', text: 'Hello.', motherTongue: 'Hindi', config: { provider: 'openai', baseUrl: 'https://x.test/v1', model: 'm', apiKey: 'k' }, transport: async () => response({ choices: [{ message: { content: '```json\n{"translation":"नमस्ते।"}\n```' } }] }) });
  assert.deepEqual(got, { translation: 'नमस्ते।' });
  await assert.rejects(requestAI({ text: 'x'.repeat(12001), config: { provider: 'openai', model: 'm', apiKey: 'k' }, transport: async () => response({}) }), /12,000/);
});

assert.equal(PROVIDERS.custom.label, 'Custom OpenAI-compatible');


test('malformed schemas are rejected rather than silently reported as successful AI',async()=>{
 const config={provider:'openai',baseUrl:'https://provider.test/v1',model:'m',apiKey:'k'};
 for(const content of ['{}','null','{"issues":"bad"}'])await assert.rejects(requestAI({text,config,transport:async()=>response({choices:[{message:{content}}]})}));
 for(const content of ['{}','{"translation":null}','{"translation":""}'])await assert.rejects(requestAI({task:'translate',text,config,transport:async()=>response({choices:[{message:{content}}]})}),/translation/);
});
test('all seven writing modes and four structure settings reach the provider prompt',async()=>{
 for(const mode of ['normal','administrative','legal','formal','business','literary','high'])for(const structureType of ['automatic','simple','complex','compound']){
  let prompt;await requestAI({text,options:{mode,structureType},motherTongue:'Hindi',config:{provider:'openai',baseUrl:'https://provider.test/v1',model:'m',apiKey:'k'},transport:async(url,init)=>{prompt=JSON.parse(init.body).messages[0].content;return response({choices:[{message:{content:'{"issues":[]}'}}]})}});
  assert.ok(prompt.includes(`Writing mode: ${mode}.`));assert.ok(prompt.includes(`Requested structure: ${structureType}.`));assert.ok(prompt.includes('Explain each issue in Hindi'));
 }
});
test('vocabulary alias validates existing server output and rejects unimported replacements',()=>{
 const item={offset:0,length:3,original:'The',replacements:['A'],message:'Example',category:'vocabulary'};
 assert.equal(validateAIResult({issues:[item]},text,{vocab:true},[{word:'A'}]).issues.length,1);
 assert.equal(validateAIResult({issues:[item]},text,{vocab:false},[{word:'A'}]).issues.length,0);
 assert.equal(validateAIResult({issues:[item]},text,{vocab:true},[]).issues.length,0);
 assert.equal(validateAIResult({issues:[{...item,category:'grammar',replacements:[]}]},text).issues.length,0);
});
test('streamed provider responses are bounded while reading',async()=>{
 const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(513000));c.close()}});
 await assert.rejects(requestAI({text,config:{provider:'openai',baseUrl:'https://provider.test/v1',model:'m',apiKey:'k'},transport:async()=>new Response(stream,{status:200})}),/too large/);
});
test('network exceptions cannot leak key text into the UI',async()=>{
 await assert.rejects(requestAI({text,config:{provider:'openai',baseUrl:'https://provider.test/v1',model:'m',apiKey:'private-key'},transport:async()=>{throw Error('private-key raw error')}}),e=>!e.message.includes('private-key')&&e.message.includes('connection failed'));
});
