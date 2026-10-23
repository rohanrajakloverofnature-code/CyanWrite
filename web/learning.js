/**
 * Small, local-only learning ledger for suggestion patterns.
 *
 * The functions mutate and return the supplied state. They intentionally store
 * rule occurrences and short before/after examples, never complete drafts.
 * A caller can skip observeIssues/recordDecision entirely when learning is off.
 */

const VERSION = 1;
const LIMITS = { patterns: 200, history: 500, dedupKeys: 1200, examples: 5, advice: 3 };
const MODES = new Set(['normal', 'administrative', 'legal', 'formal', 'business', 'literary', 'high']);
const STRUCTURES = new Set(['automatic', 'simple', 'complex', 'compound']);

const string = (value, fallback = '') => typeof value === 'string' ? value : fallback;
const clip = (value, max) => string(value).slice(0, max);
const cleanToken = value => string(value).trim().replace(/\s+/g, ' ').toLowerCase();
const now = () => Date.now();

function contextOf(context = {}) {
  const c = context && typeof context === 'object' ? context : {};
  return {
    mode: MODES.has(c.mode) ? c.mode : 'normal',
    structureType: STRUCTURES.has(c.structureType) ? c.structureType : 'automatic'
  };
}

function issueParts(issue = {}) {
  const id = clip(cleanToken(issue.patternId || issue.ruleId || issue.id), 120) || 'unknown-rule';
  const original = clip(cleanToken(issue.original), 180);
  const replacement = clip(cleanToken(issue.replacement ?? issue.replacements?.[0]), 180);
  const category = clip(cleanToken(issue.category), 60) || 'uncategorized';
  // Rule id + observed form makes a specific pattern, unlike a broad category.
  const patternId = `${id}::${category === 'structure' ? 'sentence-pattern' : original || 'no-original'}`;
  return { id, original, replacement, category, patternId };
}

function adviceFor(issue, category) {
  const message = clip(issue?.message, 300);
  if (message) return message;
  const labels = { spelling: 'Verify this spelling before applying the suggestion.', punctuation: 'Review punctuation in context; style choices are not errors.', grammar: 'Review this usage in the surrounding sentence.', clarity: 'Decide whether the shorter wording preserves your meaning.', structure: 'Consider the sentence structure for readability; this is a style choice.' };
  return labels[category] || 'Review this suggestion in context before applying it.';
}

function shortContext(text, issue) {
  if (typeof text !== 'string' || !Number.isInteger(issue?.offset)) return '';
  const start = Math.max(0, issue.offset - 32);
  const end = Math.min(text.length, issue.offset + Math.max(0, Number(issue.length) || issue.original?.length || 0) + 32);
  return clip(text.slice(start, end).replace(/\s+/g, ' ').trim(), 100);
}

function ensureState(state) {
  if (!state || typeof state !== 'object') throw new TypeError('learning state is required');
  if (!state.patterns || typeof state.patterns !== 'object' || Array.isArray(state.patterns)) state.patterns = {};
  if (!Array.isArray(state.history)) state.history = [];
  if (!Array.isArray(state.dedupKeys)) state.dedupKeys = [];
  state.maxPatterns = Number.isInteger(state.maxPatterns) ? Math.max(1, Math.min(state.maxPatterns, LIMITS.patterns)) : LIMITS.patterns;
  state.maxHistory = Number.isInteger(state.maxHistory) ? Math.max(1, Math.min(state.maxHistory, LIMITS.history)) : LIMITS.history;
  state.maxDedupKeys = Number.isInteger(state.maxDedupKeys) ? Math.max(1, Math.min(state.maxDedupKeys, LIMITS.dedupKeys)) : LIMITS.dedupKeys;
  return state;
}

function trimState(state) {
  const entries = Object.entries(state.patterns);
  if (entries.length > state.maxPatterns) {
    entries.sort((a, b) => (b[1].lastSeen || 0) - (a[1].lastSeen || 0));
    state.patterns = Object.fromEntries(entries.slice(0, state.maxPatterns));
  }
  state.history = state.history.slice(0, state.maxHistory);
  state.dedupKeys = state.dedupKeys.slice(-state.maxDedupKeys);
  return state;
}

export function createLearningState(options = {}) {
  const o = options && typeof options === 'object' ? options : {};
  return ensureState({ version: VERSION, patterns: {}, history: [], dedupKeys: [],
    maxPatterns: Number.isInteger(o.maxPatterns) ? o.maxPatterns : LIMITS.patterns,
    maxHistory: Number.isInteger(o.maxHistory) ? o.maxHistory : LIMITS.history,
    maxDedupKeys: Number.isInteger(o.maxDedupKeys) ? o.maxDedupKeys : LIMITS.dedupKeys });
}

export function observeIssues(state, issues, text = '', context = {}) {
  ensureState(state);
  if (!Array.isArray(issues)) return state;
  const c = contextOf(context);
  for (const issue of issues) {
    if (!issue || typeof issue !== 'object') continue;
    const p = issueParts(issue);
    const offset = Number.isInteger(issue.offset) ? issue.offset : -1;
    // Same rule, form, location, and replacement is one observation even if a
    // UI checks on every keystroke. A different location is a new occurrence.
    const raw = [p.patternId, offset, issue.original].join('|');
    let hash = 2166136261; for (let n = 0; n < raw.length; n++) hash = Math.imul(hash ^ raw.charCodeAt(n), 16777619);
    const dedup = `${p.id}|${offset}|${hash >>> 0}`;
    if (state.dedupKeys.includes(dedup)) continue;
    state.dedupKeys.push(dedup);
    const t = now();
    const existing = state.patterns[p.patternId] || { id: p.patternId, ruleId: p.id, category: p.category, detected: 0, accepted: 0, dismissed: 0, examples: [], contexts: {}, advice: [] };
    existing.detected += 1;
    existing.lastSeen = t;
    existing.contexts[`${c.mode}/${c.structureType}`] = (existing.contexts[`${c.mode}/${c.structureType}`] || 0) + 1;
    const example = { before: clip(issue.original, 180), after: clip(issue.replacements?.[0] ?? '', 180), context: shortContext(text, issue), at: t };
    if (!existing.examples.some(x => x.before === example.before && x.after === example.after && x.context === example.context)) existing.examples.unshift(example);
    existing.examples = existing.examples.slice(0, LIMITS.examples);
    const advice = adviceFor(issue, p.category);
    if (!existing.advice.includes(advice)) existing.advice.unshift(advice);
    existing.advice = existing.advice.slice(0, LIMITS.advice);
    state.patterns[p.patternId] = existing;
  }
  return trimState(state);
}

export function recordDecision(state, issue, decision, replacement = '', context = {}) {
  ensureState(state);
  if (!issue || typeof issue !== 'object') return state;
  if (decision !== 'accepted' && decision !== 'dismissed' && decision !== 'accept' && decision !== 'dismiss') throw new RangeError('decision must be accepted or dismissed');
  const p = issueParts({ ...issue, replacement: replacement || issue.replacement });
  const key = p.patternId;
  const t = now();
  const pattern = state.patterns[key] || { id: key, ruleId: p.id, category: p.category, detected: 0, accepted: 0, dismissed: 0, examples: [], contexts: {}, advice: [] };
  const action = decision === 'accept' ? 'accepted' : decision === 'dismiss' ? 'dismissed' : decision;
  pattern[action] += 1;
  pattern.lastDecision = t;
  state.patterns[key] = pattern;
  state.history.unshift({ patternId: key, ruleId: p.id, decision: action, before: clip(issue.original, 180), after: clip(replacement || issue.replacements?.[0] || '', 180), context: contextOf(context), at: t });
  return trimState(state);
}

export function summarizeLearning(state) {
  ensureState(state);
  const patterns = Object.values(state.patterns).sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
  const totals = patterns.reduce((a, p) => { a.detected += p.detected || 0; a.accepted += p.accepted || 0; a.dismissed += p.dismissed || 0; return a; }, { detected: 0, accepted: 0, dismissed: 0 });
  return { version: VERSION, patterns: patterns.map(p => ({ ...p, examples: p.examples.slice(0, LIMITS.examples), advice: p.advice.slice(0, LIMITS.advice) })), patternCount: patterns.length, ...totals, recentDecisions: state.history.slice(0, 20).map(x => ({ ...x })) };
}

export function sanitizeLearningState(input) {
  const source = input && typeof input === 'object' ? input : {};
  const state = createLearningState(source);
  const rawPatterns = source.patterns && typeof source.patterns === 'object' && !Array.isArray(source.patterns) ? source.patterns : {};
  for (const raw of Object.values(rawPatterns).slice(0, LIMITS.patterns)) {
    if (!raw || typeof raw !== 'object') continue;
    const id = clip(cleanToken(raw.id || raw.patternId), 200); if (!id) continue;
    state.patterns[id] = { id, ruleId: clip(cleanToken(raw.ruleId), 120), category: clip(cleanToken(raw.category), 60) || 'uncategorized', detected: Math.max(0, Number(raw.detected) || 0), accepted: Math.max(0, Number(raw.accepted) || 0), dismissed: Math.max(0, Number(raw.dismissed) || 0), lastSeen: Number(raw.lastSeen) || 0, examples: Array.isArray(raw.examples) ? raw.examples.slice(0, LIMITS.examples).map(x => ({ before: clip(x?.before, 180), after: clip(x?.after, 180), context: clip(x?.context, 100), at: Number(x?.at) || 0 })) : [], contexts: raw.contexts && typeof raw.contexts === 'object' ? Object.fromEntries(Object.entries(raw.contexts).slice(0, 20).map(([k, v]) => [clip(k, 60), Math.max(0, Number(v) || 0)])) : {}, advice: Array.isArray(raw.advice) ? raw.advice.slice(0, LIMITS.advice).map(x => clip(x, 300)).filter(Boolean) : [] };
  }
  state.history = Array.isArray(source.history) ? source.history.slice(0, LIMITS.history).filter(x => x && typeof x === 'object').map(x => ({ patternId: clip(x.patternId, 200), ruleId: clip(x.ruleId, 120), decision: x.decision === 'accepted' || x.decision === 'dismissed' ? x.decision : 'dismissed', before: clip(x.before, 180), after: clip(x.after, 180), context: contextOf(x.context), at: Number(x.at) || 0 })) : [];
  state.dedupKeys = Array.isArray(source.dedupKeys) ? source.dedupKeys.slice(-state.maxDedupKeys).map(x => clip(x, 400)).filter(Boolean) : [];
  return trimState(state);
}
