/**
 * src/worker.js — a real Worker script, required alongside your static
 * assets so this project stops being a "static assets only" Worker
 * (which cannot hold secrets or run any code — see wrangler.jsonc's
 * `run_worker_first` for why this script only ever sees /api/* requests;
 * everything else is served as a plain static file, free, with zero
 * Worker invocation).
 *
 * Same security model as before, just in the plain Workers `fetch`
 * handler format instead of the Cloudflare Pages Functions convention
 * (`onRequest`) — this project is a Workers-with-static-assets
 * deployment, not a classic Pages project, so the Pages-specific
 * convention was never going to be picked up here.
 *
 * The real API key lives ONLY as an encrypted environment variable,
 * set in the Cloudflare dashboard (Workers & Pages -> personala ->
 * Settings -> Variables and Secrets) once this file makes "Variables
 * and secrets" available again — never in this file, never in git.
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // With run_worker_first scoped to ["/api/*"] in wrangler.jsonc, this
    // Worker only ever receives requests under /api/ — but this check is
    // kept anyway as defense in depth, in case that config ever changes.
    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    const path = url.pathname.replace(/^\/api\//, "");

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
  },
};
