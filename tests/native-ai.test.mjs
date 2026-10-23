import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeTransport} from '../web/native-ai.js';

test('web browsers use ordinary fetch, not a missing native bridge',()=>{assert.equal(createNativeTransport(undefined),undefined)});
test('native transport passes key only in HTTPS request headers and resolves response',async()=>{
 const host={};let call;
 const transport=createNativeTransport({requestAI(...args){call=args}},host);
 const request=transport('https://provider.example/v1/chat/completions',{headers:{Authorization:'Bearer mock-session-key'},body:'{}'});
 assert.equal(call[1],'https://provider.example/v1/chat/completions');assert.equal(JSON.parse(call[2]).Authorization,'Bearer mock-session-key');
 host.__cyanAIReply(call[0],200,'{"ok":true}');const response=await request;assert.equal(response.ok,true);assert.deepEqual(await response.json(),{ok:true});
});
test('native transport abort cancels one matching request and ignores late callback',async()=>{
 const host={};let id,cancelled;const controller=new AbortController();
 const transport=createNativeTransport({requestAI(value){id=value},cancelAI(value){cancelled=value}},host);
 const request=transport('https://example.com',{signal:controller.signal});controller.abort();
 await assert.rejects(request,{name:'AbortError'});assert.equal(cancelled,id);host.__cyanAIReply(id,200,'{}');
});
test('native errors do not expose provider response or key',async()=>{
 const host={};let id;const transport=createNativeTransport({requestAI(value){id=value}},host);
 const request=transport('https://example.com');host.__cyanAIReply(id,0,'private-provider-error');
 await assert.rejects(request,error=>!error.message.includes('private-provider-error'));
});
test('non-2xx native response is preserved for safe provider status handling',async()=>{
 const host={};let id;const transport=createNativeTransport({requestAI(value){id=value}},host);
 const request=transport('https://example.com');host.__cyanAIReply(id,401,'{}');assert.equal((await request).status,401);
});
