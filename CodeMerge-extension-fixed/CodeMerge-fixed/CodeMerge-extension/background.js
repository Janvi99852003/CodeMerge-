// ─── CodeMerge Background Service Worker v3.3 ────────────────────────────────
// GitHub auth uses chrome.identity.launchWebAuthFlow (standard extension OAuth).
// Setup: register one GitHub OAuth App, paste Client ID below — done forever.

// ── YOUR GITHUB OAUTH APP CLIENT ID ──────────────────────────────────────────
const GITHUB_CLIENT_ID = "Ov23liswMu8SwMZv66Kv";

const PLATFORMS = {
  leetcode:      { name: "LeetCode",      color: "#FFA116", emoji: "🟡" },
  codeforces:    { name: "Codeforces",    color: "#1F8ACB", emoji: "🔵" },
  github:        { name: "GitHub",        color: "#a855f7", emoji: "🟣" },
  hackerrank:    { name: "HackerRank",    color: "#00EA64", emoji: "🟢" },
  codechef:      { name: "CodeChef",      color: "#e97451", emoji: "🟠" },
  atcoder:       { name: "AtCoder",       color: "#8b8b8b", emoji: "⚪" },
  geeksforgeeks: { name: "GeeksForGeeks", color: "#2F8D46", emoji: "🍃" }
};

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    const data = await getStorage();
    if (!data.setupDone) {
      chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
    }
  }
  chrome.alarms.create("daily-reminder",  { when: getNextTime(20, 0), periodInMinutes: 1440 });
  chrome.alarms.create("midnight-recalc", { when: getNextTime(0, 1),  periodInMinutes: 1440 });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === "PROBLEM_SOLVED") {
    handleProblemSolved(message.platform, message.problemTitle, message.url)
      .then(r => sendResponse({ success: true, ...r }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (message.type === "GET_STATS") {
    getStats().then(sendResponse).catch(() => sendResponse({}));
    return true;
  }

  if (message.type === "SAVE_SETUP") {
    saveSetup(message.data).then(() => sendResponse({ success: true })).catch(() => sendResponse({ success: false }));
    return true;
  }

  if (message.type === "SAVE_GITHUB_AUTH") {
    const { token, username, avatarUrl, name } = message.data;
    setStorage({ githubToken: token, githubUser: { username, avatarUrl, name } })
      .then(() => sendResponse({ success: true }))
      .catch(() => sendResponse({ success: false }));
    return true;
  }

  if (message.type === "GITHUB_LOGOUT") {
    chrome.storage.local.remove(["githubToken", "githubUser"], () => sendResponse({ success: true }));
    return true;
  }

  if (message.type === "GET_SETUP") {
    getStorage().then(data => sendResponse({
      setupDone:    data.setupDone    || false,
      githubRepo:   data.githubRepo   || "",
      githubUser:   data.githubUser   || null,
      platformUrls: data.platformUrls || {},
      platforms:    data.platforms    || []
    })).catch(() => sendResponse({}));
    return true;
  }

  if (message.type === "CLEAR_DATA") {
    chrome.storage.local.clear(() => sendResponse({ success: true }));
    return true;
  }

  if (message.type === "GET_REDIRECT_URL") {
    const redirectUrl = chrome.identity.getRedirectURL("oauth2");
    const extensionId = chrome.runtime.id;
    sendResponse({ redirectUrl, extensionId, clientIdSet: GITHUB_CLIENT_ID !== "YOUR_GITHUB_CLIENT_ID" });
    return true;
  }

  if (message.type === "GITHUB_OAUTH_LOGIN") {
    runGitHubOAuth()
      .then(result => sendResponse(result))
      .catch(e => sendResponse({ error: e.message }));
    return true;
  }
});

async function runGitHubOAuth() {
  if (GITHUB_CLIENT_ID === "YOUR_GITHUB_CLIENT_ID") {
    throw new Error("SETUP_REQUIRED");
  }

  const redirectUri = chrome.identity.getRedirectURL("oauth2");

  const authUrl =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${GITHUB_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=repo` +
    `&state=${Math.random().toString(36).slice(2)}`;

  const responseUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (url) => {
      if (chrome.runtime.lastError || !url) {
        reject(new Error(chrome.runtime.lastError?.message || "Authentication was cancelled"));
      } else {
        resolve(url);
      }
    });
  });

  const code = new URL(responseUrl).searchParams.get("code");
  if (!code) throw new Error("No authorization code returned from GitHub");

  const tokenResp = await fetch("https://silent-glade-1458.janvijaiswal99.workers.dev", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, code, redirect_uri: redirectUri })
  });

  if (!tokenResp.ok) {
    throw new Error(`Token exchange failed (${tokenResp.status}).`);
  }

  const tokenData = await tokenResp.json();
  if (tokenData.error) {
    throw new Error(tokenData.error_description || tokenData.error);
  }
  const access_token = tokenData.access_token;
  if (!access_token) throw new Error("No access token returned.");

  const userResp = await fetch("https://api.github.com/user", {
    headers: { "Authorization": `Bearer ${access_token}`, "Accept": "application/vnd.github.v3+json" }
  });
  const user = await userResp.json();
  return { token: access_token, username: user.login, avatarUrl: user.avatar_url, name: user.name };
}

async function saveSetup(data) {
  await setStorage({
    setupDone:    true,
    githubRepo:   data.githubRepo,
    platformUrls: data.platformUrls || {},
    platforms:    data.platforms    || []
  });
}

async function handleProblemSolved(platform, problemTitle, url) {
  const config = await getStorage();
  if (!config.setupDone) return { skipped: "setup_not_done" };
  if (config.platforms?.length > 0 && !config.platforms.includes(platform)) {
    return { skipped: "platform_not_selected" };
  }

  const today = getTodayKey();
  const data  = config;
  if (!data.days) data.days = {};
  if (!data.days[today]) data.days[today] = { solves: [], platforms: [] };

  const isDuplicate = data.days[today].solves.some(s => s.url === url && s.platform === platform);
  if (isDuplicate) return { skipped: "duplicate" };

  const cleanTitle = (problemTitle || "Problem").replace(/\s+/g, " ").trim().slice(0, 80);
  const solveEntry = { platform, title: cleanTitle, url, time: Date.now() };

  data.days[today].solves.push(solveEntry);
  if (!data.days[today].platforms.includes(platform)) data.days[today].platforms.push(platform);

  if (!data.totals) data.totals = {};
  data.totals[platform] = (data.totals[platform] || 0) + 1;
  data.totals.all       = (data.totals.all       || 0) + 1;

  const streak       = calculateStreakFromHistory(data.days);
  data.streak        = streak;
  data.longestStreak = Math.max(data.longestStreak || 0, streak);
  data.lastSolveDate = today;

  await setStorage(data);

  let githubResult = { committed: false };
  if (config.githubRepo && config.githubToken) {
    githubResult = await commitSolveToGitHub(config.githubRepo, config.githubToken, solveEntry, streak);
  }

  const info      = PLATFORMS[platform] || { name: platform, emoji: "✅" };
  const commitMsg = githubResult.committed ? " · Committed to GitHub ✓" : "";
  chrome.notifications.create(`solve-${Date.now()}`, {
    type: "basic", iconUrl: "icons/icon128.png",
    title:   `${info.emoji} CodeMerge — ${streak} Day Streak! 🔥`,
    message: `"${cleanTitle}" saved${commitMsg}`
  });

  return { streak, committed: githubResult.committed };
}

async function commitSolveToGitHub(repoUrl, token, solve, streak) {
  try {
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) throw new Error("Invalid GitHub repo URL");
    const owner    = match[1];
    const repo     = match[2].replace(/\.git$/, "");
    const today    = getTodayKey();
    const filePath = `coding-log/${today}.md`;
    const apiBase  = `https://api.github.com/repos/${owner}/${repo}`;
    const headers  = {
      "Authorization": `Bearer ${token}`,
      "Content-Type":  "application/json",
      "Accept":        "application/vnd.github.v3+json"
    };

    let existingSha = null, existingContent = "";
    const getResp = await fetch(`${apiBase}/contents/${filePath}`, { headers });
    if (getResp.status === 200) {
      const existing  = await getResp.json();
      existingSha     = existing.sha;
      existingContent = decodeURIComponent(escape(atob(existing.content.replace(/\n/g, ""))));
    }

    const info    = PLATFORMS[solve.platform] || { name: solve.platform, emoji: "✅" };
    const timeStr = new Date(solve.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const newLine = `| ${timeStr} | ${info.emoji} ${info.name} | [${solve.title}](${solve.url}) |\n`;

    let fileContent;
    if (!existingContent) {
      fileContent =
        `# 📅 ${today} — Coding Log\n\n` +
        `> 🔥 Current Streak: **${streak} day${streak !== 1 ? "s" : ""}** *(auto-tracked by CodeMerge)*\n\n` +
        `| Time | Platform | Problem |\n|------|----------|----------|\n` + newLine;
    } else {
      const streakLine = `> 🔥 Current Streak: **${streak} day${streak !== 1 ? "s" : ""}** *(auto-tracked by CodeMerge)*`;
      const lines = existingContent.split("\n");
      const streakIndex = lines.findIndex(line => line.includes("Current Streak:"));
      if (streakIndex >= 0) lines[streakIndex] = streakLine;
      else lines.splice(1, 0, "", streakLine);
      fileContent = lines.join("\n").replace(/\n*$/, "\n") + newLine;
    }

    const putResp = await fetch(`${apiBase}/contents/${filePath}`, {
      method: "PUT", headers,
      body: JSON.stringify({
        message: `✅ [CodeMerge] Solved: "${solve.title}" on ${info.name} (streak: ${streak})`,
        content: btoa(unescape(encodeURIComponent(fileContent))),
        ...(existingSha ? { sha: existingSha } : {})
      })
    });

    if (!putResp.ok) {
      const err = await putResp.json();
      throw new Error(err.message || `GitHub API ${putResp.status}`);
    }
    return { committed: true };
  } catch (err) {
    console.error("[CodeMerge] GitHub commit failed:", err.message);
    return { committed: false, error: err.message };
  }
}

function calculateStreakFromHistory(days) {
  if (!days || Object.keys(days).length === 0) return 0;
  const todayKey    = getTodayKey();
  const todaySolved = !!(days[todayKey]?.solves?.length > 0);
  const cursor      = new Date();
  if (!todaySolved) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  for (let i = 0; i < 3650; i++) {
    const key = dateToKey(cursor);
    if (days[key]?.solves?.length > 0) { streak++; cursor.setDate(cursor.getDate() - 1); }
    else break;
  }
  return streak;
}

async function recalcStreakIntegrity() {
  const data = await getStorage();
  if (!data.setupDone || !data.days) return;
  const correct = calculateStreakFromHistory(data.days);
  if (data.streak !== correct) {
    data.streak = correct;
    data.longestStreak = Math.max(data.longestStreak || 0, correct);
    await setStorage(data);
  }
}

async function getStats() {
  const data   = await getStorage();
  const days   = data.days || {};
  const today  = getTodayKey();
  const streak = calculateStreakFromHistory(days);
  const activity = [];
  for (let i = 90; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = dateToKey(d);
    activity.push({ date: key, count: days[key]?.solves?.length || 0, platforms: days[key]?.platforms || [] });
  }
  return {
    streak,
    longestStreak: Math.max(data.longestStreak || 0, streak),
    totals:        data.totals       || {},
    activity,
    todaySolves:   days[today]?.solves || [],
    setupDone:     data.setupDone    || false,
    githubRepo:    data.githubRepo   || "",
    githubUser:    data.githubUser   || null
  };
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "midnight-recalc") { await recalcStreakIntegrity(); return; }
  if (alarm.name === "daily-reminder") {
    const data   = await getStorage();
    if (!data.setupDone) return;
    const streak = calculateStreakFromHistory(data.days || {});
    const solved = data.days?.[getTodayKey()]?.solves?.length > 0;
    if (!solved) {
      chrome.notifications.create(`remind-${Date.now()}`, {
        type: "basic", iconUrl: "icons/icon128.png",
        title:   streak > 0 ? `⚠️ Don't break your ${streak}-day streak!` : "💡 Code something today!",
        message: "Open a coding platform and solve a problem to keep going 🚀"
      });
    }
  }
});

function getTodayKey()   { return dateToKey(new Date()); }
function dateToKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function getNextTime(h, m) {
  const t = new Date(); t.setHours(h, m, 0, 0);
  if (t <= new Date()) t.setDate(t.getDate() + 1);
  return t.getTime();
}
function getStorage() {
  return new Promise((res, rej) => chrome.storage.local.get(null,
    d => chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res(d || {})));
}
function setStorage(data) {
  return new Promise((res, rej) => chrome.storage.local.set(data,
    () => chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res()));
}