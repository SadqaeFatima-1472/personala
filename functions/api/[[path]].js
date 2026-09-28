/**
 * functions/api/[[path]].js — Cloudflare Pages Function.
 *
 * A secure proxy in front of the real Sentinel API. The real API key
 * lives ONLY as an encrypted environment variable in the Cloudflare
 * dashboard (Workers & Pages -> your project -> Settings -> Variables
 * and Secrets) — never in this file, never committed to git, never
 * sent to the browser. The browser calls same-origin paths like
 * /api/predict; this function attaches the real Authorization header
 * server-side and forwards the request.
 *
 * SECOND layer of protection, beyond hiding the key: an explicit
 * allow-list of forwardable paths. Even if someone inspects network
 * traffic and tries hitting this proxy directly with a different path
 * (e.g. to reach another tenant's data, or a destructive endpoint),
 * anything not on this list is rejected with 403 before it ever
 * reaches the real API. This is a stricter posture than the Streamlit
 * demo, which relies on the UI simply not exposing other actions —
 * here, the server itself refuses out-of-scope requests regardless of
 * what the client sends.
 *
 * Every allowed path below operates ONLY on isolated demo tenants
 * (public_demo, demo_tenant_alpha, demo_tenant_beta) or on read-only /
 * non-mutating shared endpoints (health, predict). None of them can
 * touch a real customer's tenant data.
 */

const DEMO_TENANTS = ["public_demo", "demo_tenant_alpha", "demo_tenant_beta"];

function isAllowedPath(path) {
  if (path === "health" || path === "predict") return true;
  for (const tenant of DEMO_TENANTS) {
    if (
      path === `tenants/${tenant}/reference` ||
      path === `tenants/${tenant}/drift/report` ||
      path === `tenants/${tenant}/dashboard` ||
      path === `tenants/${tenant}/alerts`
    ) {
      return true;
    }
  }
  return false;
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const path = (params.path || []).join("/");

  if (!isAllowedPath(path)) {
    return new Response(
      JSON.stringify({ error: "This demo proxy does not permit that path." }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const base = env.SENTINEL_API_BASE;
  const key = env.SENTINEL_API_KEY;
  if (!base || !key) {
    return new Response(
      JSON.stringify({ error: "Demo backend is not configured. Set SENTINEL_API_BASE and SENTINEL_API_KEY in Cloudflare Pages secrets." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const targetUrl = `${base.replace(/\/$/, "")}/${path}`;
  const init = {
    method: request.method,
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  try {
    const upstream = await fetch(targetUrl, init);
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Could not reach the live model right now.", detail: String(e) }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
