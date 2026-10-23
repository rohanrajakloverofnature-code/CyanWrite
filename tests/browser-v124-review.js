// Browser-only review harness. Synthetic key and mocked responses; no provider traffic.
(async()=>{
 const q=s=>document.querySelector(s),passed=[],calls=[];
 const assert=(ok,label)=>{if(!ok)throw Error(label);passed.push(label)};
 const change=(id,value)=>{const n=q(id);if(n.type==='checkbox')n.checked=value;else n.value=value;n.dispatchEvent(new Event('change'))};
 const original=window.fetch;
 window.fetch=async(url,init)=>{
  const body=JSON.parse(init.body),prompt=body.messages?.[0]?.content||'';calls.push({url,prompt});
  const text=prompt.slice(prompt.lastIndexOf('TEXT:\n')+6),issues=[];
  if(text.includes('They is ready.'))issues.push({offset:text.indexOf('They is'),length:7,original:'They is',category:'grammar',replacements:['They are'],message:'Use are with they.'});
  const tone='At this point in time, the team is ready!';
  if(text.includes(tone))issues.push({offset:text.indexOf(tone),length:tone.length,original:tone,category:'tone',replacements:['Now, the team is ready!'],message:'Remove a wordy expression; wording only, structure unchanged.'});
  const source='Because the office is closed, we cannot attend.';
  if(text.includes(source)){
   const target=prompt.match(/Requested structure: (\w+)/)?.[1];
   const replacement=target==='compound'?'The office is closed, so we cannot attend.':target==='complex'?'We cannot attend because the office is closed.':'The office is closed. As a result, we cannot attend.';
   issues.push({offset:text.indexOf(source),length:source.length,original:source,category:'structure',structureType:target==='automatic'?'simple':target,replacements:[replacement],message:'Keep the stated cause and effect; apply the requested clause structure.'});
  }
  return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({issues})}}]}),{status:200});
 };
 try{
  change('#ai-enabled',false);change('#ai-auto',false);change('#ai-provider','openai');change('#mother-tongue','English');
  q('#ai-api-key').value='v124-synthetic-review-key';q('#ai-api-key').dispatchEvent(new Event('input'));change('#ai-enabled',true);
  const draft='They is ready. At this point in time, the team is ready! Because the office is closed, we cannot attend.';
  q('#editor').value=draft;
  for(const mode of ['administrative','legal','formal','business','normal','literary','high'])for(const style of ['automatic','simple','complex','compound']){
   change('#mode',mode);change('#structure-type',style);await q('#check').onclick();
   const labels=[...document.querySelectorAll('.suggestion-label')].map(n=>n.textContent);
   assert(labels.includes('Grammar · AI')&&labels.includes('Writing mode / tone · AI')&&labels.includes('Sentence structure · AI'),`${mode}/${style}: labelled AI results (${labels.join(' | ')}; ${q('#ai-status').textContent})`);
   assert(document.querySelectorAll('.suggestion-group').length===3,`${mode}/${style}: three separate review lanes`);
   assert([...document.querySelectorAll('[data-group="grammar"] .suggestion')].every(n=>!/Sentence structure|Writing mode/.test(n.querySelector('.suggestion-label').textContent)),`${mode}/${style}: grammar lane is separate`);
   assert(q('#suggestion-context').textContent.includes(q('#mode').selectedOptions[0].text)&&q('#suggestion-context').textContent.includes(q('#structure-type').selectedOptions[0].text),`${mode}/${style}: selected settings shown`);
   assert(calls.at(-1).prompt.includes(`Writing mode: ${mode}`)&&calls.at(-1).prompt.includes(`Requested structure: ${style}`),`${mode}/${style}: settings sent to mock`);
  }
  assert(!localStorage.getItem('cyanwrite-v1').includes('v124-synthetic-review-key'),'Synthetic key not persisted');
  assert(q('#assistant-source').textContent==='AI + OFFLINE','AI source shown');
  const grammar=[...document.querySelectorAll('.suggestion')].find(n=>n.querySelector('.suggestion-label').textContent==='Grammar · AI');
  grammar.querySelector('.apply-button').click();assert(q('#editor').value.startsWith('They are ready.'),'AI correction applies from panel');
  q('#editor').dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true}));assert(q('#editor').value===draft,'One-step undo restores draft');
  for(const group of ['grammar','structure','mode']){
   q(`[data-filter="${group}"]`).click();assert(document.querySelectorAll('.suggestion-group').length===1&&q('.suggestion-group').dataset.group===group,`${group}: filter isolates lane`);
  }
  q('[data-filter="all"]').click();
  change('#ai-enabled',false);q('#ai-clear-key').click();change('#mode','legal');change('#structure-type','complex');q('#editor').value='What are you doing there?';await q('#check').onclick();
  assert(q('#structure-status').textContent.includes('no structural change proposed'),'Unsupported question does not claim complex conversion');
  assert(document.querySelectorAll('.suggestion-group').length===3,'Empty categories remain visible');
  const width=document.documentElement.clientWidth;
  assert(document.documentElement.scrollWidth<=width+1,'No horizontal page overflow');
  window.v124Review={passed,count:passed.length,mockOnly:true,calls:calls.length,width};
 }catch(error){window.v124Review={passed,count:passed.length,error:String(error),mockOnly:true,calls:calls.length}}
 finally{window.fetch=original;change('#ai-enabled',false);q('#ai-clear-key').click();document.documentElement.dataset.v124Review=JSON.stringify(window.v124Review)}
 return window.v124Review;
})();
