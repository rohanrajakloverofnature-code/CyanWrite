import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';

process.env.OPENAI_API_KEY='test-only-not-a-real-key';
process.env.ALLOWED_ORIGINS='https://appassets.androidplatform.net';
const requests=[];
const provider=http.createServer(async(req,res)=>{let raw='';for await(const c of req)raw+=c;const body=JSON.parse(raw);requests.push(body);const data=JSON.parse(body.messages[1].content);let result=body.messages[0].content.includes('Translate accurately')?{translation:'परीक्षण'}:{issues:[{id:'mock',offset:0,length:data.text.length,original:data.text,replacements:['reviewed'],message:'Mock explanation',category:'grammar',confidence:.8}]};res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}));});
provider.listen(0,'127.0.0.1');await once(provider,'listening');process.env.OPENAI_BASE_URL=`http://127.0.0.1:${provider.address().port}`;
const {createServer}=await import('../server/server.mjs');const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
const post=(path,body,origin=base)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)});

test('static root serves only shared web files',async()=>{const r=await fetch(base+'/');assert.equal(r.status,200);assert.match(await r.text(),/CyanWrite/);for(const path of ['/server/server.mjs','/README.md','/.env','/%2e%2e%2fserver/server.mjs'])assert.notEqual((await fetch(base+path)).status,200);});
test('consent and origin prevent unauthorized provider calls',async()=>{const n=requests.length;assert.equal((await post('/api/analyze',{text:'Draft'})).status,400);assert.equal((await post('/api/translate',{text:'Draft'})).status,400);assert.equal((await post('/api/analyze',{text:'Draft',aiOptIn:true},'https://untrusted.example')).status,403);assert.equal(requests.length,n);});
test('configured mock provider works and disabled grammar is filtered',async()=>{let r=await post('/api/analyze',{text:'Draft',aiOptIn:true,options:{grammar:true}});assert.equal(r.status,200);assert.equal((await r.json()).issues[0].message,'Mock explanation');r=await post('/api/analyze',{text:'Draft',aiOptIn:true,options:{grammar:false}});assert.equal(r.status,200);assert.equal((await r.json()).issues.length,0);});
test('mother-tongue translation request and Android CORS are supported',async()=>{const r=await post('/api/translate',{text:'Test',motherTongue:'Hindi',aiOptIn:true},'https://appassets.androidplatform.net');assert.equal(r.status,200);assert.equal(r.headers.get('access-control-allow-origin'),'https://appassets.androidplatform.net');assert.equal((await r.json()).translation,'परीक्षण');assert.equal(JSON.parse(requests.at(-1).messages[1].content).motherTongue,'Hindi');});
test('server resolves defaults and validates model overrides for both AI paths',async()=>{
 const previous=process.env.OPENAI_MODEL;
 try{
  for(const route of ['/api/analyze','/api/translate']){
   delete process.env.OPENAI_MODEL;
   assert.equal((await post(route,{text:'Draft',aiOptIn:true})).status,200);
   assert.equal(requests.at(-1).model,'gpt-4o-mini');
   process.env.OPENAI_MODEL=' model-override ';
   assert.equal((await post(route,{text:'Draft',aiOptIn:true})).status,200);
   assert.equal(requests.at(-1).model,'model-override');
   process.env.OPENAI_MODEL='2';const count=requests.length;
   assert.equal((await post(route,{text:'Draft',aiOptIn:true})).status,502);
   assert.equal(requests.length,count);
  }
 }finally{if(previous===undefined)delete process.env.OPENAI_MODEL;else process.env.OPENAI_MODEL=previous}
});
test('unconfigured service reports unavailable rather than fake output',async()=>{delete process.env.OPENAI_API_KEY;assert.equal((await post('/api/translate',{text:'Test',aiOptIn:true})).status,503);});
test('explicit local AI opt-in supports a loopback model without an API key',async()=>{process.env.CYANWRITE_LOCAL_AI='true';try{const r=await post('/api/analyze',{text:'Draft',aiOptIn:true});assert.equal(r.status,200);assert.equal((await r.json()).issues[0].message,'Mock explanation');}finally{delete process.env.CYANWRITE_LOCAL_AI;}});
test('no-key local AI refuses non-loopback provider addresses',async()=>{const old=process.env.OPENAI_BASE_URL;process.env.CYANWRITE_LOCAL_AI='true';process.env.OPENAI_BASE_URL='https://example.com/v1';try{assert.equal((await post('/api/translate',{text:'Test',aiOptIn:true})).status,503);}finally{process.env.OPENAI_BASE_URL=old;delete process.env.CYANWRITE_LOCAL_AI;}});
test('web app manifest and worker have browser-safe content types',async()=>{for(const [path,type] of [['/manifest.webmanifest','application/manifest+json'],['/sw.js','text/javascript'],['/icon.svg','image/svg+xml']]){const r=await fetch(base+path);assert.equal(r.status,200);assert.ok(r.headers.get('content-type').startsWith(type));}});
test.after(async()=>{server.closeAllConnections();provider.closeAllConnections();await new Promise(r=>server.close(r));await new Promise(r=>provider.close(r));});
