import {PROVIDERS,requestAI,validateAIResult,resolveModel,resolveEndpoint} from './ai.js';
import {createNativeTransport} from './native-ai.js';
import {analyze,applySuggestion,parseVocabularyCSV} from './engine.js';
import {highlightSegments} from './highlights.js';
import {createLearningState,observeIssues,recordDecision,summarizeLearning,sanitizeLearningState} from './learning.js';
import {completedPrefix,automaticCheckKey,mergeSuggestions} from './check-policy.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const KEY='cyanwrite-v1';
const defaults={grammar:true,spelling:true,punctuation:true,clarity:true,structure:true,vocab:true,learning:true,autosave:true,translation:false,ai:false,mode:'normal',structureType:'automatic',motherTongue:'Hindi',serviceUrl:'',aiRoute:'direct',aiProvider:'openai',aiBaseUrl:'https://api.openai.com/v1',aiModel:'',aiAuto:false};
let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')}catch{}
let opts={...defaults,...Object.fromEntries(Object.entries(saved.options||{}).filter(([key])=>Object.hasOwn(defaults,key)))}, vocab=Array.isArray(saved.vocab)?saved.vocab:[], history=Array.isArray(saved.history)?saved.history:[];
let learning=sanitizeLearningState(saved.learning);
if(!saved.learning&&history.length){for(const h of [...history].reverse()){recordDecision(learning,{id:'legacy-'+(h.category||'grammar'),category:h.category,original:h.original,replacements:[h.replacement],message:h.message},'accepted',h.replacement,opts)}history=[];}
opts.mode=['normal','administrative','legal','formal','business','literary','high'].includes(opts.mode)?opts.mode:'normal';
opts.structureType=['automatic','simple','complex','compound'].includes(opts.structureType)?opts.structureType:'automatic';
if(!Object.hasOwn(PROVIDERS,opts.aiProvider))opts.aiProvider='openai';
// Repair the screenshot's legacy numeric entry without ever sending it. Explain the upgrade in Preferences.
const repairedModel=typeof opts.aiModel!=='string'||/^\d+(?:\.\d+)*$/.test(opts.aiModel.trim());
if(repairedModel)opts.aiModel='';
let apiKey='';
const aiTransport=createNativeTransport(window.CyanAndroid,window);
let connectionController;
let undoLearning=null;
let issues=[],dismissed=new Set(),filter='all',timer,requestId=0,controller,undo=null;
let lastAutomaticCheck='';
let lastAutomaticIssues=[];
const sample='Dear team,\n\nI am writing to discuss about our plans for the next quarter. We have made alot of progress, and I believe there is a real opportunity to build something meaningful.\n\nTheir are a few details we should review together. I look forward to hear your thoughts and working towards a clearer tomorrow.';
$('#editor').value=typeof saved.text==='string'?saved.text:'';$('#doc-title').value=saved.title||'Untitled draft';
function persist(){try{localStorage.setItem(KEY,JSON.stringify({options:opts,vocab,history,learning,text:opts.autosave?$('#editor').value:undefined,title:opts.autosave?$('#doc-title').value:undefined,theme:document.documentElement.dataset.theme}));$('#save-state').textContent=opts.autosave?'● Saved on this device':'Draft saving is off'}catch{$('#save-state').textContent='Storage unavailable — export to keep your work'}}
function toast(msg){$('#toast').textContent=msg;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,4000)}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
function go(view){$$('.view').forEach(n=>n.hidden=n.id!==view+'-view');$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===view));$('#crumb').textContent={editor:'Writing studio',vocabulary:'My vocabulary',insights:'Writing insights',settings:'Preferences'}[view];if(view==='insights')renderInsights();if(view==='vocabulary')renderVocab();window.scrollTo({top:0,behavior:'instant'})}
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.view)));$('#settings-top').onclick=()=>go('settings');
let theme=saved.theme||'dark';function setTheme(){document.documentElement.dataset.theme=theme;$('#theme').textContent=theme==='dark'?'☼':'☾';$('#theme').setAttribute('aria-label',theme==='dark'?'Switch to light theme':'Switch to dark theme')}setTheme();$('#theme').onclick=()=>{theme=theme==='dark'?'light':'dark';setTheme();persist()};
const featureNames={grammar:['Grammar','Common agreement and usage patterns'],spelling:['Spelling','A small offline set of common misspellings'],punctuation:['Punctuation','Spacing and repeated punctuation'],clarity:['Clarity & tone','Concision and supported writing-mode wording; also available with sentence checks'],structure:['Sentence structure','Safe clause rewrites and writing-mode wording after sentence completion']};
for(const [key,[name,desc]] of Object.entries(featureNames)){const label=el('label','setting-row'),s=el('span');s.append(el('strong','',name),el('small','',desc));const wrap=el('span','switch'),input=el('input');input.type='checkbox';input.checked=opts[key];input.setAttribute('aria-label','Enable '+name.toLowerCase());const track=el('span');wrap.append(input,track);label.append(s,wrap);$('#feature-toggles').append(label);input.onchange=()=>{opts[key]=input.checked;changed()}}
const controls={'vocab-enabled':'vocab','learning-enabled':'learning','autosave-enabled':'autosave','translation-toggle':'translation','ai-enabled':'ai'};
for(const [id,key]of Object.entries(controls)){const input=$('#'+id);input.checked=opts[key];input.onchange=()=>{opts[key]=input.checked;if(key==='ai'&&opts.ai)toast('AI permission enabled. Use Check writing, or opt into automatic AI checks. Provider charges may apply.');changed()}}
for(const [id,key]of [['mode','mode'],['structure-type','structureType'],['mother-tongue','motherTongue'],['service-url','serviceUrl']]){const input=$('#'+id);input.value=opts[key];input.onchange=()=>{opts[key]=input.value.trim();changed()}}
function changed(){connectionController?.abort();lastAutomaticCheck='';lastAutomaticIssues=[];dismissed.clear();persist();runCheck()}
function aiConfig(){return {provider:opts.aiProvider,baseUrl:opts.aiBaseUrl,model:opts.aiModel,apiKey}}
function connectionUntested(){$('#ai-connection-status').textContent='Settings changed — connection not tested.'}
function syncAIFields(){
 $('#personal-ai-fields').hidden=opts.aiRoute==='service';$('#server-ai-fields').hidden=opts.aiRoute!=='service';
 const preset=PROVIDERS[opts.aiProvider],models=preset?.models||[];
 const supportsAuto=Boolean(preset?.model);
 $('#ai-model-mode').options[0].disabled=!supportsAuto;
 $('#ai-model-mode').value=opts.aiModel||!supportsAuto?'manual':'auto';
 $('#ai-model-override').hidden=$('#ai-model-mode').value==='auto';
 $('#ai-model').value=opts.aiModel;
 $('#ai-model-options').replaceChildren(...models.map(model=>{const option=el('option');option.value=model;return option}));
 const help=opts.aiProvider==='deepseek'?'DeepSeek default: deepseek-flash. Alternative: deepseek-v4-pro. ':'';
 $('#ai-model-help').textContent=help+(supportsAuto?`Automatic uses ${preset.model}. No model ID needs to be entered. Manual override is optional; availability depends on your account.`:'No safe app default is configured for this provider. Enter the exact model ID from your account; this app does not discover models.')+' Provider charges may apply.';
 try{$('#ai-request-target').textContent='Request: POST '+resolveEndpoint(opts.aiProvider,opts.aiBaseUrl,opts.aiModel)}catch(error){$('#ai-request-target').textContent=error.message}
 try{$('#ai-resolved-model').textContent='Model used for every AI request: '+resolveModel(opts.aiProvider,opts.aiModel)}catch(error){$('#ai-resolved-model').textContent=error.message}
}
$('#ai-model-mode').onchange=()=>{
 opts.aiModel=$('#ai-model-mode').value==='auto'?'':(PROVIDERS[opts.aiProvider].model||'');
 syncAIFields();connectionUntested();changed();
};
for(const [id,key] of [['ai-route','aiRoute'],['ai-provider','aiProvider'],['ai-base-url','aiBaseUrl'],['ai-model','aiModel']]){
 const input=$('#'+id);input.value=opts[key];input.onchange=()=>{
  if(key==='aiProvider'||key==='aiBaseUrl'){apiKey='';$('#ai-api-key').value=''}
  opts[key]=input.value.trim();
  if(key==='aiProvider'){const preset=PROVIDERS[opts.aiProvider];if(preset){opts.aiBaseUrl=preset.baseUrl;opts.aiModel='';$('#ai-base-url').value=opts.aiBaseUrl;$('#ai-model').value=opts.aiModel}}
  syncAIFields();connectionUntested();changed();
 }
}
$('#ai-api-key').oninput=()=>{apiKey=$('#ai-api-key').value.trim();connectionUntested();changed()};
$('#ai-auto').checked=opts.aiAuto;$('#ai-auto').onchange=()=>{opts.aiAuto=$('#ai-auto').checked;changed()};
$('#ai-clear-key').onclick=()=>{apiKey='';$('#ai-api-key').value='';connectionUntested();changed();toast('API key cleared from this session.')};
syncAIFields();
if(repairedModel){$('#ai-connection-status').textContent='The previous invalid model entry was cleared. '+(PROVIDERS[opts.aiProvider].model?'Automatic / app default is now selected.':'Enter an exact model ID for this provider.');persist()}
$('#ai-test').onclick=async()=>{
 if(!opts.ai){toast('Enable Allow AI processing before testing.');return}
 connectionController?.abort();const testController=new AbortController();connectionController=testController;
 const button=$('#ai-test');button.disabled=true;$('#ai-connection-status').textContent='Testing with a short sample…';
 const timeout=setTimeout(()=>testController.abort(),25000);
 try{await requestAI({task:'analyze',text:'This is a connection test.',options:opts,vocabulary:[],config:aiConfig(),signal:testController.signal,transport:aiTransport});if(!testController.signal.aborted)$('#ai-connection-status').textContent='Connection successful with '+resolveModel(opts.aiProvider,opts.aiModel)+'. The provider returned a valid response. Use Check writing to review your draft.'}
 catch(err){if(connectionController===testController)$('#ai-connection-status').textContent=err.name==='AbortError'?'Connection test cancelled or timed out.':err.message}
 finally{clearTimeout(timeout);button.disabled=false}
};
function syncHighlights(){const editor=$('#editor'),mirror=$('#editor-highlights');mirror.style.width=editor.clientWidth+'px';mirror.style.height=editor.clientHeight+'px';mirror.scrollTop=editor.scrollTop;mirror.scrollLeft=editor.scrollLeft}
function renderHighlights(active=[]){const mirror=$('#editor-highlights');mirror.replaceChildren();for(const segment of highlightSegments($('#editor').value,active)){const span=el('span',segment.category?'issue-mark '+(isStyle({category:segment.category})?'style-mark':'correctness-mark'):'',segment.text);mirror.append(span)}mirror.append(document.createTextNode('\n'));syncHighlights()}
$('#editor').addEventListener('scroll',syncHighlights);
if(typeof ResizeObserver!=='undefined')new ResizeObserver(syncHighlights).observe($('#editor'));
$('#show-suggestions').onclick=()=>{$('.assistant').scrollIntoView({behavior:'smooth',block:'start'});$('#check').focus({preventScroll:true})};
$('#configure-writing-ai').onclick=()=>{go('settings');$('#ai-enabled').focus({preventScroll:true})};
function updateCounts(){const text=$('#editor').value,n=(text.match(/\b[\p{L}\p{N}’'-]+\b/gu)||[]).length;$('#word-count').textContent=`${n} words · ${text.length} characters`;}
$('#editor').addEventListener('input',()=>{updateCounts();persist();clearTimeout(timer);controller?.abort();requestId++;issues=[];dismissed.clear();renderIssues();$('#summary').textContent='Checking your writing…';timer=setTimeout(()=>runCheck(false,true),opts.ai&&opts.aiAuto?1500:350)});$('#doc-title').oninput=persist;
function isStyle(i){return /clarity|style|structure|vocab|tone|concision/i.test(i.category||'')}
function suggestionGroup(i){return i.category==='structure'?'structure':isStyle(i)?'mode':'grammar'}
function signature(i){return `${i.offset}:${i.original}:${i.replacements?.[0]}`}
function renderIssues(){
 const active=issues.filter(i=>!dismissed.has(signature(i)));
 renderHighlights(active);
 const mode=$('#mode').selectedOptions[0].text,style=$('#structure-type').selectedOptions[0].text;
 $('#assistant-source').textContent=active.some(i=>i.source==='ai')?'AI + OFFLINE':'OFFLINE';
 $('#suggestion-context').textContent=`${mode} mode · ${style} sentence style. Correctness covers grammar, spelling and punctuation; style covers sentence structure and mode-appropriate wording. ${opts.ai?'AI results appear here after a check.':'General AI review is off; local pattern checks remain available.'}`;
 $('#show-suggestions').textContent=active.length?`Review ${active.length} suggestion${active.length===1?'':'s'} ↓`:'View suggestions ↓';
 $('#all-count').textContent=active.length;
 $('#suggestion-count').textContent=`${active.length} SUGGESTION${active.length===1?'':'S'}`;
 const correctness=active.filter(i=>!isStyle(i)).length,structure=active.filter(i=>i.category==='structure').length,wording=active.length-correctness-structure;
 $('#summary').textContent=active.length?`${correctness} correctness · ${structure} sentence structure · ${wording} wording/style. Review and apply the changes you want.`:'No matches in this check. That does not guarantee error-free writing.';
 const show=active.filter(i=>filter==='all'||suggestionGroup(i)===filter||(filter==='style'&&isStyle(i))||(filter==='correctness'&&!isStyle(i)));
 const list=$('#suggestions');list.replaceChildren();
 const groups={};
 const groupInfo={grammar:['Grammar & correctness','Grammar, spelling and punctuation fixes.'],structure:['Sentence structure',`Selected: ${style}. Tone-only edits do not satisfy a structure request.`],mode:['Writing mode & tone',`Selected: ${mode}. Wording, clarity and vocabulary suggestions.`]};
 for(const [key,[title,description]] of Object.entries(groupInfo)){
  if(filter!=='all'&&filter!==key&&!(filter==='style'&&key!=='grammar')&&!(filter==='correctness'&&key==='grammar'))continue;
  const section=el('section','suggestion-group');section.dataset.group=key;section.setAttribute('aria-label',title);
  section.append(el('h3','suggestion-group-title',title),el('p','suggestion-group-description',description));
  const count=show.filter(i=>suggestionGroup(i)===key).length;
  if(!count)section.append(el('p','group-empty',key==='structure'?`No safe ${style==='Best automatic'?'structural improvement':style.toLowerCase()+' rewrite'} in the current results. The text may already fit, or need broader AI review. No structural change is claimed.`:key==='grammar'?'No supported correctness fixes in the current results; this is not a guarantee of error-free writing.':'No supported mode or wording changes in the current results; suitable wording can remain unchanged.'));
  groups[key]=section;list.append(section);
 }
 const structureStatus=$('#structure-status');
 const actionableStructure=active.filter(i=>i.category==='structure'&&i.replacements?.length).length;
 structureStatus.textContent=!$('#editor').value.trim()?'Write a sentence to review its structure.':actionableStructure?`${actionableStructure} structural improvement${actionableStructure===1?'':'s'} available for ${style}. Review before applying.`:`${style}: no structural change proposed. Wording-only edits and review prompts are shown separately; an unsupported rewrite is not a successful conversion.`;
 const labels={grammar:'Grammar',spelling:'Spelling',punctuation:'Punctuation',structure:'Sentence structure',tone:'Writing mode / tone',style:'Writing mode / style',clarity:'Clarity / wording',concision:'Concision',vocab:'Vocabulary',vocabulary:'Vocabulary'};
 for(const i of show.slice(0,100)){
  const card=el('article','suggestion'+(isStyle(i)?' style':''));
  card.setAttribute('aria-label',`${i.category} suggestion: ${i.original}`);
  card.append(el('div','suggestion-label',`${labels[i.category]||i.category} · ${i.source==='ai'?'AI':'Offline'}`));
  if(isStyle(i))card.append(el('p','suggestion-context',`Selected: ${mode} · ${style}${i.structureType==='unchanged'?' · wording only, structure retained':''}`));
  const replacement=el('div','replacement');
  if(i.replacements?.length)replacement.append(el('del','',i.original),document.createTextNode(' → '),el('b','',i.replacements[0]));
  else replacement.append(el('span','',i.original));
  card.append(replacement,el('p','',i.message));
  const actions=el('div','suggestion-actions'),locate=el('button','text-button','Show in text');
  locate.onclick=()=>{const editor=$('#editor');if(editor.value.slice(i.offset,i.offset+i.length)!==i.original){runCheck();return}editor.focus();editor.setSelectionRange(i.offset,i.offset+i.length);editor.scrollIntoView({behavior:'smooth',block:'center'});syncHighlights()};
  actions.append(locate);
  for(const rep of (i.replacements||[]).slice(0,4)){
   const b=el('button','apply-button',i.replacements.length>1?rep:'Apply suggestion');b.onclick=()=>accept(i,rep);actions.append(b);
  }
  const dismiss=el('button','text-button','Dismiss');
  dismiss.onclick=()=>{dismissed.add(signature(i));if(opts.learning){recordDecision(learning,i,'dismissed','',opts);persist()}renderIssues()};
  actions.append(dismiss);card.append(actions);groups[suggestionGroup(i)]?.append(card);
 }
}
function accept(issue,rep){const current=$('#editor').value;if(current.slice(issue.offset,issue.offset+issue.length)!==issue.original){toast('Your text changed. Checking again before applying.');runCheck();return}try{const next=applySuggestion(current,issue,rep);undo=current;undoLearning=JSON.stringify(learning);$('#editor').value=next;if(opts.learning){recordDecision(learning,issue,'accepted',rep,opts)}persist();updateCounts();dismissed.clear();runCheck();toast('Suggestion applied. Ctrl/⌘ + Z restores the previous text.')}catch{toast('This suggestion is out of date. Please check again.');runCheck()}}
$('#editor').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&undo!==null){e.preventDefault();$('#editor').value=undo;undo=null;if(undoLearning){learning=sanitizeLearningState(JSON.parse(undoLearning));undoLearning=null}updateCounts();persist();runCheck()}});
$$('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;$$('[data-filter]').forEach(n=>{n.classList.toggle('selected',n===b);n.setAttribute('aria-selected',String(n===b))});renderIssues()});$('#check').onclick=()=>runCheck(true);
function endpoint(path){let base=opts.serviceUrl.replace(/\/$/,'');if(base){const u=new URL(base);if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw Error('Use an HTTPS service address.');}return base+path}
async function api(path,body,signal){const r=await fetch(endpoint(path),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});if(!r.ok)throw Error(r.status===503?'AI provider is not configured.':'AI service unavailable ('+r.status+').');const data=await r.json();return data}
function safeOptions(){const {serviceUrl,aiRoute,aiProvider,aiBaseUrl,aiModel,aiAuto,ai,...writing}=opts;return writing}
async function runCheck(manual=false,typing=false){
 clearTimeout(timer);controller?.abort();const currentController=new AbortController();controller=currentController;
 const id=++requestId,text=$('#editor').value;updateCounts();issues=analyze(text,{...opts,vocabulary:vocab});
 if(opts.ai&&lastAutomaticCheck&&automaticCheckKey(text,safeOptions(),vocab)===lastAutomaticCheck)issues=mergeSuggestions(issues,lastAutomaticIssues);
 if(opts.learning&&text!==sample){observeIssues(learning,issues,text,opts);persist()}renderIssues();
 $('#engine-status').textContent='Offline checks · '+$('#mode').selectedOptions[0].text+' · '+$('#structure-type').selectedOptions[0].text;
 $('#writing-coverage').textContent=opts.ai?'AI is instructed to review grammar, structure and tone using your settings; a requested conversion may be unsafe or unnecessary. '+(opts.aiAuto?'Automatic checks run after sentence completion.':'Press Check writing to request a review.')+' Provider charges may apply.':'Offline mode covers supported patterns only, not arbitrary rewrites. Enable optional AI with your own key for general sentence review in every mode and style.';
 $('#configure-writing-ai').textContent=opts.ai?'AI preferences':'Set up general AI review';
 $('#translation-content').replaceChildren(el('p','muted',opts.translation?'Use Check writing with AI enabled to generate translation.':'Translation is off.'));
 $('#ai-status').textContent=opts.ai?'AI allowed. '+(opts.aiAuto?'Automatic requests enabled; provider charges may apply.':'Use Check writing to send your draft. No automatic paid requests.'):'AI off. Offline proofreading needs no key or service.';
 if(!opts.ai||(!manual&&!(typing&&opts.aiAuto))||!text.trim())return;
 if(text.length>12000){$('#ai-status').textContent='AI supports up to 12,000 characters per check. Offline checks remain active.';return}
 const options=safeOptions(),automaticKey=automaticCheckKey(text,options,vocab);
 if(!manual&&!automaticKey){$('#ai-status').textContent='Waiting for a completed sentence before an automatic AI request. No request sent.';return}
 if(!manual&&automaticKey===lastAutomaticCheck){$('#ai-status').textContent='Completed sentences already checked. Finish another sentence or use Check writing to review again.';return}
 const reviewText=manual?text:completedPrefix(text);
 $('#engine-status').textContent='Checking with your selected AI…';
 const timeout=setTimeout(()=>currentController.abort(),45000);
 let analysisDone=false;
 try{
  const data=opts.aiRoute==='service'?await api('/api/analyze',{text:reviewText,aiOptIn:true,options:{...options,vocabulary:vocab}},currentController.signal):await requestAI({task:'analyze',text:reviewText,options,vocabulary:vocab,motherTongue:opts.motherTongue,config:aiConfig(),signal:currentController.signal,transport:aiTransport});
  if(id!==requestId)return;
  const remoteData=opts.aiRoute==='service'&&Array.isArray(data?.issues)?{issues:data.issues.filter(i=>!['local-rule','user-vocabulary'].includes(i.source))}:data;
  const valid=validateAIResult(remoteData,reviewText,options,vocab).issues;
  issues=mergeSuggestions(issues,valid);
  lastAutomaticCheck=automaticKey;
  lastAutomaticIssues=valid.filter(i=>i.offset+i.length<=completedPrefix(text).length);
  if(opts.learning){observeIssues(learning,valid,text,opts);persist()}renderIssues();analysisDone=true;
  $('#engine-status').textContent='AI + offline checks · review every suggestion';
  $('#ai-status').textContent='AI check completed. Accepted results are grouped below by grammar, sentence structure and mode/tone. AI can miss issues or misread structure; verify meaning before applying.';
  if(opts.translation){
   $('#translation-content').replaceChildren(el('p','muted','Translating…'));
   const translated=opts.aiRoute==='service'?await api('/api/translate',{text,aiOptIn:true,motherTongue:opts.motherTongue},currentController.signal):await requestAI({task:'translate',text,options,vocabulary:vocab,motherTongue:opts.motherTongue,config:aiConfig(),signal:currentController.signal,transport:aiTransport});
   if(id!==requestId)return;
   if(typeof translated.translation!=='string'||translated.translation.length>50000)throw Error('Invalid translation response.');
   $('#translation-content').replaceChildren(el('p','',translated.translation));
  }
 }catch(err){
  if(id!==requestId)return;
  const message=err.name==='AbortError'?'AI request timed out or was cancelled.':err.message;
  $('#engine-status').textContent=analysisDone?'AI suggestions retained · translation unavailable':'Offline checks active · AI unavailable';
  $('#ai-status').textContent=message+' Offline suggestions remain available.';
  if(opts.translation)$('#translation-content').replaceChildren(el('p','muted','Translation unavailable. No translation has been generated.'));
  if(manual)toast(message);
 }finally{clearTimeout(timeout)}
}

function saveFile(name,content,mime='text/plain'){if(window.CyanAndroid?.saveText){window.CyanAndroid.saveText(name,mime,content);return}const url=URL.createObjectURL(new Blob([content],{type:mime+';charset=utf-8'}));const a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('#export').onclick=()=>{saveFile(($('#doc-title').value.replace(/[^\p{L}\p{N} _-]/gu,'').trim()||'CyanWrite draft')+'.txt',$('#editor').value);toast('Draft exported.')};$('#sample-csv').onclick=()=>saveFile('cyanwrite-vocabulary-template.csv','word,meaning,context\n','text/csv');
function importCSV(csv){let result=parseVocabularyCSV(csv);const rows=Array.isArray(result)?result:result.words||result.vocabulary||[];if(!rows.length)throw Error('No words found. Include a word column with one word per row.');const merged=new Map(vocab.map(v=>[v.word.toLowerCase(),v]));for(const row of rows){if(typeof row.word==='string'&&row.word.trim()&&row.word.length<100){merged.set(row.word.toLowerCase(),{word:row.word.trim(),meaning:String(row.meaning||'').slice(0,500),context:String(row.context||'').slice(0,500)})}}vocab=[...merged.values()].slice(0,5000);persist();renderVocab();runCheck();toast(`${rows.length} vocabulary entries processed.`)}
$('#import-paste').onclick=()=>{try{if($('#csv-paste').value.length>2e6)throw Error('Paste up to 2 MB of CSV.');importCSV($('#csv-paste').value);$('#csv-paste').value=''}catch(e){toast(e.message)}};
$('#vocab-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>2e6)throw Error('Choose a file smaller than 2 MB.');if(/\.csv$/i.test(f.name))importCSV(await f.text());else if(/\.xlsx$/i.test(f.name)){if(!window.XLSX)throw Error('Excel parser is unavailable. Please upload CSV instead.');const wb=XLSX.read(await f.arrayBuffer(),{type:'array',sheetRows:5001});importCSV(XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]))}else throw Error('Use a CSV or .xlsx file.')}catch(e){toast('Import failed: '+e.message)}finally{e.target.value=''}};
function renderVocab(){$('#vocab-total').textContent=`${vocab.length} words in your collection`;const list=$('#vocab-list');list.replaceChildren();if(!vocab.length)list.append(el('p','muted','Your collection is empty. No vocabulary suggestions will be invented.'));for(const v of vocab.slice(0,150)){const row=el('div','word-row');row.append(el('strong','',v.word),el('span','',v.meaning+(v.context?' · Context: '+v.context:'')));list.append(row)}if(vocab.length>150)list.append(el('p','muted','Showing the first 150 words. All imported words remain available to the engine.'))}
$('#clear-vocab').onclick=()=>{if(confirm('Remove all imported vocabulary from this device?')){vocab=[];persist();renderVocab();runCheck()}};
function renderInsights(){
  const summary=summarizeLearning(learning);
  $('#insight-stats').replaceChildren();
  for(const [n,label]of [[summary.detected,'Unique suggestions detected'],[summary.accepted,'Changes accepted'],[summary.patternCount,'Specific patterns observed']]){const d=el('div','stat');d.append(el('strong','',String(n)),el('span','',label));$('#insight-stats').append(d)}
  const box=$('#patterns');box.replaceChildren();
  if(!opts.learning)box.append(el('p','muted','Learning is paused. Existing history remains here; no new observations or decisions are recorded.'));
  if(!summary.patterns.length)box.append(el('p','muted','Write and finish sentences to begin. Counts describe suggestions from this app, not a diagnosis of mistakes.'));
  for(const p of summary.patterns.sort((a,b)=>(b.detected+b.accepted)-(a.detected+a.accepted)).slice(0,50)){
    const row=el('article','pattern-card');
    row.append(el('h3','',p.ruleId.replace(/^(grammar|spelling|structure|clarity|punctuation)-/,'').replace(/[-_]/g,' ')),el('div','pattern-meta',`${p.category} · ${p.detected} detected · ${p.accepted} accepted · ${p.dismissed} dismissed`));
    if(p.advice[0])row.append(el('p','',p.advice[0]));
    const contexts=Object.keys(p.contexts).map(x=>x.replace('/',' / ')).join(', ');if(contexts)row.append(el('p','pattern-meta','Seen in: '+contexts));
    for(const ex of p.examples.slice(0,2)){const example=el('div','pattern-example');example.append(el('del','',ex.before));if(ex.after)example.append(document.createTextNode(' → '),el('strong','',ex.after));row.append(example)}
    box.append(row)
  }
  box.append(el('p','muted','Counts are deduplicated by rule, wording and location within a bounded local ledger. Repeated checks do not mean repeated mistakes. Style preferences are not grammar errors.'));
}
$('#export-learning').onclick=()=>saveFile('cyanwrite-learning.json',JSON.stringify({notice:'Local suggestion observations, not confirmed errors. Includes short writing examples.',...summarizeLearning(learning)},null,2),'application/json');
$('#clear-history').onclick=()=>{if(confirm('Clear all local learning patterns, examples and correction history?')){history=[];learning=createLearningState();persist();renderInsights()}};
$('#delete-data').onclick=()=>{if(confirm('Delete all CyanWrite drafts, vocabulary, preferences and history from this device? This cannot be undone.')){localStorage.removeItem(KEY);opts={...defaults};vocab=[];history=[];learning=createLearningState();location.reload()}};
updateCounts();persist();renderVocab();runCheck();

// Android already bundles all assets; a web browser can cache the shell after its first successful visit.
if('serviceWorker' in navigator && location.hostname!=='appassets.androidplatform.net'){navigator.serviceWorker.register('./sw.js').catch(()=>{});}
