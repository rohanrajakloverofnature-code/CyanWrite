/** Conservative, deterministic sentence and register rewrites. Unsupported language is left intact. */
const ABBREVIATIONS = new Set(['mr','mrs','ms','dr','prof','sr','jr','st','vs','etc','e.g','i.e','fig','no','inc','ltd','jan','feb','mar','apr','jun','jul','aug','sep','sept','oct','nov','dec']);

export function sentenceSpans(text) {
  const out = []; let start = 0;
  const push = end => { const raw = text.slice(start, end), lead = raw.search(/\S/); if (lead >= 0) out.push({ offset: start + lead, original: raw.slice(lead) }); start = end; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i]; if (!'.!?'.includes(c)) continue;
    if (c === '.' && /\d/.test(text[i - 1] || '') && /\d/.test(text[i + 1] || '')) continue;
    if (c === '.' && text[i + 1] === '.') continue;
    if (c === '.' && /[A-Za-z]/.test(text[i + 1] || '')) continue;
    if (c === '.') {
      const token = (text.slice(start, i + 1).match(/([A-Za-z](?:[A-Za-z.]*)?)\.$/) || [])[1]?.toLowerCase();
      if (token && (ABBREVIATIONS.has(token) || /^[a-z]$/.test(token))) continue;
    }
    let end = i + 1; while (end < text.length && /[.!?"'”’»)]/.test(text[end])) end++;
    if (end < text.length && !/\s/.test(text[end])) continue;
    push(end); i = end - 1;
  }
  return out;
}

const up = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const down = s => /^(The|This|That|These|Those|We|They|He|She|It|You|Our|A|An)\b/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
const modeNames = { normal: 'normal', administrative: 'administrative', legal: 'legal', formal: 'formal', business: 'business', literary: 'literary', high: 'high-standards' };
const STRUCTURES = new Set(['simple', 'complex', 'compound']);

function quotedRanges(text) {
  const ranges = []; let start = -1, quote = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i], apostrophe = (c === "'" || c === '’') && /[\p{L}\p{N}]/u.test(text[i - 1] || '') && /[\p{L}\p{N}]/u.test(text[i + 1] || '');
    if (quote) { if (!apostrophe && (c === quote || (quote === '“' && c === '”') || (quote === '‘' && c === '’'))) { ranges.push([start, i + 1]); start = -1; quote = ''; } }
    else if (c === '"' || c === '“' || c === '‘' || (c === "'" && !/[\p{L}\p{N}]/u.test(text[i - 1] || ''))) { start = i; quote = c; }
  }
  if (start >= 0) ranges.push([start, text.length]);
  return ranges;
}
function outsideQuotes(text, fn) { const ranges = quotedRanges(text); let out = '', at = 0; for (const [a, b] of ranges) { out += fn(text.slice(at, a)); out += text.slice(a, b); at = b; } return out + fn(text.slice(at)); }
function preserveCase(original, replacement) { if (original === original.toUpperCase()) return replacement.toUpperCase(); if (/^[A-Z]/.test(original)) return up(replacement); return replacement; }

function register(text, mode) {
  const common = [
    [/\bat this point in time\b/gi, 'now'], [/\bin order to\b/gi, 'to'], [/\bdue to the fact that\b/gi, 'because'],
    [/\bwith regard to\b/gi, 'regarding'], [/\bat the present time\b/gi, 'now'], [/\bprior to\b/gi, 'before']
  ];
  const rules = [...common];
  if (['administrative', 'legal', 'formal', 'business', 'high'].includes(mode)) rules.push([/^Hey,\s+/i, ''], [/\bplease be advised that\b/gi, 'please note that'], [/\bcan['’]t\b/gi, 'cannot'], [/\bwon['’]t\b/gi, 'will not']);
  if (['administrative', 'legal', 'formal', 'business', 'high'].includes(mode)) rules.push([/\b(what|why|where|who|how|when) the (?:hell|heck|fuck)\b/gi, '$1']);
  // Register-specific reusable families, not replacements for one example.
  const profiles = {
    normal: [[/\butilize\b/gi, 'use'], [/\bcommence\b/gi, 'start']],
    administrative: [[/\bsend in the (application|form|documents)\b/gi, 'submit the $1']],
    legal: [[/\bas per (this|the) agreement\b/gi, 'in accordance with $1 agreement']],
    formal: [[/\bget in touch with\b/gi, 'contact'], [/\bdon['’]t\b/gi, 'do not']],
    business: [[/\bplease do not hesitate to contact\b/gi, 'please contact'], [/\bfor the purpose of\b/gi, 'for']],
    high: [[/\bvery essential\b/gi, 'essential'], [/\bin close proximity to\b/gi, 'near']]
  };
  rules.push(...(profiles[mode] || []));
  if (mode === 'literary') rules.push([/\bin a very quiet manner\b/gi, 'quietly'], [/\bin a very slow manner\b/gi, 'slowly']);
  return outsideQuotes(text, segment => {
    const greeting = ['administrative', 'legal', 'formal', 'business', 'high'].includes(mode) && /^Hey,\s+/i.test(segment);
    let value = rules.reduce((current, [re, replacement]) => current.replace(re, (m, ...args) => preserveCase(m, replacement.replace('$1', args[0]))), segment);
    if (greeting) value = value.replace(/^([a-z])/, (_, c) => c.toUpperCase());
    return value;
  });
}

function terminalKind(text) { const m = text.match(/[!?](?:["'”’»)]*)$/); return m ? (m[0].includes('?') ? 'question' : 'exclamation') : 'statement'; }
function completed(original) { return /[.!?](?:["'”’»)]*)$/.test(original) && !/\.\.\.(?:["'”’»)]*)$/.test(original); }

export function registerRewrites(original, options = {}) {
  if (typeof original !== 'string' || !completed(original)) return [];
  const mode = modeNames[options.mode] ? options.mode : 'normal';
  const value = register(original, mode); if (value === original) return [];
  const target = STRUCTURES.has(options.structureType) ? options.structureType : 'automatic';
  return [{ pattern: 'register', structure: 'unchanged', value, message: `Use supported ${modeNames[mode]} wording. This is a tone/wording suggestion only: the sentence remains a ${terminalKind(original)}. ${target === 'automatic' ? 'Best automatic retains the existing clause structure.' : `The requested ${target} structure is not being claimed by this wording-only edit; a safe structural rewrite may not be available.`} Review meaning before applying.` }];
}

function clauseLike(value) {
  const s = value.trim();
  if (!s || /[,;:]$/.test(s)) return false;
  // Require a likely subject and finite verb, but do not pretend to parse arbitrary language.
  const subject = /^(?:I|you|we|they|he|she|it|there|this|that|these|those|[A-Z][\w’'-]*|(?:the|a|an|our|their|your|my|his|her)\s+[\w’'-]+)\b/i.test(s);
  const predicate = s.replace(/^(?:(?:the|a|an|our|their|your|my|his|her)\s+\S+|\S+)\s*/i, '');
  const finite = /\b(?:am|is|are|was|were|has|have|had|do|does|did|cannot|can|could|will|would|shall|should|must|may|might|fell|left|went|ran|knew|met|read|wrote|sent|paid|cost|rain|work|agree|need|want|know|[a-z][a-z’'-]*(?:ed|s))\b/i.test(predicate);
  return subject && finite;
}
function parseRelation(content) {
  let m;
  if ((m = content.match(/^Because\s+(.+?),\s+(.+)$/i)) && clauseLike(m[1]) && clauseLike(m[2])) return { type: 'causal', cause: m[1], effect: m[2], subordinateFirst: true };
  if ((m = content.match(/^(.+?)\s+because\s+(.+)$/i)) && clauseLike(m[1]) && clauseLike(m[2])) return { type: 'causal', cause: m[2], effect: m[1], subordinateFirst: false };
  if ((m = content.match(/^(?:Although|Even though)\s+(.+?),\s+(.+)$/i)) && clauseLike(m[1]) && clauseLike(m[2])) return { type: 'concessive', contrast: m[1], main: m[2], subordinateFirst: true };
  if ((m = content.match(/^(.+?)\s+(?:although|even though)\s+(.+)$/i)) && clauseLike(m[1]) && clauseLike(m[2])) return { type: 'concessive', contrast: m[2], main: m[1], subordinateFirst: false };
  if ((m = content.match(/^(.+?),\s+(and|but|so|yet)\s+(.+)$/i)) && clauseLike(m[1]) && clauseLike(m[3])) return { type: 'coordinate', first: m[1], join: m[2].toLowerCase(), second: m[3] };
  if ((m = content.match(/^(.+?);\s+(.+)$/)) && clauseLike(m[1]) && clauseLike(m[2])) return { type: 'semicolon', first: m[1], second: m[2] };
  if ((m = content.match(/^(.+?),\s+(.+)$/)) && clauseLike(m[1]) && clauseLike(m[2])) return { type: 'comma-splice', first: m[1], second: m[2] };
  return null;
}

export function structureRewrites(original, options = {}) {
  if (typeof original !== 'string' || !completed(original)) return [];
  const mode = modeNames[options.mode] ? options.mode : 'normal';
  const target = STRUCTURES.has(options.structureType) ? options.structureType : 'automatic';
  // Questions, imperatives, and exclamations have pragmatic force that punctuation alone cannot safely preserve.
  if (terminalKind(original) !== 'statement') return [];
  const ranges = quotedRanges(original); if (ranges.length) return [];
  let body = original, ending = ''; const last = body.match(/[.!](?:["'”’»)]*)$/); if (!last) return [];
  ending = last[0]; body = body.slice(0, -ending.length); if (ending !== '.') return [];
  const content = body.trim(), relation = parseRelation(content), result = [];
  const protectedLegal = /\b(shall|must|may|unless|provided|provided that|if|notwithstanding|liable|liability|indemnif|warrant|covenant|condition)\b/i.test(content);
  if (protectedLegal) return [];
  if (!relation) return [];
  // A shallow relation match does not establish simple/compound structure in a
  // sentence containing further embedded clauses. Leave it for broader review.
  const parts = [relation.cause, relation.effect, relation.contrast, relation.main, relation.first, relation.second].filter(Boolean);
  if (parts.some(part => /\b(because|although|though|unless|until|when|while|whereas|if|that|which|who|whom|whose)\b/i.test(part) || /[,;]\s*(?:and|but|or|nor|so|yet)?\s+/i.test(part))) return [];
  const add = (pattern, structure, text, explanation) => {
    const value = register(text, mode); if (value === original || result.some(x => x.value === value)) return;
    result.push({ pattern, structure, value, message: `${explanation} ${modeNames[mode]} mode; ${target === 'automatic' ? 'best automatic' : target} structure. No facts or relationships were added. Review meaning before applying.` });
  };
  const simple = (a, b, marker = '') => `${up(a)}. ${marker}${marker ? down(b) : up(b)}.`;
  if (target === 'simple' || (target === 'automatic' && (relation.type === 'comma-splice' || relation.type === 'semicolon' || (relation.type === 'coordinate' && content.split(/\s+/).length >= 24)))) {
    if (relation.type === 'causal') add('causal', 'simple', simple(relation.cause, relation.effect, 'As a result, '), 'Express the cause first, then its result in two simple sentences.');
    if (relation.type === 'concessive') add('concessive', 'simple', simple(relation.contrast, relation.main, 'Nevertheless, '), 'Keep the contrast across two simple sentences.');
    if (relation.type === 'coordinate') { const marker = { and: '', but: 'However, ', yet: 'Nevertheless, ', so: 'As a result, ' }[relation.join]; add('coordinate', 'simple', simple(relation.first, relation.second, marker), 'Split two independent clauses while retaining their relationship.'); }
    if (relation.type === 'comma-splice' || relation.type === 'semicolon') add(relation.type, 'simple', simple(relation.first, relation.second), 'Separate two complete clauses into simple sentences without changing their content.');
  }
  if (target === 'compound') {
    if (relation.type === 'causal') add('causal', 'compound', `${up(relation.cause)}, so ${down(relation.effect)}.`, 'Keep the cause before the effect using “so.”');
    if (relation.type === 'concessive') add('concessive', 'compound', `${up(relation.contrast)}, but ${down(relation.main)}.`, 'Connect the existing contrast with “but.”');
    if (relation.type === 'coordinate') add('coordinate', 'compound', `${up(relation.first)}, ${relation.join} ${down(relation.second)}.`, 'Use one compound sentence and retain the existing coordinator.');
    if (relation.type === 'comma-splice' || relation.type === 'semicolon') add(relation.type, 'compound', `${up(relation.first)}; ${down(relation.second)}.`, 'Use a semicolon between complete clauses without inventing a relationship.');
  }
  if (target === 'complex') {
    if (relation.type === 'causal') add('causal', 'complex', `${up(relation.effect)} because ${down(relation.cause)}.`, 'Retain the causal subordinate clause while foregrounding the main clause.');
    if (relation.type === 'concessive' && relation.subordinateFirst) add('concessive', 'complex', `${up(relation.main)} although ${down(relation.contrast)}.`, 'Retain the existing contrast while foregrounding the main clause.');
    if (relation.type === 'coordinate' && relation.join === 'so') add('causal', 'complex', `${up(relation.second)} because ${down(relation.first)}.`, 'Express the existing cause and effect with a subordinate clause.');
    if (relation.type === 'coordinate' && ['but', 'yet'].includes(relation.join)) add('concessive', 'complex', `Although ${down(relation.first)}, ${down(relation.second)}.`, 'Express the existing contrast with an “although” clause.');
  }
  const styled = register(original, mode);
  if (styled !== original && target === 'automatic') add('register', 'unchanged', styled, 'Use supported mode-appropriate wording without adding information; clause structure is retained.');
  return result.slice(0, 3);
}
