// Keys remain in memory and travel only to the HTTPS endpoint chosen in Preferences.
export function createNativeTransport(bridge, host = globalThis) {
  if (typeof bridge?.requestAI !== 'function') return undefined;
  const pending = new Map(); let sequence = 0;
  host.__cyanAIReply = (id, status, body) => {
    const item = pending.get(id); if (!item) return;
    item.finish();
    if (status === 0) item.reject(new Error('AI connection failed. Check the HTTPS address and internet connection.'));
    else item.resolve(new Response(body, {status}));
  };
  return (url, init = {}) => new Promise((resolve, reject) => {
    const id = 'ai-' + (++sequence);
    const abort = () => { bridge.cancelAI?.(id); finish(); reject(new DOMException('Request cancelled', 'AbortError')); };
    const finish = () => { clearTimeout(timer); pending.delete(id); init.signal?.removeEventListener('abort', abort); };
    const timer = setTimeout(abort, 25000);
    pending.set(id, {resolve, reject, finish});
    if (init.signal?.aborted) { abort(); return; }
    init.signal?.addEventListener('abort', abort, {once: true});
    try { bridge.requestAI(id, String(url), JSON.stringify(init.headers || {}), init.body || ''); }
    catch { finish(); reject(new Error('Android AI transport is unavailable.')); }
  });
}
