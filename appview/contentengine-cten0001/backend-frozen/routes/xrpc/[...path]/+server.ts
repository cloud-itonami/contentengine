// PROVENANCE: moved verbatim (content unchanged below this header) from
// appview/contentengine-cten0001/svelte/src/routes/xrpc/[...path]/+server.ts
// during the Svelte → ClojureScript migration (agent/cljs-migration).
//
// This is a backend HTTP handler (the live XRPC → MCP-router proxy;
// see README.md "この BFF は何も検証しない" / "`src/app.ts` はデプロイされない"),
// not a Svelte view. It is preserved here for provenance only and will NOT
// run as-is: SvelteKit (the `@sveltejs/kit` import, the `./$types` RequestHandler
// type, and the SvelteKit adapter that used to route requests into this file)
// is gone from this repo. `wrangler.jsonc` no longer points `main` at a
// SvelteKit-built worker, so nothing invokes this handler today.
//
// Reviving this proxy requires a real Cloudflare Worker entry point (or a
// re-platformed version of `src/app.ts`, which already proxies a *different*
// upstream — see README.md's "XRPC の中継が 2 つ在り、動くのは片方だけ" table)
// that calls this logic explicitly. That decision was out of scope for this
// migration, which only ported the Svelte UI (see appview/contentengine-cten0001/cljs/).

import { json, type RequestEvent } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const DEFAULT_MCP_ROUTER_URL = 'https://mcp.etzhayyim.com/xrpc/com.etzhayyim.mcp.message';

type Env = Record<string, unknown> & { AGENTGATEWAY_MCP_ROUTER_URL?: string; MCP_ROUTER_URL?: string };

function envOf(event: RequestEvent): Env { return ((event.platform as { env?: Env } | undefined)?.env ?? {}) as Env; }

function mcpRouterUrl(env: Env): string {
  const configured = typeof env.AGENTGATEWAY_MCP_ROUTER_URL === 'string' && env.AGENTGATEWAY_MCP_ROUTER_URL.trim()
    ? env.AGENTGATEWAY_MCP_ROUTER_URL
    : typeof env.MCP_ROUTER_URL === 'string' && env.MCP_ROUTER_URL.trim()
      ? env.MCP_ROUTER_URL
      : DEFAULT_MCP_ROUTER_URL;
  return configured.replace(/\/+$/, '');
}

function noStore(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('cache-control', 'no-store');
  return json(body, { ...init, headers });
}

export const POST: RequestHandler = async (event) => {
  const nsid = event.params.path;
  if (!nsid) return noStore({ error: 'Missing XRPC method' }, { status: 400 });
  const input = await event.request.json().catch(() => ({}));
  const headers = new Headers(event.request.headers);
  headers.delete('host');
  headers.set('content-type', 'application/json');
  headers.set('x-etzhayyim-bff', 'sveltekit-edge-bff');
  headers.set('x-etzhayyim-xrpc-method', nsid);
  const upstream = await fetch(mcpRouterUrl(envOf(event)), {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method: 'tools/call', params: { name: nsid, arguments: input } })
  });
  const upstreamText = await upstream.text();
  let payload: unknown = upstreamText;
  try { payload = upstreamText ? JSON.parse(upstreamText) : null; } catch { /* Preserve text payload. */ }
  if (!upstream.ok) return noStore({ error: 'MCP router request failed', upstream: payload }, { status: upstream.status });
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error?: { message?: string } }).error;
    return noStore({ error: error?.message ?? 'MCP router returned an error', upstream: payload }, { status: 502 });
  }
  const result = payload && typeof payload === 'object' && 'result' in payload ? (payload as { result?: unknown }).result : payload;
  const structured = result && typeof result === 'object' && 'structuredContent' in result ? (result as { structuredContent?: unknown }).structuredContent : result;
  return noStore(structured ?? {});
};

export const OPTIONS: RequestHandler = async () => new Response(null, {
  status: 204,
  headers: {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-max-age': '86400'
  }
});
