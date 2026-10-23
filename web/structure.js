/** Conservative, deterministic sentence rewrites. Unsupported language is left intact. */
const ABBREVIATIONS = new Set(['mr','mrs','ms','dr','prof','sr','jr','st','vs','e.g','i.e','fig','no','inc','ltd']);
export function sentenceSpans(text) {
  const out=[]; let start=0;
  for(let i=0;i<text.length;i++){
    if(text[i]==='\n' && text[i+1]==='\n'){start=i+2; continue;}
    if(!'.!?'.includes(text[i]))continue;
    if(text[i]==='.' && /\d/.test(text[i-1]||'') && /\d/.test(text[i+1]||''))continue;
    if(text[i]==='.' && /[A-Za-z]/.test(text[i+1]||''))continue;
    const word=(text.slice(start,i+1).match(/([A-Za-z.]+)\.$/)||[])[1]?.toLowerCase();
    if(text[i]==='.' && word && (ABBREVIATIONS.has(word)||/^[a-z]$/.test(word)))continue;
    let end=i+1; while(end<text.length&&/[.!?"'”’»)]/.test(text[end]))end++;
    if(end<text.length&&!/\s/.test(text[end]))continue;
    const raw=text.slice(start,end), original=raw.trim();
    if(original)out.push({offset:start+raw.length-raw.trimStart().length,original});
    start=end;i=end-1;
  }
  return out;
}
const up=s=>s?s[0].toUpperCase()+s.slice(1):s;
// Do not decapitalize names, I, or acronyms; only known sentence-initial function words.
const down=s=>/^(The|This|That|These|Those|We|They|He|She|It|You|Our|A|An)\b/.test(s)?s[0].toLowerCase()+s.slice(1):s;
const clause=s=>/^(?:(?:I|you|we|they|he|she|it|there|this|that)\b|(?:the|a|an|our|their|your|my|his|her|these|those)\s+[\w’'-]+|[A-Z][\w’'-]+)\s+.{0,150}?\b(?:am|is|are|was|were|be|been|being|has|have|had|do|does|did|can|could|will|would|shall|should|must|may|might|[a-z]+ed|[a-z]+s|rain|rained|cost|costs|changed|increased|continued|adapted|arrived|left|went|ran|work|worked|agree|need|needs|want|wants|know|knew|met|read|wrote|sent|paid|failed|passed|starts|ended|approved|rejected)\b/i.test(s);
const modeNames={normal:'normal',administrative:'administrative',legal:'legal',formal:'formal',business:'business',literary:'literary',high:'high-standards'};
function register(text,mode){
  const common=[[/\bat this point in time\b/gi,'now'],[/\bin order to\b/gi,'to'],[/\bdue to the fact that\b/gi,'because']];
  const rules={
    normal:common,
    administrative:[...common,[/\bplease be advised that\b/gi,'please note that'],[/\bwith regard to\b/gi,'regarding']],
    formal:[...common,[/\bcan't\b/gi,'cannot'],[/\bwon't\b/gi,'will not']],
    business:[...common,[/\bplease be advised that\b/gi,'please note that']],
    literary:[[/\bin a very quiet manner\b/gi,'quietly'],[/\bin a very slow manner\b/gi,'slowly']],
    high:[...common,[/\bplease be advised that\b/gi,'please note that'],[/\bwith regard to\b/gi,'regarding']],
    // Avoid replacing may/shall/must or altering legal terms and obligations.
    legal:[[/\bdue to the fact that\b/gi,'because']]
  };
  let result=text;
  for(const [re,replacement]of rules[mode]||rules.normal)result=result.replace(re,m=>m===m.toUpperCase()?replacement.toUpperCase():m[0]===m[0].toUpperCase()?up(replacement):replacement);
  return result;
}
export function structureRewrites(original,options={}){
  const mode=modeNames[options.mode]?options.mode:'normal',target=['simple','complex','compound'].includes(options.structureType)?options.structureType:'automatic';
  // Questions and exclamations are not re-asserted as statements. Quoted whole sentences keep their quotes.
  let body=original,open='',close='';
  if((body.startsWith('“')&&body.endsWith('”'))||(body.startsWith('"')&&body.endsWith('"'))){open=body[0];close=body.at(-1);body=body.slice(1,-1);}
  if(!body.endsWith('.')||body.endsWith('...'))return [];
  const content=body.slice(0,-1),result=[];
  function add(pattern,structure,text,explanation){
    const styled=register(text,mode),value=open+styled+close;
    if(value===original||result.some(x=>x.value===value))return;
    result.push({pattern,structure,value,message:`${explanation} ${modeNames[mode]} mode; ${target==='automatic'?'best automatic':target} structure. Review meaning before applying.`});
  }
  // Modal/conditional legal text is not structurally transformed; minor causal wording can still be reviewed.
  const protectedLegal=mode==='legal'&&/\b(shall|must|may|unless|provided|notwithstanding|liable|liability|indemnif|warrant|covenant)\b/i.test(content);
  let relation=null,m;
  if((m=content.match(/^Because (.+?),\s+(.+)$/i))&&clause(m[1])&&clause(m[2]))relation={type:'causal',cause:m[1],effect:m[2]};
  else if((m=content.match(/^(.+?)\s+because\s+(.+)$/i))&&clause(m[1])&&clause(m[2]))relation={type:'causal',cause:m[2],effect:m[1]};
  else if((m=content.match(/^(?:Although|Even though) (.+?),\s+(.+)$/i))&&clause(m[1])&&clause(m[2]))relation={type:'concessive',contrast:m[1],main:m[2]};
  else if((m=content.match(/^(.+?)\s+(?:although|even though)\s+(.+)$/i))&&clause(m[1])&&clause(m[2]))relation={type:'concessive',contrast:m[2],main:m[1]};
  else if((m=content.match(/^(.+?),\s+(and|but|so|yet)\s+(.+)$/i))&&clause(m[1])&&clause(m[3]))relation={type:'coordinate',first:m[1],join:m[2].toLowerCase(),second:m[3]};
  else if((m=content.match(/^(.+?),\s+(.+)$/))&&clause(m[1])&&clause(m[2]))relation={type:'comma-splice',first:m[1],second:m[2]};
  if(relation&&!protectedLegal){
    const r=relation;
    if(target==='simple'||(target==='automatic'&&(r.type==='comma-splice'||content.split(/\s+/).length>=28))){
      if(r.type==='causal')add('causal','simple',`${up(r.cause)}. As a result, ${down(r.effect)}.`,'Express the cause first, then its result in two simple sentences.');
      if(r.type==='concessive')add('concessive','simple',`${up(r.contrast)}. Nevertheless, ${down(r.main)}.`,'Keep the contrast across two simple sentences.');
      if(r.type==='coordinate'){const marker={and:'',but:'However, ',yet:'Nevertheless, ',so:'As a result, '}[r.join];add('coordinate','simple',`${up(r.first)}. ${marker?marker+down(r.second):up(r.second)}.`,'Split two independent clauses while retaining their relationship.');}
      if(r.type==='comma-splice')add('comma-splice','simple',`${up(r.first)}. ${up(r.second)}.`,'Replace a possible comma splice with two complete sentences.');
    }
    if(target==='compound'){
      if(r.type==='causal')add('causal','compound',`${up(r.cause)}, so ${down(r.effect)}.`,'Keep the cause before the effect using “so.”');
      if(r.type==='concessive')add('concessive','compound',`${up(r.contrast)}, but ${down(r.main)}.`,'Connect independent clauses with “but” to preserve the contrast.');
      if(r.type==='comma-splice')add('comma-splice','compound',`${up(r.first)}; ${down(r.second)}.`,'Use a semicolon between independent clauses without inventing a relationship.');
      // An existing compound sentence need not be rewritten just to manufacture a suggestion.
    }
    if(target==='complex'){
      if(r.type==='causal'&&/^Because\b/i.test(content))add('causal','complex',`${up(r.effect)} because ${down(r.cause)}.`,'Place the main clause first and retain the causal subordinate clause.');
      if(r.type==='concessive'&&/^(Although|Even though)\b/i.test(content))add('concessive','complex',`${up(r.main)} although ${down(r.contrast)}.`,'Place the main clause first and retain the contrast.');
      if(r.type==='coordinate'&&r.join==='so')add('causal','complex',`${up(r.second)} because ${down(r.first)}.`,'Express the same cause and effect with a subordinate “because” clause.');
      if(r.type==='coordinate'&&['but','yet'].includes(r.join))add('concessive','complex',`Although ${down(r.first)}, ${down(r.second)}.`,'Express the existing contrast with an “although” clause.');
    }
  }
  // Register edits apply to every selected structure, but must not masquerade as a different structure.
  const styled=register(body,mode);
  if(styled!==body){
    const existing=relation?.type==='causal'||relation?.type==='concessive'?'complex':relation?.type==='coordinate'?'compound':relation?'unknown':'simple';
    if(target==='automatic'||target===existing)add('register',existing,styled,'Remove a supported wordy expression without adding information.');
  }
  return result.slice(0,3);
}
