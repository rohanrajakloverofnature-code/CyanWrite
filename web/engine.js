import {sentenceSpans,structureRewrites,registerRewrites} from './structure.js';
/**
 * CyanWrite's intentionally small, deterministic writing coach.
 * Suggestions are conservative review prompts; this is not a full proofreader.
 */
const DEFAULTS = { grammar: true, spelling: true, punctuation: true, clarity: true, structure: true, mode: 'normal', structureType: 'automatic', vocabulary: [], vocab: false };
const MODES = new Set(['normal', 'administrative', 'legal', 'formal', 'business', 'literary', 'high']);
const STRUCTURES = new Set(['automatic', 'simple', 'complex', 'compound']);
function optionsOf(options = {}) { const o = { ...DEFAULTS, ...options }; o.mode = MODES.has(o.mode) ? o.mode : 'normal'; o.structureType = STRUCTURES.has(o.structureType) ? o.structureType : 'automatic'; o.vocabulary = Array.isArray(o.vocabulary) ? o.vocabulary.filter(v => v && typeof v.word === 'string') : []; return o; }
function preserveCase(original, replacement) { if (original === original.toUpperCase()) return replacement.toUpperCase(); if (original[0] === original[0]?.toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1); return replacement; }
function issue(id, offset, original, replacements, message, category, confidence = 0.92, source = 'local-rule', metadata = {}) { return { id, offset, length: original.length, original, replacements: [...replacements], message, category, confidence, source, ...metadata }; }
function add(out, x) { if (!out.some(i => i.id === x.id && i.offset === x.offset)) out.push(x); }
function completeSentence(text, start, end) { const s = text.slice(start, end).trim(); return s.length > 0 && /[.!?](?:["'”’»)]*)?$/.test(s); }
function quotedRanges(text) {
  const ranges = []; let start = -1; let quote = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const apostrophe=(c==="'"||c==='’')&&/[\p{L}\p{N}]/u.test(text[i-1]||'')&&/[\p{L}\p{N}]/u.test(text[i+1]||'');
    if (quote) { if (!apostrophe&&(c === quote || (quote === '“' && c === '”') || (quote==='‘'&&c==='’'))) { ranges.push([start, i + 1]); start = -1; quote = ''; } }
    else if (c === '"' || c === '“' || c==='‘' || (c==="'"&&!/[\p{L}\p{N}]/u.test(text[i-1]||''))) { start = i; quote = c; }
  }
  if (start >= 0) ranges.push([start, text.length]);
  return ranges;
}
function inQuotedRange(ranges, offset) { return ranges.some(([start, end]) => offset >= start && offset < end); }
function addMatches(out, text, ranges, rules, category) {
  for (const [pattern, right, message, confidence = 0.97] of rules) {
    for (const m of text.matchAll(new RegExp(`(?:${pattern})`, 'gi'))) {
      if (inQuotedRange(ranges, m.index)) continue;
      const original = m[0];
      add(out, issue(`${category}-${pattern.replace(/\\b/g, '').replace(/\\s\+/g, '-').replace(/[^\w-]/g, '')}`, m.index, original, [preserveCase(original, right)], message, category, confidence));
    }
  }
}
function addGuardedMatches(out, text, ranges, rules, category, guard) {
  for (const [pattern, right, message, confidence = 0.97] of rules) {
    for (const m of text.matchAll(new RegExp(pattern, 'gi'))) {
      if (inQuotedRange(ranges, m.index) || guard(text, m.index, m[0])) continue;
      const original = m[0];
      add(out, issue(`${category}-${pattern.replace(/\\b/g, '').replace(/\\s\\+/g, '-').replace(/[^\\w-]/g, '')}`, m.index, original, [preserveCase(original, right)], message, category, confidence));
    }
  }
}
function addDidAuxiliaryMatches(out, text, ranges) {
  const forms = new Map([['went', 'go'], ['saw', 'see'], ['ate', 'eat'], ['wrote', 'write'], ['took', 'take'], ['came', 'come'], ['gave', 'give'], ['made', 'make']]);
  const pattern = '\\b(?:did|didn[’\']t|did not)\\s+(?:went|saw|ate|wrote|took|came|gave|made)\\b';
  for (const m of text.matchAll(new RegExp(pattern, 'gi'))) {
    if (inQuotedRange(ranges, m.index)) continue;
    const match = m[0], parts = match.match(/^(did|didn[’']t|did not)(\s+)(\w+)$/i);
    if (!parts) continue;
    const replacement = `${parts[1]}${parts[2]}${preserveCase(parts[3], forms.get(parts[3].toLowerCase()))}`;
    add(out, issue('grammar-did-auxiliary', m.index, match, [replacement], 'After “did,” use the base form of the verb.', 'grammar', 0.96));
  }
}
export function parseVocabularyCSV(csv) { if (typeof csv !== 'string') throw new TypeError('CSV must be a string'); const rows = []; let row = [], cell = '', quoted = false; for (let i = 0; i < csv.length; i++) { const c = csv[i]; if (quoted) { if (c === '"' && csv[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c; } else if (c === '"' && cell === '') quoted = true; else if (c === ',') { row.push(cell.trim()); cell = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && csv[i + 1] === '\n') i++; row.push(cell.trim()); rows.push(row); row = []; cell = ''; } else cell += c; } if (quoted) throw new Error('Unclosed quoted CSV field'); if (cell.length || row.length) { row.push(cell.trim()); rows.push(row); } if (!rows.length) return []; const header = rows[0].map(x => x.toLowerCase()); const hasHeader = header.includes('word') || header.includes('meaning') || header.includes('context'); const data = hasHeader ? rows.slice(1) : rows; const wi = hasHeader ? Math.max(0, header.indexOf('word')) : 0, mi = hasHeader ? header.indexOf('meaning') : 1, ci = hasHeader ? header.indexOf('context') : 2; return data.filter(r => r[wi]).map(r => ({ word: r[wi], ...(mi >= 0 && r[mi] ? { meaning: r[mi] } : {}), ...(ci >= 0 && r[ci] ? { context: r[ci] } : {}) })); }
export function analyze(text, options = {}) {
  if (typeof text !== 'string') throw new TypeError('text must be a string'); const o = optionsOf(options), out = []; if (!text) return out;
  const ranges = quotedRanges(text);
  if (o.grammar) addMatches(out, text, ranges, [
    ['\\balot\\b', 'a lot', 'Use “a lot” as two words.'],
    ['\\bdiscuss\\s+about\\b', 'discuss', '“Discuss” does not need “about” here.'],
    ['\\btheir\\s+are\\b', 'There are', 'Use “There are” for existence.'],
    ['\\blook\\s+forward\\s+to\\s+hear\\b', 'look forward to hearing', 'After “look forward to,” use a gerund.'],
    ['\\bI\\s+is\\b', 'I am', 'Use “am” with “I”.'], ['\\bI\\s+are\\b', 'I am', 'Use “am” with “I”.'],
    ['\\bhe\\s+are\\b', 'he is', 'Use “is” with a singular subject.'], ['\\bshe\\s+are\\b', 'she is', 'Use “is” with a singular subject.'], ['\\bit\\s+are\\b', 'it is', 'Use “is” with a singular subject.'],
    ['\\bhe\\s+am\\b', 'he is', 'Use “is” with a singular subject.'], ['\\bshe\\s+am\\b', 'she is', 'Use “is” with a singular subject.'], ['\\bit\\s+am\\b', 'it is', 'Use “is” with a singular subject.'],
    ['\\bwe\\s+is\\b', 'we are', 'Use “are” with this subject.'], ['\\byou\\s+is\\b', 'you are', 'Use “are” with this subject.'], ['\\bthey\\s+is\\b', 'they are', 'Use “are” with this subject.'],
    ['\\bwe\\s+am\\b', 'we are', 'Use “are” with this subject.'], ['\\byou\\s+am\\b', 'you are', 'Use “are” with this subject.'], ['\\bthey\\s+am\\b', 'they are', 'Use “are” with this subject.'],
    ["\\bI\\s+does(?:n’t|n't| not)\\b", 'I do not', 'Use “do not” with “I”.'],
    ["\\bwe\\s+does(?:n’t|n't| not)\\b", 'we do not', 'Use “do not” with this subject.'], ["\\byou\\s+does(?:n’t|n't| not)\\b", 'you do not', 'Use “do not” with this subject.'], ["\\bthey\\s+does(?:n’t|n't| not)\\b", 'they do not', 'Use “do not” with this subject.'],
    ["\\bhe\\s+do(?:n’t|n't| not)\\b", 'he does not', 'Use “does not” with a singular subject.'], ["\\bshe\\s+do(?:n’t|n't| not)\\b", 'she does not', 'Use “does not” with a singular subject.'], ["\\bit\\s+do(?:n’t|n't| not)\\b", 'it does not', 'Use “does not” with a singular subject.'],
  ], 'grammar');
  if (o.grammar) {
    const subjunctiveContext = (source, offset) => /(?:\bthat|\bif|\bwish)\s*$/i.test(source.slice(0, offset));
    addGuardedMatches(out, text, ranges, [
      ['\\bI\\s+has\\b', 'I have', 'Use “have” with “I”.'], ['\\byou\\s+has\\b', 'you have', 'Use “have” with “you”.'],
      ['\\bwe\\s+has\\b', 'we have', 'Use “have” with “we”.'], ['\\bthey\\s+has\\b', 'they have', 'Use “have” with “they”.'],
      ['\\bhe\\s+have\\b', 'he has', 'Use “has” with a singular subject.'], ['\\bshe\\s+have\\b', 'she has', 'Use “has” with a singular subject.'], ['\\bit\\s+have\\b', 'it has', 'Use “has” with a singular subject.'],
    ], 'grammar', subjunctiveContext);
    addMatches(out, text, ranges, [
      ['\\byou\\s+was\\b', 'you were', 'Use “were” with “you”.'], ['\\bwe\\s+was\\b', 'we were', 'Use “were” with “we”.'], ['\\bthey\\s+was\\b', 'they were', 'Use “were” with “they”.'],
    ], 'grammar');
    addDidAuxiliaryMatches(out, text, ranges);
  }
  if (o.spelling) addMatches(out, text, ranges, [
    ['\\bHii\\b','Hi'],['\\badress\\b','address'],['\\baccomodate\\b','accommodate'],['\\barguement\\b','argument'],['\\bbeleive\\b','believe'],['\\bbegining\\b','beginning'],['\\bcalender\\b','calendar'],['\\bconcious\\b','conscious'],['\\bdefinately\\b','definitely'],['\\bembarass\\b','embarrass'],['\\benviroment\\b','environment'],['\\bexistance\\b','existence'],['\\bgoverment\\b','government'],['\\bindependant\\b','independent'],['\\bmaintainance\\b','maintenance'],['\\bneccessary\\b','necessary'],['\\boccured\\b','occurred'],['\\boccurence\\b','occurrence'],['\\bpriviledge\\b','privilege'],['\\brecomend\\b','recommend'],['\\brecieve\\b','receive'],['\\bresponsibilty\\b','responsibility'],['\\bseperate\\b','separate'],['\\bsuccesful\\b','successful'],['\\bthier\\b','their'],['\\btommorow\\b','tomorrow'],['\\btruely\\b','truly'],['\\buntill\\b','until'],['\\bwierd\\b','weird'],['\\bwich\\b','which'],
  ].map(([pattern, right]) => [pattern, right, `Possible spelling error; verify “${right}”.`, 0.98]), 'spelling');
  if (o.punctuation) { for (const m of text.matchAll(/ {2,}/g)) add(out, issue('punctuation-double-space', m.index, m[0], [' '], 'Use a single space.', 'punctuation', 0.99)); for (const m of text.matchAll(/([,.;:!?])\1+/g)) add(out, issue('punctuation-repeat', m.index, m[0], [m[1]], 'Repeated punctuation may be unintended.', 'punctuation', 0.98)); }
  if (o.clarity) for (const m of text.matchAll(/\b(very|really|basically|obviously)\s+(\w+)/gi)) add(out, issue(`clarity-${m[1].toLowerCase()}`, m.index, m[0], [m[2]], `Consider removing “${m[1]}” if it adds no meaning.`, 'clarity', 0.72));
  if (o.vocab && o.vocabulary.length) for (const v of o.vocabulary.slice(0, 100)) { const word = v.word.trim(); if (!word) continue; for (const m of text.matchAll(new RegExp(`\\b${word.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'gi'))) add(out, issue(`vocab-${word.toLowerCase()}`, m.index, m[0], [], `Imported word “${m[0]}” (${v.meaning || 'meaning not supplied'}) appears here; its context and usage are unverified.`, 'vocabulary', 0.55, 'user-vocabulary')); }
  if (o.structure||o.clarity) for (const {offset,original} of sentenceSpans(text)) {
    // Mode is not a synonym for clause structure: questions still need tone review.
    // Do not rewrite a sentence that overlaps quoted evidence, including multi-sentence quotes.
    if(ranges.some(([start,end])=>start<offset+original.length&&end>offset))continue;
    const structural=o.structure?structureRewrites(original,o):[];
    const candidates=structural.length?structural:registerRewrites(original,o);
    for(const c of candidates){
      // Fold enabled safe spelling/grammar/punctuation corrections into the complete replacement.
      let value=c.value;
      const corrections=analyze(value,{...o,structure:false,clarity:false,vocab:false}).filter(x=>['grammar','spelling','punctuation'].includes(x.category)&&x.replacements.length).sort((a,b)=>b.offset-a.offset);
      for(const correction of corrections){if(value.slice(correction.offset,correction.offset+correction.length)===correction.original)value=value.slice(0,correction.offset)+correction.replacements[0]+value.slice(correction.offset+correction.length);}
      const category=c.structure==='unchanged'?'tone':'structure';
      add(out,issue(`${category}-${c.pattern}-${c.structure}`,offset,original,[value],c.message,category,c.pattern==='comma-splice'?0.87:0.79,'local-rule',{patternId:`${category}-${c.pattern}`,structureType:c.structure,requestedStructureType:o.structureType,mode:o.mode}));
    }
    if(o.structure&&!candidates.length&&original.split(/\s+/).length>=20&&(o.structureType==='automatic'||o.structureType==='simple'))add(out,issue('structure-long-sentence',offset,original,[],'This sentence is long, but no safe automatic split was found. Review its clause boundaries; length alone is not an error.','structure',0.6,'local-rule',{patternId:'structure-long-sentence',structureType:o.structureType,mode:o.mode}));
  }
  return out.filter(i => !i.replacements.length || !ranges.some(([a,b]) => i.offset < b && i.offset + i.length > a)).sort((a, b) => a.offset - b.offset || a.id.localeCompare(b.id));
}
export function applySuggestion(text, foundIssue, replacement) { if (typeof text !== 'string' || !foundIssue || typeof replacement !== 'string') throw new TypeError('text, issue, and replacement are required'); if (!Number.isInteger(foundIssue.offset) || !Number.isInteger(foundIssue.length) || foundIssue.offset < 0 || foundIssue.offset + foundIssue.length > text.length) throw new Error('Invalid issue offsets'); if (text.slice(foundIssue.offset, foundIssue.offset + foundIssue.length) !== foundIssue.original) throw new Error('Stale issue offsets'); if (!Array.isArray(foundIssue.replacements) || !foundIssue.replacements.includes(replacement)) throw new Error('Replacement is not offered by this issue'); return text.slice(0, foundIssue.offset) + replacement + text.slice(foundIssue.offset + foundIssue.length); }
export function stats(issues) { return (issues || []).reduce((a, i) => { a.total++; a.byCategory[i.category] = (a.byCategory[i.category] || 0) + 1; return a; }, { total: 0, byCategory: {} }); }
