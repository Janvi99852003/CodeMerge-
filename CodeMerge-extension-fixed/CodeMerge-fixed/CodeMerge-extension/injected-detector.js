(function () {
  "use strict";

  const SOURCE = "CodeMergeInjectedDetector";
  const HOST = window.location.hostname;
  let lastSignalAt = 0;

  function platformFromHost() {
    if (HOST.includes("leetcode.com")) return "leetcode";
    if (HOST.includes("codeforces.com")) return "codeforces";
    if (HOST.includes("hackerrank.com")) return "hackerrank";
    if (HOST.includes("codechef.com")) return "codechef";
    if (HOST.includes("atcoder.jp")) return "atcoder";
    if (HOST.includes("geeksforgeeks.org")) return "geeksforgeeks";
    if (HOST.includes("github.com")) return "github";
    return "";
  }

  const PLATFORM = platformFromHost();
  if (!PLATFORM) return;

  function postSolve(title, url) {
    const now = Date.now();
    if (now - lastSignalAt < 2500) return;
    lastSignalAt = now;
    window.postMessage({
      source: SOURCE,
      type: "PROBLEM_SOLVED_PAGE",
      platform: PLATFORM,
      problemTitle: cleanTitle(title || inferTitle()),
      url: url || location.href
    }, "*");
  }

  function cleanTitle(value) {
    return String(value || "Problem").replace(/\s+/g, " ").trim().slice(0, 100) || "Problem";
  }

  function inferTitle() {
    if (PLATFORM === "leetcode") {
      const match = location.pathname.match(/\/problems\/([^/]+)/);
      if (match) return titleFromSlug(match[1]);
    }
    if (PLATFORM === "codeforces") {
      return document.querySelector(".problem-statement .title")?.textContent || "Codeforces Problem";
    }
    if (PLATFORM === "hackerrank") {
      return document.querySelector("h1.challenge-heading, .challenge-name, h1")?.textContent || "HackerRank Problem";
    }
    if (PLATFORM === "codechef") {
      return document.querySelector("h1")?.textContent || "CodeChef Problem";
    }
    if (PLATFORM === "atcoder") {
      return document.querySelector("title")?.textContent?.split(" - ")[0] || "AtCoder Problem";
    }
    if (PLATFORM === "geeksforgeeks") {
      return document.querySelector("title")?.textContent?.split("|")[0] || "GFG Problem";
    }
    return document.title || "Problem";
  }

  function titleFromSlug(slug) {
    return slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }

  function urlFromArgs(args) {
    const target = args && args[0];
    if (typeof target === "string") return target;
    return target?.url || "";
  }

  function hasAcceptedSignal(payload) {
    if (!payload) return false;

    if (typeof payload === "string") {
      const text = payload.toLowerCase();
      return /\baccepted\b/.test(text) ||
        /\bverdict["'\s:]*ac\b/.test(text) ||
        /\bstatus[_\s-]*(msg|display)?["'\s:]*accepted\b/.test(text) ||
        /\b(correct answer|all test cases passed|successfully submitted)\b/.test(text);
    }

    const seen = new Set();
    const stack = [payload];
    while (stack.length) {
      const item = stack.pop();
      if (!item || seen.has(item)) continue;
      if (typeof item === "object") {
        seen.add(item);
        for (const [key, value] of Object.entries(item)) {
          const k = key.toLowerCase();
          if (typeof value === "string") {
            const v = value.toLowerCase();
            if ((k.includes("status") || k.includes("verdict") || k.includes("result") || k.includes("state")) &&
                (v === "accepted" || v === "ac" || v.includes("accepted"))) {
              return true;
            }
            if (/\baccepted\b|\ball test cases passed\b|\bcorrect answer\b/.test(v)) return true;
          } else if (typeof value === "number" && (k.includes("status") || k.includes("state")) && value === 10) {
            return true;
          } else if (value && typeof value === "object") {
            stack.push(value);
          }
        }
      }
    }

    return false;
  }

  function tryParse(text) {
    if (!text) return "";
    try { return JSON.parse(text); } catch (_) { return text; }
  }

  function shouldInspect(url) {
    const lower = String(url || location.href).toLowerCase();
    return lower.includes("submit") ||
      lower.includes("submission") ||
      lower.includes("check") ||
      lower.includes("judge") ||
      lower.includes("graphql") ||
      lower.includes("status") ||
      lower.includes("run-code");
  }

  function inspectResponse(url, response) {
    if (!shouldInspect(url)) return;
    response.clone().text().then(text => {
      const payload = tryParse(text);
      if (hasAcceptedSignal(payload)) postSolve(inferTitle(), location.href);
    }).catch(() => {});
  }

  if (window.fetch) {
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);
      try { inspectResponse(urlFromArgs(args), response); } catch (_) {}
      return response;
    };
  }

  if (window.XMLHttpRequest) {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this.__codemergeUrl = url;
      return originalOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function (...args) {
      this.addEventListener("load", function () {
        try {
          if (!shouldInspect(this.__codemergeUrl)) return;
          if (hasAcceptedSignal(tryParse(this.responseText))) postSolve(inferTitle(), location.href);
        } catch (_) {}
      });
      return originalSend.apply(this, args);
    };
  }
})();
