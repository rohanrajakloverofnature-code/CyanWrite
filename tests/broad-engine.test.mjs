import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../web/engine.js';

const quiet = { grammar: false, spelling: false, punctuation: false, clarity: false };
function expectRewrite(mode, structureType, text, expected) {
  const issues = analyze(text, { ...quiet, mode, structureType }).filter(x => x.category === 'structure' && x.replacements.length);
  assert.equal(issues.length, 1, `${mode}/${structureType}: ${text}`);
  assert.equal(issues[0].replacements[0], expected);
  assert.equal(issues[0].mode, mode);
  assert.equal(issues[0].structureType, structureType === 'automatic' ? 'simple' : structureType);
}

// Each case is intentionally asserted separately: these are outcomes, not a coverage loop.
test('normal / automatic comma splice', () => expectRewrite('normal','automatic','The report was late, The client complained.','The report was late. The client complained.'));
test('normal / simple causal', () => expectRewrite('normal','simple','The plan changed because costs increased.','Costs increased. As a result, the plan changed.'));
test('normal / complex causal', () => expectRewrite('normal','complex','Because costs increased, the plan changed.','The plan changed because costs increased.'));
test('normal / compound causal', () => expectRewrite('normal','compound','The plan changed because costs increased.','Costs increased, so the plan changed.'));

test('administrative / automatic comma splice', () => expectRewrite('administrative','automatic','The report was late, The client complained.','The report was late. The client complained.'));
test('administrative / simple concessive', () => expectRewrite('administrative','simple','Although the process was slow, the office continued.','The process was slow. Nevertheless, the office continued.'));
test('administrative / complex concessive', () => expectRewrite('administrative','complex','Although the process was slow, the office continued.','The office continued although the process was slow.'));
test('administrative / compound causal', () => expectRewrite('administrative','compound','The office continued because demand increased.','Demand increased, so the office continued.'));

test('legal / automatic comma splice', () => expectRewrite('legal','automatic','The notice was late, The hearing continued.','The notice was late. The hearing continued.'));
test('legal / simple causal without obligation', () => expectRewrite('legal','simple','The hearing continued because the notice arrived.','The notice arrived. As a result, the hearing continued.'));
test('legal / complex concessive without obligation', () => expectRewrite('legal','complex','Although the notice arrived, the hearing continued.','The hearing continued although the notice arrived.'));
test('legal / compound causal without obligation', () => expectRewrite('legal','compound','The hearing continued because the notice arrived.','The notice arrived, so the hearing continued.'));

test('formal / automatic comma splice', () => expectRewrite('formal','automatic','The proposal was late, The committee responded.','The proposal was late. The committee responded.'));
test('formal / simple coordination', () => expectRewrite('formal','simple','The proposal was late, and the committee responded.','The proposal was late. The committee responded.'));
test('formal / complex causal', () => expectRewrite('formal','complex','The proposal arrived, so the committee responded.','The committee responded because the proposal arrived.'));
test('formal / compound concessive', () => expectRewrite('formal','compound','Although the proposal was late, the committee responded.','The proposal was late, but the committee responded.'));

// A requested compound form that is already compound is honestly a no-op; use a causal family for a useful alternative.
test('business / automatic comma splice', () => expectRewrite('business','automatic','Sales fell, The team adapted.','Sales fell. The team adapted.'));
test('business / simple causal', () => expectRewrite('business','simple','The team adapted because sales fell.','Sales fell. As a result, the team adapted.'));
test('business / complex causal', () => expectRewrite('business','complex','Because sales fell, the team adapted.','The team adapted because sales fell.'));
test('business / compound causal', () => expectRewrite('business','compound','The team adapted because sales fell.','Sales fell, so the team adapted.'));

test('literary / automatic comma splice', () => expectRewrite('literary','automatic','The dusk arrived, The birds settled.','The dusk arrived. The birds settled.'));
test('literary / simple concessive', () => expectRewrite('literary','simple','Although the dusk deepened, the birds settled.','The dusk deepened. Nevertheless, the birds settled.'));
test('literary / complex concessive', () => expectRewrite('literary','complex','Although the dusk deepened, the birds settled.','The birds settled although the dusk deepened.'));
test('literary / compound causal', () => expectRewrite('literary','compound','The birds settled because the dusk deepened.','The dusk deepened, so the birds settled.'));

test('high / automatic comma splice', () => expectRewrite('high','automatic','The review ended, The board responded.','The review ended. The board responded.'));
test('high / simple causal', () => expectRewrite('high','simple','The board responded because the review ended.','The review ended. As a result, the board responded.'));
test('high / complex causal', () => expectRewrite('high','complex','Because the review ended, the board responded.','The board responded because the review ended.'));
test('high / compound causal', () => expectRewrite('high','compound','The board responded because the review ended.','The review ended, so the board responded.'));

test('non-statements, quoted evidence, and legal conditions remain safe no-ops', () => {
  for (const text of ['Did the plan change because costs increased?', 'Close the door because the alarm sounds!', 'What a change!', 'The witness said "We can\'t attend because the office is closed."', 'The supplier shall pay if the buyer approves.']) {
    assert.equal(analyze(text, { ...quiet, mode: 'legal', structureType: 'compound' }).filter(x => x.category === 'structure' || x.category === 'tone').length, 0, text);
  }
});
