// Private local test only: mocked provider, no real credentials or charges.
(async()=>{
 const q=s=>document.querySelector(s),passed=[];let calls=0;
 const change=(id,value)=>{const n=q(id);if(n.type==='checkbox')n.checked=value;else n.value=value;n.dispatchEvent(new Event('change'))};
 const type=text=>{q('#editor').value=text;q('#editor').dispatchEvent(new Event('input'))};
 const pause=()=>new Promise(r=>setTimeout(r,1750));
 const assert=(ok,label)=>{if(!ok)throw Error(label);passed.push(label)};
 window.generalReviewCleanup?.();const original=window.fetch;
 window.fetch=async()=>{calls++;return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({issues:[{offset:0,length:7,original:'They is',category:'grammar',replacements:['They are'],message:'Use are with they.'}]})}}]}),{status:200})};
 try{
  change('#ai-enabled',false);change('#ai-provider','openai');change('#ai-route','direct');
  q('#ai-api-key').value='automatic-mock-key';q('#ai-api-key').dispatchEvent(new Event('input'));
  change('#ai-enabled',true);change('#ai-auto',true);
  type('They is ready');await pause();assert(calls===0,'Unfinished sentence does not trigger a paid check');
  type('They is ready.');await pause();assert(calls===1,'Completion triggers one AI check');
  assert(q('#suggestions').textContent.includes('Grammar · AI'),'AI correction shown in suggestions');
  type('They is ready. Next unfinished');await pause();assert(calls===1,'Unfinished tail does not resend the completed sentence');
  assert(q('#suggestions').textContent.includes('Grammar · AI'),'AI suggestion retained while next sentence is unfinished');
  type('They is ready. Next sentence.');await pause();assert(calls===2,'Next completion triggers another check');
  document.documentElement.dataset.automaticReview=JSON.stringify({passed,count:passed.length,calls,mockOnly:true});
 }catch(error){document.documentElement.dataset.automaticReview=JSON.stringify({passed,count:passed.length,calls,error:String(error),mockOnly:true})}
 finally{window.fetch=original;change('#ai-auto',false);change('#ai-enabled',false);q('#ai-clear-key').click()}
})();
