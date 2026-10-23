import test from 'node:test';
import assert from 'node:assert/strict';
import {requestAI} from '../web/ai.js';
import {createNativeTransport} from '../web/native-ai.js';

const completion = JSON.stringify({choices:[{message:{content:'{"issues":[]}'}}]});
const variants = [
  ['https://api.deepseek.com', 'https://api.deepseek.com/chat/completions'],
  ['https://api.deepseek.com/', 'https://api.deepseek.com/chat/completions'],
  ['https://api.deepseek.com/v1/', 'https://api.deepseek.com/v1/chat/completions'],
  ['https://api.deepseek.com/chat/completions', 'https://api.deepseek.com/chat/completions'],
  ['https://api.deepseek.com/chat/completions/', 'https://api.deepseek.com/chat/completions'],
  ['https://api.deepseek.com/v1/chat/completions', 'https://api.deepseek.com/v1/chat/completions']
];
const config = baseUrl => ({provider:'deepseek', baseUrl, apiKey:'mock-routing-not-a-key'});
for (const [baseUrl, expected] of variants) {
  test(`web and native requests normalize ${baseUrl}`, async () => {
    for (const task of ['analyze','translate']) {
      for (const native of [false, true]) {
        const body = task === 'translate'
          ? JSON.stringify({choices:[{message:{content:'{"translation":"नमस्ते।"}'}}]}) : completion;
        let url, init;
        const host = {};
        const transport = native ? createNativeTransport({requestAI(id, target, headers, payload) {
          url = target; init = {headers:JSON.parse(headers), body:payload};
          queueMicrotask(() => host.__cyanAIReply(id, 200, body));
        }}, host) : async (target, options) => {
          url = target; init = options; return new Response(body);
        };
        await requestAI({task,text:task === 'analyze' ? 'This is a connection test.' : 'Hello.',motherTongue:'Hindi',config:config(baseUrl),transport});
        assert.equal(url, expected);
        if (!native) {assert.equal(init.method, 'POST'); assert.equal(init.redirect, 'error');}
        assert.equal(init.headers.Authorization, 'Bearer mock-routing-not-a-key');
        assert.equal(JSON.parse(init.body).model, 'deepseek-flash');
      }
    }
  });
}

test('invalid official DeepSeek routes are rejected before sending the key', async () => {
  let calls = 0;
  for (const baseUrl of ['https://api.deepseek.com/anthropic','https://api.deepseek.com/models','https://api.deepseek.com/chat/completions/chat/completions','https://api.deepseek.com/beta']) {
    await assert.rejects(requestAI({text:'Hello.',config:config(baseUrl),transport:async()=>{calls++;return new Response(completion);}}), /DeepSeek.*address/i);
  }
  assert.equal(calls, 0);
});

test('405 identifies POST and correct DeepSeek setup without leaking provider body or retrying', async () => {
  let calls = 0;
  await assert.rejects(requestAI({text:'Hello.',config:config('https://api.deepseek.com'),transport:async()=>{
    calls++; return new Response('private-provider-detail mock-routing-not-a-key', {status:405});
  }}), error => /HTTP 405/.test(error.message) && /POST/.test(error.message) && /https:\/\/api.deepseek.com/.test(error.message) && !/private-provider|mock-routing/.test(error.message));
  assert.equal(calls, 1);
});
