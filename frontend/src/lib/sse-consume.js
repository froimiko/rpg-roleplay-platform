/* sse-consume.js — 统一 SSE(text/event-stream)逐块消费器。
 *
 * lib/md-continue.js 的 consumeSSE(支持 signal 中断)与 components/MdEditorAgent.jsx 的
 * consumeSSE/parseSSEChunk(无中断)算法逐行对应 —— 两处收口为这一份实现(以 md-continue 版
 * 为蓝本逐字复制)。MdEditorAgent 顺带获得 abort 能力(纯增益,此前无中断支持)。
 *
 * 不碰 api-client.js 的 sseStream —— 那是不同形态(EventSource 风格 + on_* handler 映射),刻意保留。
 */

/**
 * @param {Response} res      fetch() 的响应(text/event-stream body)
 * @param {function} onEvent  (event: string, data: object) => void
 * @param {{signal?: AbortSignal}} [opts]
 */
export async function consumeSSE(res, onEvent, { signal } = {}) {
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    if (signal?.aborted) { try { reader.cancel(); } catch (_) {} break; }
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const raw = buf.slice(0, i); buf = buf.slice(i + 2);
      let ev = 'message', data = '';
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) ev = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).replace(/^ /, '');
      }
      if (data) { let j = {}; try { j = JSON.parse(data); } catch (_) {} onEvent(ev, j); }
    }
  }
}
