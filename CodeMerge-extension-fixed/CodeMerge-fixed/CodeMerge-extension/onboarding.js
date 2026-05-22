// ─── CodeMerge Onboarding JS v3.3 ────────────────────────────────────────────

const PLATFORMS_CONFIG = [
  { id: "leetcode",       name: "LeetCode",      emoji: "🟡", placeholder: "https://leetcode.com/u/yourname/" },
  { id: "codeforces",     name: "Codeforces",    emoji: "🔵", placeholder: "https://codeforces.com/profile/yourname" },
  { id: "hackerrank",     name: "HackerRank",    emoji: "🟢", placeholder: "https://www.hackerrank.com/yourname" },
  { id: "codechef",       name: "CodeChef",      emoji: "🟠", placeholder: "https://www.codechef.com/users/yourname" },
  { id: "atcoder",        name: "AtCoder",       emoji: "⚪", placeholder: "https://atcoder.jp/users/yourname" },
  { id: "geeksforgeeks",  name: "GeeksForGeeks", emoji: "🍃", placeholder: "https://www.geeksforgeeks.org/user/yourname/" },
  { id: "github",         name: "GitHub",        emoji: "🟣", placeholder: "https://github.com/yourname" }
];

let currentStep       = 0;
let selectedPlatforms = [];
let githubConnected   = false;

// ── Build platform grid ───────────────────────────────────────────────────────
(function buildPlatformGrid() {
  const grid = document.getElementById("platformGrid");
  PLATFORMS_CONFIG.forEach(p => {
    const card = document.createElement("div");
    card.className = "platform-card";
    card.dataset.id = p.id;
    card.innerHTML = `
      <div class="platform-card-top">
        <span class="emoji">${p.emoji}</span>
        <span class="pname">${p.name}</span>
        <span class="check-badge">✓</span>
      </div>
      <div class="purl-wrap">
        <div class="purl-label">Your profile URL</div>
        <input class="purl-input" data-platform="${p.id}" placeholder="${p.placeholder}" type="url" />
      </div>
    `;
    card.addEventListener("click", (e) => {
      if (e.target.tagName === "INPUT") return;
      card.classList.toggle("selected");
      if (card.classList.contains("selected")) {
        if (!selectedPlatforms.includes(p.id)) selectedPlatforms.push(p.id);
        setTimeout(() => card.querySelector("input").focus(), 60);
      } else {
        selectedPlatforms = selectedPlatforms.filter(x => x !== p.id);
      }
    });
    card.querySelector("input").addEventListener("click", e => e.stopPropagation());
    grid.appendChild(card);
  });
})();

// ── On load: fetch redirect URL from background to show setup guide ───────────
chrome.runtime.sendMessage({ type: "GET_REDIRECT_URL" }, (info) => {
  if (!info) return;

  // Always show the callback URL so developer can verify their OAuth App setup
  const callbackEl = document.getElementById("callbackUrl");
  const extIdEl    = document.getElementById("extensionId");
  if (callbackEl) callbackEl.textContent = info.redirectUrl;
  if (extIdEl)    extIdEl.textContent    = info.extensionId;

  // If client ID not yet set, show the setup guide instead of the login button
  if (!info.clientIdSet) {
    document.getElementById("setupNeededBanner").style.display = "block";
    document.getElementById("githubLoginBtn").style.display    = "none";
  }
});

// ── Restore saved setup ───────────────────────────────────────────────────────
chrome.runtime.sendMessage({ type: "GET_SETUP" }, (data) => {
  if (!data) return;
  if (data.githubRepo) document.getElementById("githubRepo").value = data.githubRepo;
  if (data.platforms?.length) {
    data.platforms.forEach(pid => {
      const card = document.querySelector(`.platform-card[data-id="${pid}"]`);
      if (card) {
        card.classList.add("selected");
        if (!selectedPlatforms.includes(pid)) selectedPlatforms.push(pid);
        const input = card.querySelector(".purl-input");
        if (input && data.platformUrls?.[pid]) input.value = data.platformUrls[pid];
      }
    });
  }
  if (data.githubUser) showGithubConnected(data.githubUser);
});

// ── Step nav ──────────────────────────────────────────────────────────────────
function goTo(step) {
  document.getElementById(`step${currentStep}`).classList.remove("active");
  document.getElementById(`dot${currentStep}`).classList.remove("active");
  document.getElementById(`dot${currentStep}`).classList.add("done");
  currentStep = step;
  document.getElementById(`step${step}`).classList.add("active");
  document.getElementById(`dot${step}`).classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function goBack(to) {
  document.getElementById(`step${currentStep}`).classList.remove("active");
  document.getElementById(`dot${currentStep}`).classList.remove("active", "done");
  currentStep = to;
  document.getElementById(`step${to}`).classList.add("active");
  document.getElementById(`dot${to}`).classList.add("active");
  document.getElementById(`dot${to}`).classList.remove("done");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── Step 0 → 1 ────────────────────────────────────────────────────────────────
document.getElementById("next0").addEventListener("click", () => {
  selectedPlatforms = [...document.querySelectorAll(".platform-card.selected")].map(c => c.dataset.id);
  if (selectedPlatforms.length === 0) {
    alert("Please select at least one coding platform first.");
    return;
  }
  const summary = document.getElementById("selectedPlatformsSummary");
  summary.innerHTML = selectedPlatforms.map(pid => {
    const p = PLATFORMS_CONFIG.find(x => x.id === pid);
    return p ? `<span class="platform-tag">${p.emoji} ${p.name}</span>` : "";
  }).join("");
  goTo(1);
});

// ── Copy callback URL ─────────────────────────────────────────────────────────
document.getElementById("copyCallbackBtn").addEventListener("click", () => {
  const url = document.getElementById("callbackUrl").textContent;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.getElementById("copyCallbackBtn");
    btn.textContent = "Copied!";
    setTimeout(() => btn.textContent = "Copy", 2000);
  });
});

// ── GitHub OAuth Login ────────────────────────────────────────────────────────
document.getElementById("githubLoginBtn").addEventListener("click", async () => {
  const btn = document.getElementById("githubLoginBtn");
  btn.textContent = "Opening GitHub…";
  btn.disabled = true;

  const errEl = document.getElementById("authErrorMsg");
  errEl.style.display = "none";

  try {
    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "GITHUB_OAUTH_LOGIN" }, (res) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else if (res?.error === "SETUP_REQUIRED") reject(new Error("SETUP_REQUIRED"));
        else if (res?.error) reject(new Error(res.error));
        else resolve(res);
      });
    });

    await new Promise(resolve =>
      chrome.runtime.sendMessage({ type: "SAVE_GITHUB_AUTH", data: result }, resolve)
    );

    showGithubConnected(result);

  } catch (err) {
    if (err.message === "SETUP_REQUIRED") {
      document.getElementById("setupNeededBanner").style.display = "block";
      document.getElementById("githubLoginBtn").style.display    = "none";
    } else {
      errEl.textContent    = "⚠ " + err.message;
      errEl.style.display  = "block";
    }
    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg> Try Again`;
    btn.disabled = false;
  }
});

function showGithubConnected(user) {
  githubConnected = true;
  document.getElementById("githubConnectBox").style.display = "none";
  const state = document.getElementById("githubConnectedState");
  state.style.display = "block";
  if (user.avatarUrl) document.getElementById("ghAvatar").src = user.avatarUrl;
  document.getElementById("ghUsername").textContent = `@${user.username}`;
  document.getElementById("next1").disabled = false;
}

document.getElementById("ghDisconnectBtn").addEventListener("click", async () => {
  await new Promise(resolve => chrome.runtime.sendMessage({ type: "GITHUB_LOGOUT" }, resolve));
  githubConnected = false;
  document.getElementById("githubConnectBox").style.display = "block";
  document.getElementById("githubConnectedState").style.display = "none";
  document.getElementById("authErrorMsg").style.display = "none";
  const btn = document.getElementById("githubLoginBtn");
  btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg> Continue with GitHub`;
  btn.disabled = false;
  btn.style.display = "inline-flex";
  document.getElementById("next1").disabled = true;
});

// ── Step 1 → 2 ────────────────────────────────────────────────────────────────
document.getElementById("next1").addEventListener("click", async () => {
  if (!githubConnected) { alert("Please connect your GitHub account first."); return; }
  const repo = document.getElementById("githubRepo").value.trim();
  if (!repo) { alert("Please enter the GitHub repo URL for your coding logs."); return; }
  if (!repo.includes("github.com")) {
    alert("Please enter a valid GitHub repo URL (e.g. https://github.com/yourname/my-coding-journey)");
    return;
  }

  selectedPlatforms = [...document.querySelectorAll(".platform-card.selected")].map(c => c.dataset.id);
  const platformUrls = {};
  selectedPlatforms.forEach(pid => {
    const input = document.querySelector(`.purl-input[data-platform="${pid}"]`);
    const val = input?.value?.trim();
    if (val) platformUrls[pid] = val;
  });

  await new Promise(resolve => chrome.runtime.sendMessage({
    type: "SAVE_SETUP",
    data: { githubRepo: repo, platformUrls, platforms: selectedPlatforms }
  }, resolve));

  const pfNames = selectedPlatforms.map(pid => {
    const p = PLATFORMS_CONFIG.find(x => x.id === pid);
    return p ? `${p.emoji} ${p.name}` : pid;
  }).join(", ");
  document.getElementById("platformsSummaryText").textContent = pfNames;
  document.getElementById("repoSummaryText").textContent = repo.replace("https://github.com/", "");
  goTo(2);
});

document.getElementById("back1").addEventListener("click", () => goBack(0));
document.getElementById("finishBtn").addEventListener("click", () => window.close());
