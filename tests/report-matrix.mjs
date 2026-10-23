import {analyze} from '../web/engine.js';
import {writeFileSync} from 'node:fs';
const modes=['normal','administrative','legal','formal','business','literary','high'];
const styles=['automatic','simple','complex','compound'];
const samples=[
 ['agreement','They is ready.'],
 ['causal-front','Because the office is closed, we cannot attend.'],
 ['causal-back','We cannot attend because the office is closed.'],
 ['concessive','Although the price increased, we continued the work.'],
 ['coordinated-cause','The office is closed, so we cannot attend.'],
 ['coordinated-contrast','The price increased, but we continued the work.'],
 ['coordinated-neutral','The team arrived, and the review started.'],
 ['comma-splice','The rain stopped, we left.'],
 ['question','Could you let me know when the review starts?'],
 ['imperative','Please let me know when the review starts.'],
 ['exclamation','At this point in time, the team is ready!'],
 ['informal-request','Hey, can you send the report?'],
 ['concise','The shell is intact.'],
 ['legal-obligation','The tenant shall pay 500 rupees unless the landlord agrees otherwise.'],
 ['quoted-evidence','The witness said, “They is ready. At this point in time, we wait.”'],
 ['names-and-numbers','Dr. Rivera cannot approve 3.14 units because Amina has not signed.'],
 ['unfinished','Although the office is closed'],
 ['multi-paragraph','They is ready.\n\nBecause the office is closed, we cannot attend.'],
 ['plain-language','We will commence the review.'],
 ['procedural','Please send in the application.'],
 ['agreement-reference','The parties act as per this agreement.'],
 ['formal-request','Please get in touch with Amina.'],
 ['business-request','Please do not hesitate to contact Amina.'],
 ['literary-adverb','She moved in a very slow manner.'],
 ['high-concision','This is very essential.'],
 ['nested-causal','Because the office is closed, we cannot attend when the meeting starts.'],
 ['relative-clause','The team that Amina leads arrived, so the review started.']
];
const rows=[];
for(const mode of modes)for(const structureType of styles)for(const [sample,text] of samples){
 const issues=analyze(text,{mode,structureType});
 rows.push({mode,style:structureType,sample,text,issues:issues.map(({category,original,replacements,message,structureType})=>({category,original,replacements,message,structureType})),outcome:issues.length?'reviewable suggestions':'no supported change; not a proofread guarantee'});
}
const report={version:'1.2.4',modeStyleCombinations:28,sampleCount:samples.length,checks:rows.length,kind:'Deterministic observed outcomes; assertions are in broad-engine.test.mjs and the full test suite. No live AI calls.',rows};
const out=process.argv[2];
if(!out)throw Error('Pass output JSON path');
writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({path:out,combinations:28,samples:samples.length,checks:rows.length,suggestions:rows.reduce((n,r)=>n+r.issues.length,0)},null,2));
