/** Build non-overlapping display spans without interpreting a draft as HTML. */
export function highlightSegments(text, issues = []) {
  const valid = issues.filter(i => i && Number.isInteger(i.offset) && Number.isInteger(i.length) && i.offset >= 0 && i.length > 0 && i.offset + i.length <= text.length && text.slice(i.offset, i.offset + i.length) === i.original);
  const points = [...new Set([0, text.length, ...valid.flatMap(i => [i.offset, i.offset + i.length])])].sort((a, b) => a - b);
  return points.slice(0, -1).map((start, n) => {
    const end = points[n + 1];
    const covering = valid.filter(i => i.offset < end && i.offset + i.length > start);
    const issue = covering.find(i => ['grammar', 'spelling', 'punctuation'].includes(i.category)) || covering[0];
    return { text: text.slice(start, end), category: issue?.category || null };
  });
}
