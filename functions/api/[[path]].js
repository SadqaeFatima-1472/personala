# Sentinel Live Simulation — Deployment Guide

An investor-facing demo page that calls your **real** Sentinel API, secured through a Cloudflare Pages Function proxy so the real API key never reaches the browser. Tested end-to-end against a live copy of your actual `main.py`/`tenants.py`/`explain.py` before being handed over — see "What was actually verified" at the bottom.

## What's in this bundle

```
functions/api/[[path]].js   ← the secure proxy (Cloudflare Pages Function)
public/simulation.html      ← the demo page itself
```

## How the security works, in one paragraph

The browser never holds your API key. It calls same-origin paths like `/api/predict`. The Cloudflare Function reads the real key from an **encrypted environment variable** (set in the Cloudflare dashboard, never committed to git) and attaches it server-side before forwarding to your real Sentinel API. On top of that, the function only forwards a fixed allow-list of paths — `health`, `predict`, and the isolated demo tenants (`public_demo`, `demo_tenant_alpha`, `demo_tenant_beta`). Anything else, even if someone finds the proxy URL and pokes at it directly, gets rejected with a 403 before it ever reaches your real API or your real key. This was tested directly: a real disallowed path and a real non-demo tenant ID both correctly returned 403.

## Deploy steps

1. **Add these two files to your website's git repo** (same repo Cloudflare Pages already builds from), keeping the exact folder structure — `functions/api/[[path]].js` and `public/simulation.html` (or wherever your Pages project's output directory is — adjust the path if your repo doesn't use a `public/` folder).

2. **Set the secrets in Cloudflare, not in git:**
   - Cloudflare dashboard → **Workers & Pages** → your Pages project → **Settings** → **Variables and Secrets** → **Add**
   - Add `SENTINEL_API_BASE` = your HF Space URL (e.g. `https://syedascientist72-mlops-maci.hf.space`)
   - Add `SENTINEL_API_KEY` = the same `API_KEY` value set in your HF Space's own secrets
   - Mark both as **Encrypted** so they're not visible again in the dashboard after saving

3. **Push to git.** Cloudflare Pages redeploys automatically.

4. **Visit `yoursite.com/simulation.html`** — this page is intentionally not linked from your nav (matching the OT testbed page's pattern), reachable only by direct link, and has a `noindex` tag so it won't get crawled.

## What's on the page

- **Act 1 — Scoring:** two buttons build a synthetic legitimate or fraud-like transaction client-side, send it to the real `/predict` endpoint, and reveal the real fraud probability and decision.
- **Act 2 — Drift Detection:** sets a clean baseline on the isolated `public_demo` tenant, then steps through 4 weeks of increasingly shifted synthetic data, calling the real drift-detection endpoint each time and showing the real alert level climb — including the plain-language Explain summary once an alert fires.
- **Act 3 — Multi-Tenant Isolation:** registers two isolated tenants (Alpha, Beta), drifts Alpha hard, leaves Beta clean, and pulls both dashboards live side by side.

## What was actually verified before this was handed to you

Not just written and hoped to work — tested against a live local copy of your real `main.py`/`tenants.py`/`explain.py`, through the actual Cloudflare Workers runtime (`wrangler pages dev`, not a mock):

- `/api/health` and `/api/predict` — proxied correctly, real responses (including a real `0.9997` fraud-probability prediction)
- A disallowed path (`/api/compliance/verify`) — correctly rejected with 403 before reaching the real API
- A disallowed tenant ID — correctly rejected with 403
- `/api/tenants/public_demo/reference` and `/drift/report` — correct responses, `explanation` field present at every step
- The 4-week drift sequence — calibrated against real API responses (not guessed) to produce an actual OK → WARNING → WARNING → CRITICAL progression, not an instant jump to the end
- `/api/tenants/demo_tenant_alpha/*` and `/demo_tenant_beta/*` — full isolation sequence confirmed: Alpha correctly showed CRITICAL with 1 alert, Beta correctly showed HEALTHY with 0 alerts, after being driven through the identical code path seconds apart

One thing to know: because this is genuinely live, the exact week each alert fires in Act 2 can vary slightly between runs — that's real model output responding to freshly-generated random data each time, not a bug. Practicing the sequence once before a meeting is worth doing, same as you'd rehearse anything live.
