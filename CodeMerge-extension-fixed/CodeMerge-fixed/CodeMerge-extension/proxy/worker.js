// ─── CodeMerge OAuth Proxy — Cloudflare Worker ───────────────────────────────
// Deploy this to Cloudflare Workers (free tier).
// It acts as a CORS bridge for the GitHub token exchange endpoint.
// It does NOT log, store, or inspect tokens.
//
// Deploy steps:
//   1. Go to https://dash.cloudflare.com → Workers → Create Worker
//   2. Paste this code, click Deploy
//   3. Copy your worker URL (e.g. https://codemerge-oauth.yourname.workers.dev)
//   4. Paste it in github-auth.js where it says YOUR_WORKER

const GITHUB_CLIENT_ID     = "YOUR_GITHUB_CLIENT_ID";     // ← same as in github-auth.js
const GITHUB_CLIENT_SECRET = "YOUR_GITHUB_CLIENT_SECRET"; // ← from GitHub OAuth App settings
                                                           //   (stored here in the Worker, NOT in the extension)

export default {
  async fetch(request) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin":  "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    let body;
    try { body = await request.json(); }
    catch { return new Response("Invalid JSON", { status: 400 }); }

    const { code, redirect_uri, client_id } = body;

    // Validate client_id matches — reject requests from other apps
    if (client_id !== GITHUB_CLIENT_ID) {
      return new Response("Unauthorized client", { status: 403 });
    }

    // Forward to GitHub token endpoint with secret (never exposed to client)
    const ghResp = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        client_id:     GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri
      })
    });

    const data = await ghResp.json();

    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type":                 "application/json",
        "Access-Control-Allow-Origin":  "*"
      }
    });
  }
};
