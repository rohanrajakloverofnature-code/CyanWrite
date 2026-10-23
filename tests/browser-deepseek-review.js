// Run in the page's MAIN JavaScript world on a fresh local review origin.
// All provider requests are intercepted; no API key or provider access is needed.
(async () => {
  const q = s => document.querySelector(s), passed = [], calls = [], original = window.fetch;
  const assert = (value, label) => { if (!value) throw Error(label); passed.push(label); };
  const change = (id, value) => { const node = q(id); if (node.type === 'checkbox') node.checked = value; else node.value = value; node.dispatchEvent(new Event('change')); };
  const key = () => { q('#ai-api-key').value = 'deepseek-ui-mock-not-real'; q('#ai-api-key').dispatchEvent(new Event('input')); };
  window.fetch = async (url, init) => {
    calls.push({ url, model: JSON.parse(init.body).model, auth: init.headers.Authorization });
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"issues":[]}' } }] }), { status: 200 });
  };
  try {
    change('#ai-enabled', false); change('#ai-auto', false);
    assert(!q('#ai-auto').checked, 'Automatic AI disabled');
    change('#ai-provider', 'deepseek');
    assert(q('#ai-base-url').value === 'https://api.deepseek.com', 'Official base URL preset');
    assert(q('#ai-model').value === '' && q('#ai-model-mode').value === 'auto', 'Flash default model');
    assert([...q('#ai-model-options').options].map(x => x.value).join(',') === 'deepseek-flash,deepseek-v4-pro', 'Both model suggestions');
    assert(q('#ai-model-help').textContent.includes('DeepSeek default: deepseek-flash'), 'Visible default and alternative help');
    key(); assert(calls.length === 0, 'Provider/key changes make no requests');
    await q('#ai-test').onclick(); assert(calls.length === 0, 'Connection test requires consent');
    change('#ai-enabled', true); await q('#ai-test').onclick();
    assert(calls.length === 1 && calls[0].url === 'https://api.deepseek.com/chat/completions', 'Manual test reaches exact mocked DeepSeek URL');
    assert(calls[0].model === 'deepseek-flash' && calls[0].auth === 'Bearer deepseek-ui-mock-not-real', 'Flash model and Bearer authentication');
    assert(q('#ai-connection-status').textContent.includes('Connection successful'), 'Valid response shown');
    assert(!localStorage.getItem('cyanwrite-v1').includes('deepseek-ui-mock-not-real'), 'Key excluded from storage');
    change('#ai-model', 'deepseek-v4-pro'); await q('#ai-test').onclick();
    assert(calls[1].model === 'deepseek-v4-pro', 'Pro model selected without changing key');
    change('#ai-base-url', 'https://api.deepseek.com/v1'); assert(q('#ai-api-key').value === '', 'Endpoint change clears key');
    key(); change('#ai-provider', 'openai');
    assert(q('#ai-api-key').value === '' && q('#ai-model').value === '' && q('#ai-model-mode').value === 'auto', 'Provider switch clears key and restores preset');
    assert(q('#ai-model-options').options.length === 0, 'No stale DeepSeek model suggestions');
    change('#ai-provider', 'deepseek'); key();
    window.fetch = async () => new Response('{}', { status: 401 }); await q('#ai-test').onclick();
    assert(q('#ai-connection-status').textContent.includes('authentication'), 'Authentication error safely displayed');
    q('#ai-clear-key').click(); assert(q('#ai-api-key').value === '', 'Clear key works');
    assert(q('.ai-settings').textContent.includes('Provider charges may apply'), 'Cost warning retained');
    document.documentElement.dataset.deepseekReview = JSON.stringify({ passed, count: passed.length, mockOnly: true });
  } catch (error) {
    document.documentElement.dataset.deepseekReview = JSON.stringify({ passed, error: String(error) });
  } finally {
    window.fetch = original; q('#ai-clear-key').click(); change('#ai-enabled', false);
  }
})();
