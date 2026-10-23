(async()=>{
 const q=s=>document.querySelector(s),passed=[];
 const assert=(value,label)=>{if(!value)throw Error(label);passed.push(label)};
 const original=window.fetch;let calls=[];
 try{
  q('#ai-auto').checked=false;q('#ai-auto').dispatchEvent(new Event('change'));
  q('#ai-enabled').checked=true;q('#ai-enabled').dispatchEvent(new Event('change'));
  q('#ai-api-key').value='mock-key-not-real';q('#ai-api-key').dispatchEvent(new Event('input'));
  window.fetch=async(url,init)=>{calls.push({url,init});const prompt=JSON.parse(init.body).messages[0].content;const result=prompt.includes('Translate the entire text')?{translation:'नमस्ते।'}:{issues:[{offset:10,length:6,original:'trying',replacements:['attempting'],message:'Mock clarity explanation',category:'clarity'}]};return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}),{status:200})};
  assert(calls.length===0,'Entering key does not request AI');
  q('#translation-toggle').checked=true;q('#translation-toggle').dispatchEvent(new Event('change'));
  await q('#check').onclick();
  assert(calls.length===2,'Manual check requests analysis and translation');
  assert(q('#translation-content').textContent==='नमस्ते।','Translation rendered');
  assert(q('#suggestions').textContent.includes('Mock clarity explanation'),'Validated AI suggestion merged');
  assert(!localStorage.getItem('cyanwrite-v1').includes('mock-key'),'Key is not persisted');
  assert(calls.every(c=>!c.url.includes('mock-key')),'Key is not in URL');
  assert(JSON.parse(calls[0].init.body).messages[0].content.includes('Explain each issue in Hindi'),'Mother tongue in prompt');
  window.fetch=async()=>new Response('{}',{status:401});await q('#check').onclick();
  assert(q('#ai-status').textContent.includes('authentication'),'Authentication failure explained');
  assert(q('#suggestions').textContent.includes('I is'),'Local checks survive AI failure');
  q('#ai-clear-key').click();assert(q('#ai-api-key').value==='','Clear key works');
  q('#ai-enabled').checked=false;q('#ai-enabled').dispatchEvent(new Event('change'));
  q('#translation-toggle').checked=false;q('#translation-toggle').dispatchEvent(new Event('change'));
  const spelling=[...document.querySelectorAll('.suggestion')].find(x=>x.textContent.includes('Hii → Hi'));
  spelling.querySelector('.apply-button').click();assert(q('#editor').value.startsWith('Hi,'),'Spelling Apply works');
  const grammar=[...document.querySelectorAll('.suggestion')].find(x=>x.textContent.includes('I is → I am'));
  grammar.querySelector('.apply-button').click();assert(q('#editor').value==='Hi, I am trying to connect with you.','Grammar Apply works');
  q('#editor').dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true}));assert(q('#editor').value.includes('I is'),'Undo works');
  const grammarAgain=[...document.querySelectorAll('.suggestion')].find(x=>x.textContent.includes('I is → I am'));grammarAgain.querySelector('.apply-button').click();
  document.documentElement.dataset.reviewResult=JSON.stringify({passed,count:passed.length});
 }catch(error){document.documentElement.dataset.reviewResult=JSON.stringify({passed,error:String(error)})}
 finally{window.fetch=original;q('#ai-clear-key').click();q('#ai-enabled').checked=false;q('#ai-enabled').dispatchEvent(new Event('change'));}
})();
