// Run on the private local app only. All AI responses are mocked; no provider calls.
(async()=>{
 const q=s=>document.querySelector(s),passed=[],calls=[];
 const assert=(ok,label)=>{if(!ok)throw Error(label);passed.push(label)};
 const change=(id,value)=>{const n=q(id);if(n.type==='checkbox')n.checked=value;else n.value=value;n.dispatchEvent(new Event('change'))};
 const original=window.fetch;
 window.fetch=async(url,init)=>{
  const body=JSON.parse(init.body),prompt=body.messages?.[0]?.content||'';calls.push({url,prompt});
  const text=prompt.slice(prompt.lastIndexOf('TEXT:\n')+6);
  const issues=[];
  if(text.includes('They is ready.'))issues.push({offset:text.indexOf('They is'),length:7,original:'They is',category:'grammar',replacements:['They are'],message:'Use are with they.'});
  if(text.includes('We gotta send the records.'))issues.push({offset:text.indexOf('We gotta send the records.'),length:'We gotta send the records.'.length,original:'We gotta send the records.',category:'tone',replacements:['We need to send the records.'],message:'Use neutral wording for the selected writing mode; tone-only edit.'});
  const source='Because the office is closed, we cannot attend.';
  if(text.includes(source)){
   const target=prompt.match(/Requested structure: (\w+)/)?.[1];
   const replacement=target==='compound'?'The office is closed, so we cannot attend.':target==='complex'?'We cannot attend because the office is closed.':'The office is closed. As a result, we cannot attend.';
   issues.push({offset:text.indexOf(source),length:source.length,original:source,category:'structure',replacements:[replacement],message:'Preserve the cause and effect using the selected clause structure.'});
  }
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({issues})}}]}),{status:200});
 };
 try{
  change('#ai-enabled',false);change('#ai-auto',false);change('#ai-provider','openai');change('#mother-tongue','English');
  q('#ai-api-key').value='general-ui-mock-key';q('#ai-api-key').dispatchEvent(new Event('input'));change('#ai-enabled',true);
  const draft='They is ready. We gotta send the records. Because the office is closed, we cannot attend.';
  q('#editor').value=draft;
  for(const mode of ['administrative','legal','formal','business','normal','literary','high'])for(const style of ['automatic','simple','complex','compound']){
   change('#mode',mode);change('#structure-type',style);await q('#check').onclick();
   const labels=[...document.querySelectorAll('.suggestion-label')].map(n=>n.textContent);
   assert(labels.includes('Grammar · AI')&&labels.includes('Writing mode / tone · AI')&&labels.includes('Sentence structure · AI'),`${mode}/${style}: AI grammar, tone and structure visible (${labels.join(" | ")}; ${q("#ai-status").textContent})`);
   assert(q('#suggestion-context').textContent.includes(q('#mode').selectedOptions[0].text)&&q('#suggestion-context').textContent.includes(q('#structure-type').selectedOptions[0].text),`${mode}/${style}: selected settings visible`);
   assert(calls.at(-1).prompt.includes(`Writing mode: ${mode}`)&&calls.at(-1).prompt.includes(`Requested structure: ${style}`),`${mode}/${style}: settings sent to AI`);
  }
  assert(!localStorage.getItem('cyanwrite-v1').includes('general-ui-mock-key'),'API key never saved');
  assert(q('#assistant-source').textContent==='AI + OFFLINE','AI source badge visible');
  const grammar=[...document.querySelectorAll('.suggestion')].find(n=>n.querySelector('.suggestion-label').textContent==='Grammar · AI');
  grammar.querySelector('.apply-button').click();assert(q('#editor').value.startsWith('They are ready.'),'AI grammar can be applied from suggestions');
  q('#editor').dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true}));assert(q('#editor').value===draft,'Applied change can be undone');
  window.generalReview={passed,count:passed.length,mockOnly:true,calls:calls.length};
 }catch(error){window.generalReview={passed,count:passed.length,error:String(error),mockOnly:true,calls:calls.length}}
 finally{window.generalReviewCleanup=()=>{window.fetch=original;change('#ai-enabled',false);q('#ai-clear-key').click()};if(!document.documentElement.dataset.captureReview)window.generalReviewCleanup();document.documentElement.dataset.generalReview=JSON.stringify(window.generalReview)}
 return window.generalReview;
})();
