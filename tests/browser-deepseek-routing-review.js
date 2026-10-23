// Load as a module AFTER app.js on a private local review copy of web/.
// In native mode the review page must install window.CyanAndroid before app.js.
import '../web/app.js';
const q = s => document.querySelector(s), passed = [];
const assert = (value, label) => {if (!value) throw Error(label); passed.push(label);};
const change = (id, value) => {const n=q(id);if(n.type==='checkbox')n.checked=value;else n.value=value;n.dispatchEvent(new Event('change'));};
const key = () => {q('#ai-api-key').value='routing-ui-mock-not-a-key';q('#ai-api-key').dispatchEvent(new Event('input'));};
const native = new URLSearchParams(location.search).has('native');
const calls = window.__routingCalls || [];
let status=200;
const reply = payload => JSON.stringify({choices:[{message:{content:payload.messages[0].content.includes('Translate the entire text')?'\u007b"translation":"नमस्ते।"}':'{"issues":[]}'}}]});
const original=window.fetch;
if(!native)window.fetch=async(url,init)=>{calls.push({url,method:init.method,body:JSON.parse(init.body)});return new Response(reply(JSON.parse(init.body)),{status});};
try {
  if(new URLSearchParams(location.search).has('persisted')) {
    assert(q('#ai-base-url').value==='https://api.deepseek.com/v1/chat/completions','Saved full endpoint restored on startup');
    assert(q('#ai-request-target').textContent==='Request: POST https://api.deepseek.com/v1/chat/completions','Saved full endpoint resolves once before user edits');
  }
  change('#ai-enabled',false);change('#ai-auto',false);change('#ai-provider','deepseek');key();
  assert(calls.length===0,'Settings/key entry sends no request');
  await q('#ai-test').onclick();assert(calls.length===0,'Test requires consent');
  change('#ai-enabled',true);
  for(const base of ['https://api.deepseek.com','https://api.deepseek.com/v1','https://api.deepseek.com/chat/completions','https://api.deepseek.com/v1/chat/completions/']) {
    change('#ai-base-url',base);assert(q('#ai-api-key').value==='','Changing address clears key');key();
    const expected=base.includes('/v1')?'https://api.deepseek.com/v1/chat/completions':'https://api.deepseek.com/chat/completions';
    assert(q('#ai-request-target').textContent==='Request: POST '+expected,'UI shows resolved POST endpoint');
    let count=calls.length;await q('#ai-test').onclick();
    assert(calls.length===count+1 && calls.at(-1).url===expected,'Test sends one request to canonical endpoint');
    assert(calls.at(-1).method==='POST','Test preserves POST');
    assert(q('#ai-connection-status').textContent.includes('Connection successful'),'Test success rendered');
    q('#editor').value='Hello.';change('#translation-toggle',true);
    count=calls.length;await q('#check').onclick();
    assert(calls.length===count+2,'Manual Check sends analysis and translation');
    assert(calls.slice(-2).every(c=>c.url===expected && c.method==='POST'),'Actual analysis and translation share exact POST endpoint');
  }
  change('#ai-base-url','https://api.deepseek.com/anthropic');key();let count=calls.length;await q('#ai-test').onclick();
  assert(calls.length===count,'Wrong official API path blocked before transport');
  assert(q('#ai-connection-status').textContent.includes('DeepSeek API address'),'Wrong path explains correction');
  change('#ai-base-url','https://api.deepseek.com');key();status=405;window.__routingStatus=405;count=calls.length;await q('#ai-test').onclick();
  assert(calls.length===count+1,'405 has no automatic retry');
  assert(/POST.*HTTP 405/.test(q('#ai-connection-status').textContent),'405 identifies method and status');
  assert(!localStorage.getItem('cyanwrite-v1').includes('routing-ui-mock-not-a-key'),'Key absent from local storage');
  window.__routingReview={passed,count:passed.length,native,mockOnly:true};
} catch(error) {window.__routingReview={passed,error:String(error),native,mockOnly:true};}
finally {window.fetch=original;q('#ai-clear-key').click();change('#ai-enabled',false);}
document.documentElement.dataset.routingReview=JSON.stringify(window.__routingReview);
