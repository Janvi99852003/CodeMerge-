// ─── CodeMerge Content Script v3 ─────────────────────────────────────────────
// 100% automatic detection — no manual triggers.
// Checks user's configured platform list before firing.

// ─── CodeMerge Content Script v3 ─────────────────────────────────────────────
// 100% automatic detection — no manual triggers.
// Checks user's configured platform list before firing.

(function () {
  "use strict";

  const HOST   = window.location.hostname;
  let detected = false;
  let lastUrl  = location.href;
  let selectedPlatforms = [];

  // Reset detection flag on SPA navigation
  setInterval(() => {
    if (location.href !== lastUrl) { lastUrl = location.href; detected = false; }
  }, 500);

  // Ask background for setup to confirm this platform is selected by user
  chrome.runtime.sendMessage({ type: "GET_SETUP" }, (setup) => {
    if (!setup || !setup.setupDone) return; // setup not done yet
    const activePlatforms = setup.platforms || [];
    selectedPlatforms = activePlatforms;

    if      (HOST.includes("leetcode.com")      && activePlatforms.includes("leetcode"))      setupLeetCode();
    else if (HOST.includes("codeforces.com")    && activePlatforms.includes("codeforces"))    setupCodeforces();
    else if (HOST.includes("github.com")        && activePlatforms.includes("github"))        setupGitHub();
    else if (HOST.includes("hackerrank.com")    && activePlatforms.includes("hackerrank"))    setupHackerRank();
    else if (HOST.includes("codechef.com")      && activePlatforms.includes("codechef"))      setupCodeChef();
    else if (HOST.includes("atcoder.jp")        && activePlatforms.includes("atcoder"))       setupAtCoder();
    else if (HOST.includes("geeksforgeeks.org") && activePlatforms.includes("geeksforgeeks")) setupGFG();
  });

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data || {};
    if (data.source !== "CodeMergeInjectedDetector" || data.type !== "PROBLEM_SOLVED_PAGE") return;
    if (selectedPlatforms.length && !selectedPlatforms.includes(data.platform)) return;
    sendSolve(data.platform, data.problemTitle, data.url || location.href);
  });

  // ── LeetCode ─────────────────────────────────────────────────────────────────
  // Detection is handled entirely by injected-detector.js via fetch/XHR interception
  // (MAIN world). The DOM MutationObserver has been intentionally removed here to
  // prevent double-firing: both paths were calling sendSolve() for the same submission,
  // causing the streak and today's count to increment twice.
  function setupLeetCode() {
    // No-op: injected-detector.js fires PROBLEM_SOLVED_PAGE via window.postMessage,
    // which is picked up by the message listener above. No DOM observer needed.
  }

  function getProblemTitle() {
    const match = location.pathname.match(/\/problems\/([^/]+)/);
    if (match) return match[1].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    return document.title.split(" - ")[0].trim() || "LeetCode Problem";
  }

  // ── Codeforces ───────────────────────────────────────────────────────────────
  function setupCodeforces() {
    const obs = new MutationObserver(checkCodeforces);
    obs.observe(document.body, { childList: true, subtree: true });
    checkCodeforces();
  }
  function checkCodeforces() {
    if (detected) return;
    const accepted = document.querySelector(".verdict-accepted");
    if (accepted) {
      const title = document.querySelector(".problem-statement .title")?.textContent?.trim()
                 || getProblemTitleFromCF();
      sendSolve("codeforces", title, location.href);
      return;
    }
    if (location.href.includes("/my") || location.href.includes("status")) {
      const firstVerdictCell = document.querySelector(
        "table.status-frame-datatable tr:nth-child(2) td.status-verdict-cell, " +
        "#pageContent table tbody tr:first-child .verdict-accepted"
      );
      if (firstVerdictCell && firstVerdictCell.textContent.trim().toLowerCase() === "accepted") {
        const link = document.querySelector("table.status-frame-datatable tr:nth-child(2) td a[href*='problem']");
        sendSolve("codeforces", link?.textContent?.trim() || "Codeforces Problem", location.href);
      }
    }
  }
  function getProblemTitleFromCF() {
    const m = location.pathname.match(/\/problem\/([A-Z0-9]+)/i);
    return m ? `Problem ${m[1]}` : "Codeforces Problem";
  }

  // ── GitHub ───────────────────────────────────────────────────────────────────
  // Only fires when user pushes code (views a commit they just made)
  function setupGitHub() {
    const obs = new MutationObserver(checkGitHub);
    obs.observe(document.body, { childList: true, subtree: true });
    checkGitHub();
  }
  function checkGitHub() {
    if (detected) return;
    const path = location.pathname;
    if (/^\/[^/]+\/[^/]+\/commit\/[0-9a-f]{7,40}$/.test(path)) {
      const msg  = document.querySelector(".commit-title, [class*='commit-message']")?.textContent?.trim();
      const repo = document.querySelector('[itemprop="name"]')?.textContent?.trim() || "GitHub Repo";
      sendSolve("github", msg || `Commit to ${repo}`, location.href);
      return;
    }
    if (/^\/[^/]+\/[^/]+\/pull\/\d+$/.test(path)) {
      const merged = document.querySelector(".State--merged, [data-view-component][class*='merged']");
      if (merged) {
        const title = document.querySelector(".js-issue-title")?.textContent?.trim();
        sendSolve("github", title || "PR Merged", location.href);
      }
    }
  }

  // ── HackerRank ────────────────────────────────────────────────────────────────
  function setupHackerRank() {
    const obs = new MutationObserver(checkHackerRank);
    obs.observe(document.body, { childList: true, subtree: true });
    checkHackerRank();
  }
  function checkHackerRank() {
    if (detected) return;
    const banner = document.querySelector(
      ".submission-result-header--accepted, [class*='submissionResult'][class*='accepted']"
    );
    if (banner) {
      const title = document.querySelector("h1.challenge-heading, .challenge-name")?.textContent?.trim();
      sendSolve("hackerrank", title || "HackerRank Problem", location.href);
      return;
    }
    const obtained = parseInt(document.querySelector(".score_bar .score_obtained")?.textContent, 10);
    const total    = parseInt(document.querySelector(".score_bar .score_total")?.textContent, 10);
    if (obtained > 0 && !isNaN(total) && obtained === total) {
      const title = document.querySelector("h1.challenge-heading")?.textContent?.trim();
      sendSolve("hackerrank", title || "HackerRank Problem", location.href);
    }
  }

  // ── CodeChef ─────────────────────────────────────────────────────────────────
  function setupCodeChef() {
    const obs = new MutationObserver(checkCodeChef);
    obs.observe(document.body, { childList: true, subtree: true });
    checkCodeChef();
  }
  function checkCodeChef() {
    if (detected) return;
    const verdict = document.querySelector("[class*='verdict-ac'], [class*='CorrectAlert'], [class*='correctAlert']");
    if (verdict) {
      const title = document.querySelector("h1")?.textContent?.trim();
      sendSolve("codechef", title || "CodeChef Problem", location.href);
      return;
    }
    const cell = document.querySelector("table tbody tr:first-child td.verdict, #statusTable tbody tr:first-child .verdict-accepted");
    if (cell) {
      const t = cell.textContent.trim().toUpperCase();
      if (t === "AC" || t === "ACCEPTED") {
        sendSolve("codechef", document.querySelector("h1")?.textContent?.trim() || "CodeChef Problem", location.href);
      }
    }
  }

  // ── AtCoder ──────────────────────────────────────────────────────────────────
  function setupAtCoder() {
    const obs = new MutationObserver(checkAtCoder);
    obs.observe(document.body, { childList: true, subtree: true });
    checkAtCoder();
  }
  function checkAtCoder() {
    if (detected) return;
    const verdict = document.querySelector(".label-success");
    if (verdict && verdict.textContent.trim() === "AC") {
      const title = document.querySelector("title")?.textContent?.split(" - ")[0]?.trim();
      sendSolve("atcoder", title || "AtCoder Problem", location.href);
    }
  }

  // ── GeeksForGeeks ─────────────────────────────────────────────────────────────
  function setupGFG() {
    const obs = new MutationObserver(checkGFG);
    obs.observe(document.body, { childList: true, subtree: true });
    checkGFG();
  }
  function checkGFG() {
    if (detected) return;
    const success = document.querySelector(
      "[class*='problems_success'], [class*='solved'], [class*='successModal']"
    );
    if (success && success.textContent.toLowerCase().match(/solved|correct|accepted/)) {
      const title = document.querySelector("title")?.textContent?.split("|")[0]?.trim();
      sendSolve("geeksforgeeks", title || "GFG Problem", location.href);
    }
  }

  // ── Send Solve to Background ──────────────────────────────────────────────────
  function sendSolve(platform, title, url) {
    if (detected) return;
    detected = true;
    try {
      chrome.runtime.sendMessage(
        { type: "PROBLEM_SOLVED", platform, problemTitle: title, url },
        (resp) => {
          if (chrome.runtime.lastError) {
            console.warn("[CodeMerge]", chrome.runtime.lastError.message);
            detected = false;
          } else if (resp?.skipped) {
            console.log("[CodeMerge] Skipped:", resp.skipped);
            if (resp.skipped !== "duplicate") detected = false;
          } else {
            console.log(`[CodeMerge] ✅ Auto-detected: ${platform} — "${title}" | streak: ${resp?.streak || "?"}`);
          }
        }
      );
    } catch (err) {
      console.warn("[CodeMerge] sendMessage failed:", err.message);
      detected = false;
    }
  }
})();