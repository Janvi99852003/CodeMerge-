# CodeMerge — Daily Coding Tracker

> A Chrome extension that automatically detects when you solve a coding problem and commits it to your GitHub repo — no copy-pasting, no manual logging.

## What it does

CodeMerge runs silently in the background while you code. The moment you solve a problem on LeetCode, Codeforces, GeeksForGeeks, or other platforms, it:

1. Detects the successful submission automatically
2. Logs the problem name, platform, difficulty, and timestamp
3. Commits the entry to your connected GitHub repository

Your GitHub contribution graph stays green without any extra effort.

## Supported Platforms

| Platform | Detection |
|---|---|
| LeetCode | ✅ |
| Codeforces | ✅ |
| GeeksForGeeks | ✅ |
| HackerRank | ✅ |
| CodeChef | ✅ |
| AtCoder | ✅ |

## Tech Stack

- **JavaScript** (Vanilla, no frameworks)
- **Chrome Extension Manifest V3**
- **GitHub OAuth 2.0** with PKCE flow
- **Cloudflare Workers** — serverless proxy for secure token exchange
- **Chrome Identity API** — zero-friction login, no tokens to copy/paste
- **Chrome Storage API** — local persistence

## Architecture

```
User solves problem
       │
       ▼
content.js detects submission
       │
       ▼
background.js processes & queues commit
       │
       ▼
github-auth.js exchanges OAuth code
       │  (PKCE flow via chrome.identity)
       ▼
Cloudflare Worker proxy
       │  (holds client secret securely, never in extension)
       ▼
GitHub API → commit to user's repo
```

The client secret is **never bundled in the extension**. It lives only in the Cloudflare Worker, which acts as a lightweight CORS-friendly proxy between the extension and GitHub's token endpoint.


## Setup (for developers)

### 1. Create a GitHub OAuth App
- Go to [GitHub → Settings → Developer Settings → OAuth Apps](https://github.com/settings/developers)
- New OAuth App:
  - **Authorization callback URL:** `https://<YOUR_EXTENSION_ID>.chromiumapp.org/oauth2`
- Copy your **Client ID** and generate a **Client Secret**

### 3. Deploy the Cloudflare Worker
- Go to [dash.cloudflare.com](https://dash.cloudflare.com) → Workers → Create Worker
- Paste the contents of `proxy/worker.js`
- Fill in your `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` at the top
- Deploy and copy your worker URL

### 4. Configure the extension
In `github-auth.js`, set:
```js
const GITHUB_CLIENT_ID = "your_client_id";
```
And update the worker fetch URL to your deployed worker.

### 5. Load in Chrome
- Go to `chrome://extensions`
- Enable **Developer mode**
- Click **Load unpacked** → select the extension folder

---

## Security

- Uses **PKCE (Proof Key for Code Exchange)** — industry standard for OAuth in public clients
- Client secret stored only in Cloudflare Worker, never in extension bundle
- Rate limiting on the proxy: 10 requests per IP per hour
- Only requests `repo` scope — minimum permissions needed

---

## Project Structure

```
CodeMerge-extension/
├── manifest.json          # Extension config (Manifest V3)
├── background.js          # Service worker — handles commits & alarms
├── content.js             # Injected into coding sites — detects solves
├── injected-detector.js   # Runs in page context for deeper detection
├── github-auth.js         # OAuth PKCE flow via chrome.identity
├── popup.html/js/css      # Extension popup UI
├── onboarding.html/js     # First-run setup flow
├── proxy/
│   └── worker.js          # Cloudflare Worker — OAuth token proxy
└── icons/
```

---

## Why I built this

I wanted my GitHub contribution graph to reflect my actual daily coding practice — not just project commits. Most trackers require manual input or only work for one platform. CodeMerge works across all major platforms automatically, with a secure OAuth flow I designed from scratch.



## License

MIT
