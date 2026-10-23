// Execute in the app page's MAIN world on a local test origin only.
// Preload cyanwrite-v1 with Gemini aiModel:'2', then reload before executing.
(async () => {
 const q=s=>document.querySelector(s),passed=[],calls=[],original=window.fetch;
 const assert=(value,label)=>{if(!value)throw Error(label);passed.push(label)};
 const change=(id,value)=>{const n=q(id);if(n.type==='checkbox')n.checked=value;else n.value=value;n.dispatchEvent(new Event('change'))};
 const key=()=>{q('#ai-api-key').value='model-ui-mock-not-real';q('#ai-api-key').dispatchEvent(new Event('input'))};
 const waitFor=async predicate=>{for(let i=0;i<80;i++){if(predicate())return;await new Promise(r=>setTimeout(r,25))}throw Error('Timed out waiting for mocked UI result')};
 window.fetch=async(url,init)=>{
  const body=JSON.parse(init.body);calls.push({url,body,headers:init.headers});
  const prompt=body.contents?.[0]?.parts?.[0]?.text||body.messages?.[0]?.content||'';
  const content=JSON.stringify(prompt.includes('Translate the entire text')?{translation:'नमस्ते।'}:{issues:[]});
  return new Response(JSON.stringify(String(url).includes(':generateContent')?{candidates:[{content:{parts:[{text:content}]}}]}:{choices:[{message:{content}}]}),{status:200});
 };
 try{
  q('#settings-top').click();
  assert(q('#ai-provider').value==='gemini','Legacy Gemini provider preserved');
  assert(q('#ai-model-mode').value==='auto'&&q('#ai-model').value==='','Legacy numeric 2 repaired to automatic');
  assert(q('#ai-connection-status').textContent.includes('previous invalid model'),'Migration is visibly explained');
  assert(q('#ai-model-override').hidden,'Manual field hidden in automatic mode');
  assert(q('#ai-resolved-model').textContent.includes('gemini-3.8-flash'),'Exact Gemini default displayed');
  change('#ai-enabled',false);change('#ai-auto',false);key();
  await q('#ai-test').onclick();assert(calls.length===0,'Test requires AI permission');
  change('#ai-enabled',true);assert(calls.length===0,'Key and preference changes send no requests');
  await q('#ai-test').onclick();
  assert(calls.length===1&&calls[0].url==='https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent','Gemini connection test uses exact default URL');
  assert(calls[0].headers['x-goog-api-key']==='model-ui-mock-not-real'&&!calls[0].url.includes('model-ui-mock'),'Gemini key only in header');
  assert(q('#ai-connection-status').textContent.includes('Connection successful with gemini-3.8-flash'),'Connection result identifies effective model');
  assert(!localStorage.getItem('cyanwrite-v1').includes('model-ui-mock-not-real'),'Key excluded from local storage');
  change('#ai-model-mode','manual');assert(!q('#ai-model-override').hidden,'Manual override can be opened');
  change('#ai-model','2');const count=calls.length;await q('#ai-test').onclick();
  assert(calls.length===count&&q('#ai-connection-status').textContent.includes('Invalid model ID'),'New numeric override blocked before transport');
  change('#ai-model','models/gemini-custom-review');await q('#ai-test').onclick();
  assert(calls.at(-1).url.endsWith('/models/gemini-custom-review:generateContent'),'Manual Gemini model prefix normalized');
  change('#ai-model-mode','auto');assert(q('#ai-model').value===''&&q('#ai-model-override').hidden,'Automatic clears manual override');
  change('#translation-toggle',true);q('#editor').value='Hello.';
  q('#check').click();await waitFor(()=>q('#translation-content').textContent.includes('नमस्ते।'));
  assert(calls.slice(-2).every(x=>x.url.endsWith('/models/gemini-3.8-flash:generateContent')),'Writing and translation share Gemini default');
  change('#ai-provider','deepseek');assert(q('#ai-api-key').value==='','Provider change clears key');key();
  assert(q('#ai-model-mode').value==='auto'&&q('#ai-model-help').textContent.includes('deepseek-flash'),'DeepSeek retains automatic flash default');
  await q('#ai-test').onclick();assert(calls.at(-1).url==='https://api.deepseek.com/chat/completions'&&calls.at(-1).body.model==='deepseek-flash','DeepSeek connectivity test remains provider-specific');
  change('#ai-model-mode','manual');change('#ai-model','deepseek-v4-pro');await q('#ai-test').onclick();
  assert(calls.at(-1).body.model==='deepseek-v4-pro','DeepSeek manual Pro override retained');
  change('#ai-provider','openai');key();await q('#ai-test').onclick();
  assert(calls.at(-1).body.model==='gpt-4o-mini','OpenAI automatic default used');
  for(const provider of ['anthropic','custom']){
   change('#ai-provider',provider);key();
   assert(q('#ai-model-mode').value==='manual'&&q('#ai-model-mode').options[0].disabled,provider+' accurately requires manual selection');
   const n=calls.length;await q('#ai-test').onclick();
   assert(calls.length===n&&q('#ai-connection-status').textContent.includes('exact model ID'),provider+' empty model blocked with guidance');
  }
  document.documentElement.dataset.modelReview=JSON.stringify({passed,count:passed.length,mockOnly:true});
 }catch(error){document.documentElement.dataset.modelReview=JSON.stringify({passed,count:passed.length,error:String(error),mockOnly:true})}
 finally{window.fetch=original;q('#ai-clear-key').click();change('#ai-enabled',false);change('#translation-toggle',false)}
})();
