// Phase 3 streaming: a local reply that streams Markdown in small packets (no network, no inference). Install on a
// context before the page opens: await streamReplies(ctx, { packets, every }). The page's fetch to the model is
// answered by a ReadableStream that honours Stop (AbortSignal). window.__stream.done counts finished replies.
exports.streamReplies = async (ctx, { packets = 120, every = 60 } = {}) => {
  await ctx.addInitScript(({ packets, every }) => {
    const native = window.fetch;
    window.__stream = { started: 0, done: 0, longTasks: [], t0: 0, t1: 0 };
    try { new PerformanceObserver((l) => window.__stream.longTasks.push(...l.getEntries().map((e) => [Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask' }); } catch { /* not supported */ }
    const words = 'Lumen streams this reply a few words at a time so the reading view, the scroll position and Stop can be checked while it grows'.split(' ');
    window.fetch = async (url, options = {}) => {
      if (!String(url).includes('generativelanguage.googleapis.com') || String(url).includes('/models?')) return native(url, options);
      window.__stream.started++; window.__stream.t0 = performance.now();
      const enc = new TextEncoder();
      const packet = (text) => enc.encode(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`);
      let timer, n = 0, ended = false;
      return new Response(new ReadableStream({
        start(c) {
          const abort = () => { if (ended) return; ended = true; clearTimeout(timer); c.error(new DOMException('Stopped', 'AbortError')); };
          options.signal?.addEventListener('abort', abort, { once: true });
          const next = () => {
            if (ended) return;
            const w = Array.from({ length: 6 }, (_, i) => words[(n * 6 + i) % words.length]).join(' ');
            c.enqueue(packet(n % 14 === 13 ? `${w}.\n\n## Part ${Math.ceil(n / 14) + 1}\n\n` : n % 5 === 4 ? `${w}.\n\n` : `${w} `));
            if (++n < packets) timer = setTimeout(next, every);
            else { c.enqueue(packet('\n\nThat is the whole reply.')); c.enqueue(enc.encode(`data: ${JSON.stringify({ candidates: [{ finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 900 } })}\n\n`)); ended = true; window.__stream.done++; window.__stream.t1 = performance.now(); c.close(); }
          };
          timer = setTimeout(next, 300);
        },
        cancel() { ended = true; clearTimeout(timer); },
      }), { headers: { 'content-type': 'text/event-stream' } });
    };
  }, { packets, every });
};
