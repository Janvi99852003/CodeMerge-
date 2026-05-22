# 🔥 CodeMerge — Daily Coding Tracker

Auto-tracks your coding streak across LeetCode, Codeforces, HackerRank, CodeChef, AtCoder, GeeksForGeeks & GitHub. Every accepted solve auto-commits to your GitHub repo.

---

## ⚡ Quick Setup (one-time, ~2 minutes)

### Step 1 — Load the extension first
1. Open `chrome://extensions` → enable **Developer mode**
2. Click **Load unpacked** → select this folder
3. Note your **Extension ID** shown on the card (e.g. `abcdefghijklmnopqrstuvwxyz123456`)

### Step 2 — Register a GitHub OAuth App
1. Go to **[github.com/settings/developers](https://github.com/settings/developers)** → OAuth Apps → **New OAuth App**
2. Fill in:
   - **Application name:** CodeMerge
   - **Homepage URL:** `https://github.com` (anything)
   - **Authorization callback URL:**
     ```
     https://<YOUR_EXTENSION_ID>.chromiumapp.org/oauth2
     ```
     *(The exact URL is shown in the onboarding page — just copy it from there)*
3. Click **Register application** → copy your **Client ID**

### Step 3 — Paste Client ID
Open `background.js`, find line 12, replace:
```js
const GITHUB_CLIENT_ID = "YOUR_GITHUB_CLIENT_ID";
```
with your actual Client ID, e.g.:
```js
const GITHUB_CLIENT_ID = "Iv1.abc123def456";
```

### Step 4 — Reload & authorize
1. Go back to `chrome://extensions` → click the **reload** button on CodeMerge
2. Click the extension icon → the onboarding wizard opens
3. Click **Continue with GitHub** → GitHub login popup opens → authorize → done ✅

No proxy server. No Cloudflare Worker. No client secret in code.

---

## How it works

| Component | Role |
|-----------|------|
| `content.js` | Detects "Accepted" verdicts on each platform |
| `background.js` | Manages streak calculation, OAuth flow, GitHub commits |
| `chrome.identity` | Handles the OAuth popup securely (built into Chrome) |
| GitHub Contents API | Commits markdown logs to `coding-log/YYYY-MM-DD.md` |

## Tech Stack
Chrome Extension (Manifest V3) · GitHub OAuth (chrome.identity) · GitHub Contents API · Vanilla JS
