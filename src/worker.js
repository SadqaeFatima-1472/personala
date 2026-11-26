// Cloudflare Worker "personala" — serves the site and proxies /api/* to the
// Hugging Face Space, attaching credentials server-side (never sent to browser).
//
// Worker secrets required (Settings -> Variables and secrets):
//   HF_TOKEN : Hugging Face token with read access to the Space (private Space)
//   API_KEY  : the same API_KEY set in the Space's secrets
//
// Auth sent upstream:
//   Authorization: Bearer <HF_TOKEN>   -> Hugging Face gateway
//   X-API-Key: <API_KEY>               -> your FastAPI app

const UPSTREAM = "https://syedascientist72-mlops-maci.hf.space";

// Only these routes can be reached through the public proxy.
// Keeps the API key from being usable against the rest of your API.
const ALLOWED = [
  /^health$/,
  /^predict$/,
  /^tenants\/(public_demo|demo_tenant_alpha|demo_tenant_beta)\/(reference|drift\/report|dashboard|alerts)$/,
];

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), { status, headers: JSON_HEADERS });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Anything that isn't /api/* is the static site.
    if (!url.pathname.startsWith("/api/")) {
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response("Not found", { status: 404 });
    }

    if (!["GET", "POST"].includes(request.method)) {
      return jsonError("Method not allowed", 405);
    }

    const path = url.pathname.slice("/api/".length).replace(/\/+$/, "");
    if (!ALLOWED.some((re) => re.test(path))) {
      return jsonError("Not found", 404);
    }

    // Fail loudly (secret NAMES only, never values) if a secret is missing.
    const missing = ["HF_TOKEN", "API_KEY"].filter((k) => !env[k]);
    if (missing.length) {
      return jsonError(`Proxy is missing secret(s): ${missing.join(", ")}`, 500);
    }

    const headers = new Headers();
    headers.set("Authorization", `Bearer ${env.HF_TOKEN}`);
    headers.set("X-API-Key", env.API_KEY);
    if (request.method === "POST") headers.set("Content-Type", "application/json");

    let upstream;
    try {
      upstream = await fetch(`${UPSTREAM}/${path}`, {
        method: request.method,
        headers,
        body: request.method === "POST" ? await request.text() : undefined,
      });
    } catch (e) {
      return jsonError("Live service unreachable. It may be waking up; try again shortly.", 502);
    }

    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // Upstream returned HTML/plain text (e.g. the HF gateway). Never leak it.
      const msg =
        upstream.status === 404 ? "Live service not reachable (check HF token / Space URL)"
        : upstream.status === 401 || upstream.status === 403 ? "Proxy credentials rejected"
        : `Upstream error (${upstream.status})`;
      return jsonError(msg, upstream.status);
    }
    return new Response(JSON.stringify(data), { status: upstream.status, headers: JSON_HEADERS });
  },
};
