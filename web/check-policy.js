import {sentenceSpans} from './structure.js';

// Automatic paid checks are triggered by a completed sentence, not every typing pause.
// Keep the original prefix (including leading whitespace) so UTF-16 offsets stay valid.
export function completedPrefix(text) {
  const spans=sentenceSpans(text);
  const last=spans.at(-1);
  return last ? text.slice(0,last.offset+last.original.length) : '';
}
export function automaticCheckKey(text,options,vocabulary=[]) {
  const complete=completedPrefix(text);
  return complete.trim() ? JSON.stringify([complete,options,vocabulary]) : '';
}
const styleIssue=i=>['structure','tone','style','concision','clarity'].includes(i.category);
const overlaps=(a,b)=>a.offset<b.offset+b.length&&b.offset<a.offset+a.length;
export function mergeSuggestions(local,remote) {
  // A reviewed AI sentence rewrite supersedes a narrower local style alternative.
  // Keep local correctness corrections: the user can still inspect them separately.
  const sentenceRewrites=remote.filter(i=>styleIssue(i)&&i.replacements?.length);
  const combined=[...remote,...local.filter(i=>!styleIssue(i)||!sentenceRewrites.some(r=>overlaps(i,r)))];
  const seen=new Set();
  return combined.filter(i=>{
    const key=JSON.stringify([i.offset,i.original,i.replacements]);
    if(seen.has(key))return false;
    seen.add(key);return true;
  }).sort((a,b)=>a.offset-b.offset);
}
