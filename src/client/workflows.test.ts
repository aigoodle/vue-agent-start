/**
 * Unit tests for client.workflows.runGraphStream — the SSE dry-run endpoint.
 *
 * Mirrors the knowledge-hub adapter test style: stub `fetch`, assert the URL,
 * method, headers and body, and that the raw `Response` is handed back to the
 * caller (who owns body streaming), rather than being envelope-unwrapped.
 */
import { describe, expect, it, vi } from 'vitest';

import { createAgentStartClient } from './index';

function sseResponse() {
  return new Response('event: workflow_started\ndata: {}\n\n', {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('workflows.runGraphStream', () => {
  it('posts to /workflows/run-graph/stream with Accept: text/event-stream and returns the raw Response', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(sseResponse());
    const client = createAgentStartClient({ baseUrl: '/api', fetch: fetchSpy as any });
    const req = { graph: { nodes: [] }, data: { q: 1 } };

    const res = await client.workflows.runGraphStream(req);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('/api/agent-start/workflows/run-graph/stream');
    expect(init.method).toBe('POST');
    expect(init.headers.Accept).toBe('text/event-stream');
    expect(JSON.parse(init.body)).toEqual(req);
    // `raw` hands back the Response itself — not the envelope `data`.
    expect(res).toBeInstanceOf(Response);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
  });

  it('propagates the caller-owned abort signal without racing a timeout', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(sseResponse());
    const client = createAgentStartClient({ baseUrl: '/api', fetch: fetchSpy as any });
    const controller = new AbortController();

    await client.workflows.runGraphStream({ graph: {} }, { signal: controller.signal });

    const [, init] = fetchSpy.mock.calls[0]!;
    expect(init.signal).toBe(controller.signal);
  });
});
