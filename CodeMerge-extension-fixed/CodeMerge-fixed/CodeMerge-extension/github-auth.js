// ─── CodeMerge GitHub OAuth v3.1 ─────────────────────────────────────────────
// Uses chrome.identity.launchWebAuthFlow — NO token ever typed by user.
// Uses GitHub OAuth Device Flow (only client_id needed, which is public).
//
// SETUP INSTRUCTIONS (one-time, done by the developer = you):
//   1. Go to https://github.com/settings/developers → "OAuth Apps" → "New OAuth App"
//   2. Application name: CodeMerge
//   3. Homepage URL: https://github.com/YOUR_USERNAME/codemerge (your repo)
//   4. Authorization callback URL:
//        https://<EXTENSION_ID>.chromiumapp.org/oauth2
//      (find your extension ID in chrome://extensions after loading unpacked)
//   5. Click Register. Copy the Client ID (it's public — safe to embed here).
//   6. Replace GITHUB_CLIENT_ID below with your actual client ID.
//   NO client secret is needed — we use the Authorization Code + PKCE flow.

// ─── CodeMerge GitHub OAuth v3.1 ─────────────────────────────────────────────
// Uses chrome.identity.launchWebAuthFlow — NO token ever typed by user.
// Uses GitHub OAuth Device Flow (only client_id needed, which is public).
//
// SETUP INSTRUCTIONS (one-time, done by the developer = you):
//   1. Go to https://github.com/settings/developers → "OAuth Apps" → "New OAuth App"
//   2. Application name: CodeMerge
//   3. Homepage URL: https://github.com/YOUR_USERNAME/codemerge (your repo)
//   4. Authorization callback URL:
//        https://<EXTENSION_ID>.chromiumapp.org/oauth2
//      (find your extension ID in chrome://extensions after loading unpacked)
//   5. Click Register. Copy the Client ID (it's public — safe to embed here).
//   6. Replace GITHUB_CLIENT_ID below with your actual client ID.
//   NO client secret is needed — we use the Authorization Code + PKCE flow.

const GITHUB_CLIENT_ID = "Ov23liswMu8SwMZv66Kv";

// Scopes needed: repo (to commit files)
const GITHUB_SCOPES = "repo";

// ── Launch OAuth flow ─────────────────────────────────────────────────────────
// Returns { token, username, avatarUrl } on success.
// Throws on cancel or error.
async function githubLogin() {
  // Build the redirect URI Chrome will intercept
  const redirectUri = chrome.identity.getRedirectURL("oauth2");

  // PKCE: generate code verifier + challenge
  const verifier  = generateVerifier();
  const challenge = await generateChallenge(verifier);

  // Store verifier for later exchange
  await new Promise(res => chrome.storage.session.set({ pkce_verifier: verifier }, res));

  const authUrl =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${GITHUB_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(GITHUB_SCOPES)}` +
    `&state=${generateVerifier(16)}` +
    `&code_challenge=${challenge}` +
    `&code_challenge_method=S256`;

  // Chrome opens GitHub login in a popup — user logs in, authorizes, done.
  const responseUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      (url) => {
        if (chrome.runtime.lastError || !url) {
          reject(new Error(chrome.runtime.lastError?.message || "Auth cancelled"));
        } else {
          resolve(url);
        }
      }
    );
  });

  // Extract code from redirect URL
  const code = new URL(responseUrl).searchParams.get("code");
  if (!code) throw new Error("No authorization code returned from GitHub");

  // Exchange code for token via a CORS-friendly proxy
  const storedVerifier = await new Promise(res =>
    chrome.storage.session.get("pkce_verifier", d => res(d.pkce_verifier))
  );

  const tokenResp = await fetch("https://silent-glade-1458.janvijaiswal99.workers.dev/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      redirect_uri: redirectUri,
      code_verifier: storedVerifier,
      client_id: GITHUB_CLIENT_ID
    })
  });

  if (!tokenResp.ok) throw new Error(`Token exchange failed: ${tokenResp.status}`);
  const { access_token } = await tokenResp.json();
  if (!access_token) throw new Error("No access token in response");

  // Fetch user info
  const userResp = await fetch("https://api.github.com/user", {
    headers: { "Authorization": `Bearer ${access_token}`, "Accept": "application/vnd.github.v3+json" }
  });
  const user = await userResp.json();

  return { token: access_token, username: user.login, avatarUrl: user.avatar_url, name: user.name };
}

// ── PKCE helpers ──────────────────────────────────────────────────────────────
function generateVerifier(len = 64) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "").slice(0, len);
}

async function generateChallenge(verifier) {
  const data    = new TextEncoder().encode(verifier);
  const digest  = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ── Revoke token (logout) ─────────────────────────────────────────────────────
async function githubLogout(token) {
  await new Promise(res => chrome.storage.local.remove(["githubToken", "githubUser", "githubRepo"], res));
}
