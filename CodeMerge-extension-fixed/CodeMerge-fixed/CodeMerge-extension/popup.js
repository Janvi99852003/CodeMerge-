// ─── CodeMerge Popup JS v3 ────────────────────────────────────────────────────
// Streak is displayed only — it's 100% auto-calculated from solve history.
// No manual +/- controls exist.

const PLATFORMS = {
  leetcode:      { name: "LeetCode",      color: "#FFA116", emoji: "🟡" },
  codeforces:    { name: "Codeforces",    color: "#1F8ACB", emoji: "🔵" },
  github:        { name: "GitHub",        color: "#a855f7", emoji: "🟣" },
  hackerrank:    { name: "HackerRank",    color: "#00EA64", emoji: "🟢" },
  codechef:      { name: "CodeChef",      color: "#e97451", emoji: "🟠" },
  atcoder:       { name: "AtCoder",       color: "#8b8b8b", emoji: "⚪" },
  geeksforgeeks: { name: "GeeksForGeeks", color: "#2F8D46", emoji: "🍃" }
};

document.addEventListener("DOMContentLoaded", async () => {
  const stats = await getStats();

  if (!stats.setupDone) {
    document.getElementById("setupPrompt").style.display = "block";
    document.getElementById("openSetupBtn").addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
    });
    return;
  }

  document.getElementById("mainView").style.display = "block";
  renderHero(stats);
  renderHeatmap(stats.activity);
  renderPlatforms(stats.totals);
  renderToday(stats.todaySolves);
  renderFooter(stats);
  setupTabs();
  setupControls();
});

function getStats() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: "GET_STATS" }, res =>
      resolve(res || { streak:0, longestStreak:0, totals:{}, activity:[], todaySolves:[], setupDone:false })
    );
  });
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function renderHero(stats) {
  const el = document.getElementById("streakNumber");
  animateCount(el, stats.streak || 0, 700);
  document.getElementById("longestStreak").textContent = stats.longestStreak || 0;
  document.getElementById("totalSolves").textContent   = stats.totals?.all   || 0;
  document.getElementById("todayCount").textContent    = (stats.todaySolves || []).length;

  // Streak badge label — clearly marked as auto
  const badge = document.getElementById("streakBadge");
  if (badge) {
    const s = stats.streak || 0;
    badge.textContent = s === 0 ? "Start solving to begin your streak!" :
                        s >= 30 ? "🔥 On fire!" :
                        s >= 7  ? "⚡ Great momentum!" :
                                  "🌱 Keep it up!";
  }

  const s = stats.streak || 0;
  let grad = "linear-gradient(135deg,#555,#888)";
  if (s >= 30) grad = "linear-gradient(135deg,#ef4444,#f97316)";
  else if (s >= 7)  grad = "linear-gradient(135deg,#f97316,#facc15)";
  else if (s > 0)   grad = "linear-gradient(135deg,#fff,#f97316)";
  el.style.background           = grad;
  el.style.webkitBackgroundClip = "text";
  el.style.webkitTextFillColor  = "transparent";
}

function animateCount(el, target, ms) {
  const start = performance.now();
  function tick(now) {
    const p = Math.min((now - start) / ms, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick); else el.textContent = target;
  }
  requestAnimationFrame(tick);
}

// ── Heatmap ───────────────────────────────────────────────────────────────────
function renderHeatmap(activity) {
  if (!activity?.length) return;
  const heatmap = document.getElementById("heatmap");
  const tooltip = document.getElementById("tooltip");
  const today   = new Date().toISOString().split("T")[0];
  const max     = Math.max(...activity.map(d => d.count), 1);

  heatmap.innerHTML = "";

  const firstDate = new Date(activity[0].date + "T00:00:00");
  const pad       = (firstDate.getDay() + 6) % 7;
  for (let i = 0; i < pad; i++) {
    const s = document.createElement("div");
    s.className = "heatmap-cell"; s.style.visibility = "hidden";
    heatmap.appendChild(s);
  }

  activity.forEach(day => {
    const cell = document.createElement("div");
    cell.className = "heatmap-cell " + level(day.count, max);
    if (day.date === today) cell.classList.add("today");

    cell.addEventListener("mouseenter", () => {
      const emojis = (day.platforms || []).map(p => PLATFORMS[p]?.emoji || "✅").join("");
      tooltip.textContent = day.count
        ? `${fmt(day.date)} · ${day.count} solve${day.count > 1 ? "s" : ""} ${emojis}`
        : `${fmt(day.date)} · no activity`;
      tooltip.classList.add("visible");
    });
    cell.addEventListener("mouseleave", () => tooltip.classList.remove("visible"));
    heatmap.appendChild(cell);
  });
}

function level(count, max) {
  if (!count) return "l0";
  const r = count / max;
  return r <= .25 ? "l1" : r <= .5 ? "l2" : r <= .75 ? "l3" : "l4";
}

function fmt(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month:"short", day:"numeric" });
}

// ── Platforms ─────────────────────────────────────────────────────────────────
function renderPlatforms(totals) {
  const list = document.getElementById("platformsList");
  const entries = Object.entries(totals || {}).filter(([k]) => k !== "all").sort(([,a],[,b]) => b-a);
  if (!entries.length) {
    list.innerHTML = `<div class="no-data">No activity yet — start solving! 🚀<br><small style="color:#555">Auto-detection is active and waiting.</small></div>`;
    return;
  }
  const mx = Math.max(...entries.map(([,v]) => v));
  list.innerHTML = "";
  entries.forEach(([p, count]) => {
    const info = PLATFORMS[p] || { name:p, emoji:"✅", color:"#f97316" };
    const pct  = Math.round(count / mx * 100);
    const item = document.createElement("div");
    item.className = "platform-item";
    item.innerHTML = `
      <div class="platform-emoji">${info.emoji}</div>
      <div class="platform-info">
        <div class="platform-name">${info.name}</div>
        <div class="platform-bar-wrap"><div class="platform-bar" style="width:0%;background:${info.color}" data-w="${pct}%"></div></div>
      </div>
      <div class="platform-count">${count}</div>
    `;
    list.appendChild(item);
  });
  requestAnimationFrame(() => document.querySelectorAll(".platform-bar").forEach(b => b.style.width = b.dataset.w));
}

// ── Today ─────────────────────────────────────────────────────────────────────
function renderToday(solves) {
  const list = document.getElementById("todayList");
  if (!solves?.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎯</div>
        <p>Nothing solved today yet.</p>
        <small style="color:#555;font-size:11px">Auto-detection is active — just solve a problem!</small>
      </div>`;
    return;
  }
  list.innerHTML = "";
  [...solves].reverse().forEach(s => {
    const info = PLATFORMS[s.platform] || { name: s.platform, emoji:"✅" };
    const time = new Date(s.time).toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" });
    const item = document.createElement("div");
    item.className = "solve-item";
    item.innerHTML = `
      <div class="solve-emoji">${info.emoji}</div>
      <div class="solve-info">
        <div class="solve-title">${esc(s.title)}</div>
        <div class="solve-platform">${info.name}</div>
      </div>
      <div class="solve-meta">
        <div class="solve-time">${time}</div>
        <div class="commit-tag">⚡ Auto-saved</div>
      </div>
    `;
    list.appendChild(item);
  });
}

// ── Footer ────────────────────────────────────────────────────────────────────
function renderFooter(stats) {
  const note = document.getElementById("footerNote");
  if (stats.githubRepo) {
    const short = stats.githubRepo.replace("https://github.com/", "");
    note.innerHTML = `⚡ Auto-committing to <a href="${stats.githubRepo}" target="_blank">${short}</a> · <span style="color:#444">streak is automatic</span>`;
  }
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
    });
  });
}

// ── Controls ──────────────────────────────────────────────────────────────────
function setupControls() {
  document.getElementById("settingsBtn")?.addEventListener("click", () =>
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") })
  );
  document.getElementById("clearBtn")?.addEventListener("click", () => {
    if (confirm("🗑️ Clear all CodeMerge data?\nThis will reset your streak history and cannot be undone.")) {
      chrome.runtime.sendMessage({ type: "CLEAR_DATA" }, () => window.location.reload());
    }
  });
}

function esc(str) { const d = document.createElement("div"); d.textContent = str; return d.innerHTML; }
