const KEY_STORAGE = "eta_admin_key";
const API_BASE = "https://eta-dashboard-final.pages.dev"; // Cloudflare Pages (hosts /api functions)
const app = document.getElementById("app");
const loginGate = document.getElementById("login-gate");

function getKey() {
  return localStorage.getItem(KEY_STORAGE) || "";
}

async function api(path, options) {
  options = options || {};
  const headers = Object.assign(
    { "content-type": "application/json", "x-admin-key": getKey() },
    options.headers || {}
  );
  const url = /^https?:\/\//.test(path) ? path : `${API_BASE}${path}`;
  const res = await fetch(url, Object.assign({}, options, { headers }));
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // non-JSON response
  }
  if (res.status === 401 || res.status === 403) {
    const err = new Error("FORBIDDEN");
    err.isForbidden = true;
    showLogin();
    throw err;
  }
  return { status: res.status, data };
}

function showLogin() {
  loginGate.classList.remove("hidden");
  app.classList.add("hidden");
}

function hideLogin() {
  loginGate.classList.add("hidden");
  app.classList.remove("hidden");
}

async function tryLogin(key) {
  try {
    localStorage.setItem(KEY_STORAGE, key.trim());
    const res = await api("/api/stats");
    if (res.status === 200) {
      hideLogin();
      navigate();
      return true;
    }
    localStorage.removeItem(KEY_STORAGE);
    return false;
  } catch (e) {
    localStorage.removeItem(KEY_STORAGE);
    return false;
  }
}

document.getElementById("login-btn").addEventListener("click", async () => {
  const key = document.getElementById("login-key").value;
  const msg = document.getElementById("login-msg");
  const ok = await tryLogin(key);
  if (!ok) {
    msg.textContent = "مفتاح غير صحيح. حاول مرة أخرى.";
  } else {
    msg.textContent = "";
    document.getElementById("login-key").value = "";
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem(KEY_STORAGE);
  showLogin();
});

const TITLES = {
  stats: "الإحصائيات",
  devices: "جميع الأجهزة",
  today: "المسجلون اليوم",
  add: "إضافة مشترك",
  settings: "الإعدادات العامة",
};

function navigate() {
  const hash = (location.hash || "").replace(/^#\/?/, "").split("?")[0] || "stats";
  const content = document.getElementById("content");
  document.getElementById("page-title").textContent = TITLES[hash] || "";
  document.querySelectorAll("[data-nav]").forEach((a) => {
    a.classList.toggle("active", a.dataset.nav === hash);
  });
  const render = window.pages && window.pages[hash];
  if (!render) {
    location.hash = "#/stats";
    return;
  }
  content.innerHTML = '<div class="placeholder">جارٍ التحميل…</div>';
  render(content).catch((err) => {
    if (err && err.isForbidden) return;
    content.innerHTML = '<div class="error-box">حدث خطأ في التحميل.</div>';
  });
}

window.addEventListener("hashchange", navigate);

(async function init() {
  if (!getKey()) {
    showLogin();
    return;
  }
  const ok = await tryLogin(getKey());
  if (ok) navigate();
})();
