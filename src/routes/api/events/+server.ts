import type { RequestHandler } from './$types';
import { agentBus, type AgentBusEvent } from '$lib/server/sse';

/**
 * Server-Sent Events stream of agent activity. Browsers subscribe via
 * `new EventSource('/api/events')`. We send a `hello` immediately so
 * the client knows the connection is live, then forward every
 * `agent-run` from the in-process bus, plus a keepalive comment every
 * 15s to defeat proxies that drop idle connections.
 */
export const GET: RequestHandler = async () => {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Connection closed mid-write — ignore.
        }
      };

      const onRun = (e: AgentBusEvent) => send('agent-run', e);
      agentBus.on('agent-run', onRun);
      send('hello', { connectedAt: new Date().toISOString() });

      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ka\n\n'));
        } catch {
          /* socket closed */
        }
      }, 15_000);

      return () => {
        agentBus.off('agent-run', onRun);
        clearInterval(keepalive);
      };
    },
    cancel() {
      // SvelteKit will invoke the cleanup returned by `start` when the
      // client disconnects; nothing extra needed here.
    }
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no'
    }
  });
};
