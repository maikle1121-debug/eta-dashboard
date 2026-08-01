// ═══════════════════════════════════════════════════════════════════
// MYA PDF - MYA | Admin Dashboard (Web Panel - Supabase Backend)
// Copyright (c) 2024-2026 MYA. All rights reserved.
// Proprietary and confidential. Unauthorized reproduction prohibited.
// ═══════════════════════════════════════════════════════════════════

const SUPABASE_URL    = "https://qtjgrzqyzdjnkzjhlnaa.supabase.co";
const SUPABASE_KEY    = "sb_publishable_xQcMrCMwwggfAKggkxfYxQ_Ty0DbgRK";
const SB_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": "Bearer " + SUPABASE_KEY,
    "Content-Type": "application/json"
};
const STORAGE_KEY     = "eta_auth_token";
const ADMIN_PW_KEY    = "eta_admin_pw";

let activeBackend = "supabase"; // GitHub Pages: talk directly to Supabase
let adminPassword  = null;

// ─── HELPERS ────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }

function getAuthToken() {
    return localStorage.getItem(STORAGE_KEY);
}

function setAuthToken(token) {
    if (token) {
        localStorage.setItem(STORAGE_KEY, token);
    } else {
        localStorage.removeItem(STORAGE_KEY);
    }
}

function getAdminPassword() {
    return adminPassword || localStorage.getItem(ADMIN_PW_KEY) || "";
}

function setAdminPassword(pw) {
    if (pw) {
        localStorage.setItem(ADMIN_PW_KEY, pw);
    } else {
        localStorage.removeItem(ADMIN_PW_KEY);
    }
}

// ─── SHA-256 PASSWORD HASHING ──────────────────────────────────
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─── SUPABASE ADAPTER ──────────────────────────────────────────

async function sbGet(path) {
    const res = await fetch(`${SUPABASE_URL}${path}`, { headers: { ...SB_HEADERS, "Prefer": "return=representation" } });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 401) throw new Error("Unauthorized");
        throw new Error(err.error || `Supabase error: ${res.status}`);
    }
    return await res.json();
}

async function sbPost(path, body) {
    const res = await fetch(`${SUPABASE_URL}${path}`, {
        method: "POST",
        headers: { ...SB_HEADERS, "Prefer": "return=representation" },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 401) throw new Error("Unauthorized");
        throw new Error(err.error || `Supabase error: ${res.status}`);
    }
    return await res.json();
}

async function sbPatch(path, body) {
    const res = await fetch(`${SUPABASE_URL}${path}`, {
        method: "PATCH",
        headers: { ...SB_HEADERS, "Prefer": "return=representation" },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 401) throw new Error("Unauthorized");
        throw new Error(err.error || `Supabase error: ${res.status}`);
    }
    return await res.json();
}

async function sbDelete(path) {
    const res = await fetch(`${SUPABASE_URL}${path}`, {
        method: "DELETE",
        headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 401) throw new Error("Unauthorized");
        throw new Error(err.error || `Supabase error: ${res.status}`);
    }
    return true;
}

async function sbRpc(fn, params = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: { ...SB_HEADERS },
        body: JSON.stringify(params)
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 401) throw new Error("Unauthorized");
        throw new Error(err.error || `RPC ${fn} error: ${res.status}`);
    }
    return await res.json();
}

function parseUrlPath(url) {
    const match = url.match(/^(\/api\/[a-z\-]+)(\/.*)?$/i);
    if (match) return match[1];
    return url;
}

function getUrlTail(url) {
    const path = parseUrlPath(url);
    return url.substring(path.length);
}

// ─── DUAL-BACKEND API FETCH ──────────────────────────────────

async function apiFetch(url, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const body = options.body ? JSON.parse(options.body) : null;
    const token = getAuthToken();
    const path = parseUrlPath(url);

    return await supabaseApiCall(path, method, body, url, token);
}

async function supabaseApiCall(path, method, body, fullUrl, token) {
    const adminPw = getAdminPassword();

    if (path === "/api/login" && method === "POST") {
        const data = await sbRpc("admin_login", { p_password: body.password });
        if (data && data.ok) {
            return { success: true, token: body.password };
        }
        throw new Error("كلمة المرور خاطئة");
    }

    if (path === "/api/logout") {
        return { success: true };
    }

    if (method === "GET") {
        if (path === "/api/subscribers") {
            let sbSubs = await sbGet("/rest/v1/subscribers?order=created_at.desc").catch(e => { console.error("SB Subs Error:", e); return []; });
            let gasSubs = [];
            try {
                const gasUrl = "https://script.google.com/macros/s/AKfycbyYrlowGEjGJrOj_9RHHjFmA44vmCsZeIF427eaFUUqZsxSDEoyNxbHyaeI1QPVBqcaSQ/exec?action=get_all_subscribers";
                const res = await fetch(gasUrl);
                if (res.ok) {
                    const data = await res.json();
                    gasSubs = Array.isArray(data) ? data.map(s => ({
                        email: s.email || s['البريد الإلكتروني'] || s.Email,
                        name: s.name || s['الاسم'] || s.Name || "جوجل شيت",
                        start_date: s.start_date || s.startDate || s['تاريخ البداية'],
                        end_date: s.end_date || s.endDate || s['تاريخ النهاية'],
                        status: s.status || s['الحالة'] || 'active',
                        linked_emails: [],
                        notes: (s.notes || s['ملاحظات'] || "") + " [جوجل شيت]",
                        created_at: s.created_at || new Date().toISOString()
                    })).filter(s => s.email) : [];
                }
            } catch(e) { console.error("GAS Subs Error:", e); }
            return [...sbSubs, ...gasSubs];
        }
        if (path === "/api/active-devices") {
            return await sbGet("/rest/v1/active_devices?order=last_seen.desc");
        }
        if (path === "/api/settings") {
            const rows = await sbGet("/rest/v1/settings?id=eq.1&select=mode,maintenance_mode,notice_message,version,version_notes,blocked_emails,subscribers_version");
            if (rows && rows.length > 0) {
                const s = rows[0];
                return {
                    mode: s.mode || "free",
                    maintenanceMode: !!s.maintenance_mode,
                    noticeMessage: s.notice_message || "",
                    version: s.version || "",
                    versionNotes: s.version_notes || "",
                    blockedEmails: s.blocked_emails || [],
                    subscribersVersion: String(s.subscribers_version || 1)
                };
            }
            return { mode: "free" };
        }
    }

    if (method === "POST") {
        if (path === "/api/subscribers") {
            const sub = body;
            if (!sub || !sub.email) throw new Error("بيانات المشترك غير كاملة");
            const linkedEmails = Array.isArray(sub.linkedEmails) ? sub.linkedEmails : [];
            const data = await sbRpc("admin_upsert_subscriber", {
                p_email: sub.email.toLowerCase().trim(),
                p_name: sub.name || "",
                p_start_date: sub.startDate || "",
                p_end_date: sub.endDate || "unlimited",
                p_status: sub.status || "active",
                p_linked_emails: linkedEmails,
                p_notes: sub.notes || "",
                p_password: adminPw
            });
            if (!data.ok) throw new Error(data.error || "خطأ أثناء حفظ البيانات");
            return { success: true };
        }
        if (path === "/api/settings/config") {
            const update = { p_password: adminPw };
            if (body.maintenanceMode !== undefined) update.p_maintenance_mode = !!body.maintenanceMode;
            if (body.noticeMessage !== undefined) update.p_notice_message = body.noticeMessage;
            if (body.version !== undefined) update.p_version = body.version;
            if (body.versionNotes !== undefined) update.p_version_notes = body.versionNotes;
            const data = await sbRpc("admin_update_settings", update);
            if (!data.ok) throw new Error(data.error || "خطأ أثناء حفظ الإعدادات");
            return { success: true };
        }
        if (path === "/api/settings/mode") {
            if (body.mode !== "free" && body.mode !== "paid") throw new Error("Invalid mode");
            const data = await sbRpc("admin_update_settings", { p_mode: body.mode, p_password: adminPw });
            if (!data.ok) throw new Error(data.error || "خطأ أثناء تحديث الوضع");
            return { success: true, mode: body.mode };
        }
        if (path === "/api/settings/change-password") {
            if (!body.newPassword || body.newPassword.length < 4) throw new Error("كلمة المرور يجب أن تكون 4 أحرف على الأقل");
            const data = await sbRpc("admin_change_password", {
                p_new_password: body.newPassword,
                p_password: adminPw
            });
            if (!data.ok) throw new Error(data.error || "خطأ أثناء تغيير كلمة المرور");
            return { success: true };
        }
        if (path === "/api/settings/import") {
            if (!Array.isArray(body.subscribers)) throw new Error("Data must be array");
            const data = await sbRpc("admin_import_subscribers", {
                p_data: body.subscribers,
                p_password: adminPw
            });
            if (!data.ok) throw new Error(data.error || "خطأ أثناء استيراد البيانات");
            return { success: true, count: data.count || body.subscribers.length };
        }
    }

    if (method === "DELETE") {
        if (path === "/api/active-devices") {
            const tail = getUrlTail(fullUrl);
            if (tail) {
                const email = decodeURIComponent(tail.substring(1));
                const data = await sbRpc("admin_delete_device", { p_email: email, p_password: adminPw });
                if (!data.ok) throw new Error(data.error || "خطأ أثناء حذف جهاز");
                return { success: true };
            }
            const data = await sbRpc("admin_clear_devices", { p_password: adminPw });
            if (!data.ok) throw new Error(data.error || "خطأ أثناء مسح الأجهزة");
            return { success: true };
        }
        if (path === "/api/subscribers") {
            const tail = getUrlTail(fullUrl);
            if (tail) {
                const email = decodeURIComponent(tail.substring(1));
                const data = await sbRpc("admin_delete_subscriber", { p_email: email, p_password: adminPw });
                if (!data.ok) throw new Error(data.error || "خطأ أثناء حذف المشترك");
                return { success: true };
            }
        }
    }

    throw new Error(`Unsupported call: ${method} ${path}`);
}

async function localApiCall(url, options, token) {
    throw new Error("Local backend disabled - dashboard uses Supabase directly");
}

function showToast(msg, type = "ok") {
    const t = $("toast");
    t.textContent = msg;
    t.style.background = type === "ok" ? "#1f2937" : "#3a1a1a";
    t.style.color = type === "ok" ? "#e6edf3" : "#f85149";
    t.classList.remove("hidden");
    setTimeout(() => t.classList.add("hidden"), 3000);
}

function fmtDate(iso) {
    if (!iso) return "—";
    if (iso === "unlimited") return "غير محدود ♾️";
    const d = new Date(iso);
    return d.toLocaleDateString("ar-EG", { year:"numeric", month:"short", day:"numeric" });
}

function calcEndDate(startIso, durationDays) {
    if (durationDays === "unlimited") return "unlimited";
    const d = new Date(startIso);
    d.setDate(d.getDate() + parseInt(durationDays));
    return d.toISOString().split("T")[0];
}

function isExpired(endDate) {
    if (!endDate || endDate === "unlimited") return false;
    return new Date(endDate) < new Date();
}

function expiresInDays(endDate) {
    if (!endDate || endDate === "unlimited") return 9999;
    return Math.ceil((new Date(endDate) - new Date()) / 86400000);
}

function getBadge(user) {
    if (user.status === "inactive") return '<span class="badge badge-inactive">موقوف ❌</span>';
    if (isExpired(user.endDate))    return '<span class="badge badge-inactive">منتهي ⏰</span>';
    if (expiresInDays(user.endDate) <= 7) return '<span class="badge badge-expiring">قريب الانتهاء ⚠️</span>';
    return '<span class="badge badge-active">نشط ✅</span>';
}

function isEffectivelyActive(user) {
    return user.status === "active" && !isExpired(user.endDate);
}

// ─── AUTH & UI STATES ─────────────────────────────────────────
function checkAuth() {
    const adminPw = getAdminPassword();
    if (adminPw) {
        showDashboard();
    } else {
        showLogin();
    }
}

function showLogin() {
    $("loginScreen").classList.remove("hidden");
    $("mainDashboard").classList.add("hidden");
    $("loginPassword").value = "";
    $("loginPassword").focus();
}

async function showDashboard() {
    $("loginScreen").classList.add("hidden");
    $("mainDashboard").classList.remove("hidden");
    
    try {
        await loadStats();
        await updateModeUI();
    } catch (err) {
        // Handled by apiFetch redirection if unauthorized
    }
}

// ─── NAVIGATION ─────────────────────────────────────────────
function navigateTo(page) {
    document.querySelectorAll(".page").forEach(p => { p.classList.remove("active"); p.classList.add("hidden"); });
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    const target = $("page-" + page);
    if (target) { target.classList.remove("hidden"); target.classList.add("active"); }
    const navItem = document.querySelector(`[data-page="${page}"]`);
    if (navItem) navItem.classList.add("active");
    const titles = { overview: "الإحصائيات", users: "المشتركين", add: "إضافة مشترك", devices: "الأجهزة النشطة", "today-users": "مستخدمو اليوم الجدد", settings: "الإعدادات" };
    $("pageTitle").textContent = titles[page] || page;
    
    if (page === "overview") loadStats();
    if (page === "users")    loadUsersTable();
    if (page === "add")      resetAddForm();
    if (page === "devices")  loadDevices();
    if (page === "today-users") loadTodayDevices();
    if (page === "settings") updateModeUI();
}

// ─── STATS PAGE ──────────────────────────────────────────────
async function loadStats() {
    const list = await apiFetch("/api/subscribers");
    const active   = list.filter(isEffectivelyActive).length;
    const inactive = list.length - active;
    const expiring = list.filter(u => isEffectivelyActive(u) && expiresInDays(u.endDate) <= 7).length;
    
    $("stat-total").textContent    = list.length;
    $("stat-active").textContent   = active;
    $("stat-inactive").textContent = inactive;
    $("stat-expiring").textContent = expiring;
    
    // Device-based usage stats
    try {
        const devices = await apiFetch("/api/active-devices");
        if (Array.isArray(devices)) {
            const now = Date.now();
            const DAY_MS = 86400000;
            
            const usingNow = devices.filter(d => d.lastSeen && (now - new Date(d.lastSeen).getTime()) < DAY_MS).length;
            const dormant  = devices.filter(d => d.lastSeen && (now - new Date(d.lastSeen).getTime()) >= 7 * DAY_MS).length;
            const totalChecks = devices.reduce((sum, d) => sum + (d.checkCount || 1), 0);
            
            const deviceEmails = new Set(devices.map(d => d.email));
            const neverUsed = list.filter(u => isEffectivelyActive(u) && !deviceEmails.has(u.email)).length;
            
            $("stat-using-now").textContent   = usingNow;
            $("stat-never-used").textContent   = neverUsed;
            $("stat-dormant").textContent      = dormant;
            $("stat-total-checks").textContent = totalChecks;
        }
    } catch (e) {
        console.log("[Dashboard] Device stats skipped:", e.message);
    }
    
    // Recent 5 subscribers
    const recent = [...list].reverse().slice(0, 5);
    const tbody = $("recentBody");
    if (!recent.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty-row">لا يوجد مشتركين بعد</td></tr>';
    } else {
        tbody.innerHTML = recent.map(u => `
            <tr>
                <td dir="ltr">${u.email}</td>
                <td>${getBadge(u)}</td>
                <td>${fmtDate(u.endDate)}</td>
            </tr>`).join("");
    }
}

// ─── USERS PAGE ──────────────────────────────────────────────
async function loadUsersTable(filter = "") {
    let list = await apiFetch("/api/subscribers");
    if (filter) {
        const query = filter.toLowerCase().trim();
        list = list.filter(u => 
            u.email.toLowerCase().includes(query) || 
            (u.name || "").toLowerCase().includes(query) ||
            (Array.isArray(u.linkedEmails) && u.linkedEmails.some(le => le.toLowerCase().includes(query)))
        );
    }
    
    const tbody = $("usersBody");
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-row">لا يوجد مشتركين مطابقين للبحث</td></tr>';
        return;
    }
    
    tbody.innerHTML = list.map((u, i) => {
        const active = isEffectivelyActive(u);
        const safeEmail = u.email.replace(/'/g, "&apos;");
        
        // Show linked emails count if any
        let emailHtml = `<span class="primary-email">${u.email}</span>`;
        if (Array.isArray(u.linkedEmails) && u.linkedEmails.length > 0) {
            emailHtml += `<br/><span class="linked-badge" title="${u.linkedEmails.join(', ')}">🔗 +${u.linkedEmails.length} شركات مرتبطة</span>`;
        }

        return `<tr>
            <td>${i + 1}</td>
            <td dir="ltr">${emailHtml}</td>
            <td>${u.name || "—"}</td>
            <td>${fmtDate(u.startDate)}</td>
            <td>${fmtDate(u.endDate)}</td>
            <td>${getBadge(u)}</td>
            <td>
                <button class="action-btn" data-action="edit" data-email="${safeEmail}">✏️ تعديل</button>
                <button class="action-btn ${active ? "danger" : "success"}" data-action="toggle" data-email="${safeEmail}">
                    ${active ? "❌ إيقاف" : "✅ تفعيل"}
                </button>
                <button class="action-btn danger" data-action="delete" data-email="${safeEmail}">🗑️ حذف</button>
            </td>
        </tr>`;
    }).join("");
}

// ─── ADD & EDIT SUBSCRIBER FORM ────────────────────────────────
function fmtDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("ar-EG", { year:"numeric", month:"short", day:"numeric" }) + " " +
           d.toLocaleTimeString("ar-EG", { hour:"2-digit", minute:"2-digit" });
}

function timeAgo(iso) {
    if (!iso) return "—";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "الآن";
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    return `منذ ${days} يوم`;
}

// ─── DEVICES PAGE ──────────────────────────────────────────────
async function loadDevices() {
    try {
        const devices = await apiFetch("/api/active-devices");
        const tbody = $("devicesBody");
        if (!devices || !Array.isArray(devices) || !devices.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-row">لا توجد سجلات استخدام حالياً</td></tr>';
            return;
        }
        
        tbody.innerHTML = devices.map((d, i) => {
            const safeEmail = d.email.replace(/'/g, "&apos;");
            return `<tr>
                <td>${i + 1}</td>
                <td dir="ltr">${d.email}</td>
                <td dir="ltr"><code>${d.ip || "—"}</code></td>
                <td>${d.checkCount || 1}</td>
                <td>${fmtDateTime(d.firstSeen)}</td>
                <td title="${fmtDateTime(d.lastSeen)}">${timeAgo(d.lastSeen)}</td>
                <td>
                    <button class="action-btn danger" data-action="delete-device" data-email="${safeEmail}">🗑️ حذف</button>
                </td>
            </tr>`;
        }).join("");
    } catch (err) {
        showToast("خطأ أثناء تحميل بيانات الأجهزة", "err");
    }
}

async function loadTodayDevices() {
    try {
        let devices = await apiFetch("/api/active-devices");
        const tbody = $("todayDevicesContainer");
        if (!devices || !Array.isArray(devices) || !devices.length) {
            tbody.innerHTML = '<div class="empty-row" style="text-align:center; padding: 30px; color: var(--text-muted);">لا توجد سجلات لليوم</div>';
            return;
        }
        
        // Filter for TODAY's first seen devices
        const today = new Date().toDateString();
        const todayDevices = devices.filter(d => d.firstSeen && new Date(d.firstSeen).toDateString() === today);
        
        if (!todayDevices.length) {
            tbody.innerHTML = '<div class="empty-row" style="text-align:center; padding: 30px; color: var(--text-muted);">لم يتم تسجيل أي مستخدم جديد اليوم</div>';
            return;
        }
        
        tbody.innerHTML = todayDevices.map((d, i) => {
            const safeEmail = d.email.replace(/'/g, "&apos;");
            return `
            <div class="device-card">
                <div class="device-card-header">
                    <div class="device-browser-email">
                        <span class="field-icon">📧</span>
                        <span class="field-value" dir="ltr">${safeEmail}</span>
                    </div>
                    <div class="device-status-badge badge-active">✨ جديد اليوم</div>
                </div>
                <div class="device-card-divider"></div>
                <div class="device-card-body" style="font-size: 13px; color: var(--text-dim);">
                    <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
                        <span>تاريخ الانضمام: ${fmtDateTime(d.firstSeen)}</span>
                        <span dir="ltr">IP: ${d.ip || "—"}</span>
                    </div>
                </div>
            </div>`;
        }).join("");
    } catch (err) {
        showToast("خطأ أثناء تحميل بيانات الأجهزة لليوم", "err");
    }
}

async function clearAllDevices() {
    try {
        await apiFetch("/api/active-devices", { method: 'DELETE' });
        showToast("تم مسح جميع سجلات الاستخدام 🗑️");
        loadDevices();
    } catch (err) {
        showToast("فشل مسح البيانات", "err");
    }
}

async function deleteDevice(email) {
    try {
        await apiFetch(`/api/active-devices/${encodeURIComponent(email)}`, { method: 'DELETE' });
        showToast("تم حذف سجل الاستخدام 🗑️");
        loadDevices();
    } catch (err) {
        showToast(err.message, "err");
    }
}

// ─── TEST DEVICE CONNECTION ────────────────────────────────────
async function testDeviceConnection() {
    showToast("جاري اختبار الاتصال بـ Supabase...", "ok");
    try {
        const testEmail = "dashboard-test@" + new Date().toISOString().split("T")[0].replace(/-/g, "") + ".test";
        const testIp = "127.0.0.1";
        console.log("[Dashboard] Testing Supabase connection with:", { testEmail, testIp });

        const result = await sbPost("/rest/v1/rpc/check_subscription", { p_email: testEmail });
        console.log("[Dashboard] Supabase test result:", result);

        if (result.error) {
            showToast("Supabase رد بخطأ: " + result.error, "err");
            return;
        }

        showToast("الاتصال بـ Supabase يعمل! جاري تحميل الأجهزة...", "ok");
        activeBackend = "supabase";
        await loadDevices();
    } catch (err) {
        console.error("[Dashboard] Worker test failed:", err);
        showToast("فشل الاتصال بـ Worker: " + err.message, "err");
    }
}

// ─── ADD & EDIT SUBSCRIBER FORM ────────────────────────────────
function resetAddForm() {
    $("formTitle").textContent = "إضافة مشترك جديد";
    $("editingEmail").value = "";
    $("userEmail").value = "";
    $("userEmail").disabled = false;
    $("userName").value = "";
    $("userNotes").value = "";
    $("userStatus").value = "active";
    $("duration").value = "365";
    $("customDateGroup").style.display = "none";
    $("customEndDate").value = "";
    $("startDate").value = new Date().toISOString().split("T")[0];
    $("cancelEditBtn").classList.add("hidden");
    $("formError").classList.add("hidden");
    
    // Clear Linked Emails list
    $("linkedEmailsList").innerHTML = "";
}

function addLinkedEmailRow(value = "") {
    const list = $("linkedEmailsList");
    const row = document.createElement("div");
    row.className = "linked-row";
    row.innerHTML = `
        <input type="email" placeholder="example@linked-company.com" class="linked-email-input" value="${value}" dir="ltr">
        <button type="button" class="btn-remove-linked">🗑️</button>
    `;
    
    row.querySelector(".btn-remove-linked").addEventListener("click", () => {
        row.remove();
    });
    
    list.appendChild(row);
    row.querySelector("input").focus();
}

async function editUser(email) {
    try {
        const list = await apiFetch("/api/subscribers");
        const u = list.find(x => x.email === email);
        if (!u) return;
        
        navigateTo("add");
        $("formTitle").textContent = "تعديل بيانات المشترك";
        $("editingEmail").value = email;
        $("userEmail").value = u.email;
        $("userEmail").disabled = true; // Email is the identifier, cannot be modified
        $("userName").value = u.name || "";
        $("userNotes").value = u.notes || "";
        $("userStatus").value = u.status;
        $("startDate").value = u.startDate || new Date().toISOString().split("T")[0];
        
        if (u.endDate === "unlimited") {
            $("duration").value = "unlimited";
            $("customDateGroup").style.display = "none";
        } else {
            $("duration").value = "custom";
            $("customDateGroup").style.display = "block";
            $("customEndDate").value = u.endDate || "";
        }
        
        // Populate linked emails
        $("linkedEmailsList").innerHTML = "";
        if (Array.isArray(u.linkedEmails)) {
            u.linkedEmails.forEach(email => addLinkedEmailRow(email));
        }

        $("cancelEditBtn").classList.remove("hidden");
    } catch (err) {
        showToast("خطأ أثناء تحميل بيانات المشترك", "err");
    }
}

async function saveUser() {
    const editingEmail = $("editingEmail").value.trim();
    const email  = $("userEmail").value.trim().toLowerCase();
    const name   = $("userName").value.trim();
    const notes  = $("userNotes").value.trim();
    const status = $("userStatus").value;
    const start  = $("startDate").value || new Date().toISOString().split("T")[0];
    const dur    = $("duration").value;

    if (!email) { showError("formError", "يرجى إدخال الإيميل"); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { showError("formError", "الإيميل غير صحيح"); return; }

    let endDate;
    if (dur === "unlimited") { 
        endDate = "unlimited"; 
    } else if (dur === "custom") {
        endDate = $("customEndDate").value;
        if (!endDate) { showError("formError", "يرجى تحديد تاريخ الانتهاء"); return; }
    } else {
        endDate = calcEndDate(start, dur);
    }

    // Gather Linked Emails
    const linkedInputs = document.querySelectorAll(".linked-email-input");
    const linkedEmails = [];
    linkedInputs.forEach(input => {
        const val = input.value.trim().toLowerCase();
        if (val && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val)) {
            linkedEmails.push(val);
        }
    });

    try {
        await apiFetch("/api/subscribers", {
            method: 'POST',
            body: JSON.stringify({
                email,
                name,
                notes,
                status,
                startDate: start,
                endDate,
                linkedEmails
            })
        });

        showToast(editingEmail ? "تم تعديل بيانات المشترك ✅" : "تم إضافة المشترك بنجاح ✅");
        resetAddForm();
        navigateTo("users");
    } catch (err) {
        showError("formError", err.message);
    }
}

function showError(id, msg) {
    const el = $(id);
    el.textContent = msg;
    el.classList.remove("hidden");
}

async function toggleUser(email) {
    try {
        const list = await apiFetch("/api/subscribers");
        const u = list.find(x => x.email === email);
        if (!u) return;

        const wasActive = isEffectivelyActive(u);
        u.status = wasActive ? "inactive" : "active";

        await apiFetch("/api/subscribers", {
            method: 'POST',
            body: JSON.stringify(u)
        });

        showToast(wasActive ? "تم إيقاف الاشتراك ❌" : "تم تفعيل الاشتراك ✅", wasActive ? "err" : "ok");
        loadUsersTable($("searchInput")?.value || "");
        loadStats();
    } catch (err) {
        showToast("فشل تعديل حالة المشترك", "err");
    }
}

let pendingDeleteEmail = null;
function deleteUser(email) {
    pendingDeleteEmail = email;
    $("confirmTitle").textContent = "حذف المشترك";
    $("confirmText").textContent = `هل تريد حذف ${email} نهائياً؟`;
    $("confirmModal").classList.remove("hidden");
}

async function confirmDelete() {
    if (!pendingDeleteEmail) return;
    try {
        await apiFetch(`/api/subscribers/${encodeURIComponent(pendingDeleteEmail)}`, {
            method: 'DELETE'
        });
        pendingDeleteEmail = null;
        $("confirmModal").classList.add("hidden");
        showToast("تم حذف المشترك 🗑️");
        loadUsersTable();
        loadStats();
    } catch (err) {
        showToast(err.message, "err");
    }
}

// ─── SETTINGS PAGE ────────────────────────────────────────────
async function updateModeUI() {
    try {
        const settings = await apiFetch("/api/settings");
        const isPaid = settings.mode === "paid";
        
        const card   = document.getElementById("modeCard");
        const toggle = document.getElementById("modeToggle");
        const icon   = document.getElementById("modeIcon");
        const title  = document.getElementById("modeTitle");
        const desc   = document.getElementById("modeDesc");
        const badge  = document.getElementById("systemStatus");
        
        if (!card) return;
        
        if (isPaid) {
            card.classList.add("paid-mode");
            toggle.checked  = true;
            icon.textContent  = "🔒";
            title.textContent = "الوضع الحالي: اشتراك مفعّل";
            desc.textContent  = "الإضافة تعمل فقط للمشتركين المسجلين لديك";
        } else {
            card.classList.remove("paid-mode");
            toggle.checked  = false;
            icon.textContent  = "🆓";
            title.textContent = "الوضع الحالي: مجاني للجميع";
            desc.textContent  = "الإضافة متاحة لكل المستخدمين بدون قيود";
        }
        
        if (badge) {
            badge.className = "status-badge " + (isPaid ? "paid-badge" : "free-badge");
            badge.textContent = isPaid ? "🔒 وضع الاشتراك" : "🆓 وضع مجاني";
        }

        // Populate Config Fields
        if ($("noticeMessage")) $("noticeMessage").value = settings.noticeMessage || "";
        if ($("maintenanceMode")) $("maintenanceMode").checked = !!settings.maintenanceMode;
    } catch (err) {
        // Handled
    }
}

async function saveConfig() {
    const noticeMessage = $("noticeMessage").value.trim();
    const maintenanceMode = $("maintenanceMode").checked;

    try {
        await apiFetch("/api/settings/config", {
            method: 'POST',
            body: JSON.stringify({ noticeMessage, maintenanceMode })
        });
        showToast("تم حفظ إعدادات الإضافة بنجاح ✅");
    } catch (err) {
        showToast(err.message, "err");
    }
}

async function toggleMode() {
    const isPaid = $("modeToggle").checked;
    try {
        await apiFetch("/api/settings/mode", {
            method: 'POST',
            body: JSON.stringify({ mode: isPaid ? "paid" : "free" })
        });
        await updateModeUI();
        showToast(isPaid ? "🔒 تم تفعيل وضع الاشتراك — سيشتغل فقط للمشتركين" : "🆓 تم تفعيل الوضع المجاني — متاح للجميع");
    } catch (err) {
        $("modeToggle").checked = !isPaid; // Revert checkbox
        showToast("فشل تعديل وضع النظام", "err");
    }
}

async function changePassword() {
    const np = $("newPassword").value;
    const cp = $("confirmPassword").value;
    const msg = $("settingsMsg");
    msg.className = "hidden";
    
    if (!np) { msg.textContent = "أدخل كلمة المرور الجديدة"; msg.className = "error-msg"; return; }
    if (np !== cp) { msg.textContent = "كلمتا المرور غير متطابقتين"; msg.className = "error-msg"; return; }
    
    try {
        await apiFetch("/api/settings/change-password", {
            method: 'POST',
            body: JSON.stringify({ newPassword: np })
        });
        msg.textContent = "تم تغيير كلمة المرور بنجاح ✅";
        msg.className = "success-msg";
        setAdminPassword(np);
        adminPassword = np;
        $("newPassword").value = "";
        $("confirmPassword").value = "";
    } catch (err) {
        msg.textContent = err.message;
        msg.className = "error-msg";
    }
}

async function exportData() {
    try {
        const list = await apiFetch("/api/subscribers");
        const blob = new Blob([JSON.stringify(list, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "eta_subscribers_" + new Date().toISOString().split("T")[0] + ".json";
        a.click();
        showToast("تم تصدير البيانات 📤");
    } catch (err) {
        showToast("فشل تصدير البيانات", "err");
    }
}

function importData() { $("importFile").click(); }

async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!Array.isArray(data)) { showToast("ملف غير صحيح", "err"); return; }
        
        await apiFetch("/api/settings/import", {
            method: 'POST',
            body: JSON.stringify({ subscribers: data })
        });

        showToast("تم استيراد " + data.length + " مشترك ✅");
        loadStats();
    } catch (err) {
        showToast("خطأ في قراءة أو رفع الملف", "err");
    }
    e.target.value = "";
}

// ─── INITIALIZATION ───────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    checkAuth();

    // Login Submission
    $("loginBtn").addEventListener("click", async () => {
        const pw = $("loginPassword").value;
        try {
            const data = await apiFetch("/api/login", {
                method: 'POST',
                body: JSON.stringify({ password: pw })
            });
            setAuthToken(data.token || pw);
            setAdminPassword(pw);
            adminPassword = pw;
            $("loginError").classList.add("hidden");
            showDashboard();
        } catch (err) {
            $("loginError").textContent = err.message;
            $("loginError").classList.remove("hidden");
        }
    });
    
    $("loginPassword").addEventListener("keydown", e => { if (e.key === "Enter") $("loginBtn").click(); });

    // Logout
    $("logoutBtn").addEventListener("click", async () => {
        try {
            await apiFetch("/api/logout", { method: 'POST' });
        } catch(e) {}
        setAuthToken(null);
        setAdminPassword(null);
        adminPassword = null;
        activeBackend = null;
        showLogin();
    });

    // Navigation Menu
    document.querySelectorAll(".nav-item").forEach(item => {
        item.addEventListener("click", e => { e.preventDefault(); navigateTo(item.dataset.page); });
    });

    // Delegated actions for users list table
    document.getElementById("usersBody").addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;
        const action = btn.dataset.action;
        const email  = btn.dataset.email;
        if (!email) return;
        
        if      (action === "edit")   editUser(email);
        else if (action === "toggle") toggleUser(email);
        else if (action === "delete") deleteUser(email);
    });

    // Add User Form
    $("saveUserBtn").addEventListener("click", saveUser);
    $("cancelEditBtn").addEventListener("click", () => { resetAddForm(); navigateTo("users"); });

    // Duration Select Box Change Listener
    $("duration").addEventListener("change", () => {
        $("customDateGroup").style.display = $("duration").value === "custom" ? "block" : "none";
    });

    // Add Linked Email Row Button Click Listener
    $("addLinkedBtn").addEventListener("click", () => addLinkedEmailRow(""));

    // User Table Search Filter Input
    $("searchInput").addEventListener("input", e => loadUsersTable(e.target.value));

    // Settings Panel Event Listeners
    $("changePasswordBtn").addEventListener("click", changePassword);
    $("saveConfigBtn").addEventListener("click", saveConfig);
    $("exportBtn").addEventListener("click", exportData);
    $("importBtn").addEventListener("click", importData);
    $("importFile").addEventListener("change", handleImport);

    // Mode Toggle Event Listener
    $("modeToggle").addEventListener("change", toggleMode);

    // Devices Page Event Listeners
    $("refreshDevicesBtn").addEventListener("click", loadDevices);
    $("testDeviceBtn").addEventListener("click", testDeviceConnection);
    $("clearDevicesBtn").addEventListener("click", async () => {
        if (confirm("هل أنت متأكد من مسح جميع سجلات الاستخدام؟")) {
            await clearAllDevices();
        }
    });
    $("devicesBody").addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;
        if (btn.dataset.action === "delete-device" && btn.dataset.email) {
            await deleteDevice(btn.dataset.email);
        }
    });

    // Delete Confirmation Modal Actions
    $("confirmYes").addEventListener("click", confirmDelete);
    $("confirmNo").addEventListener("click", () => {
        $("confirmModal").classList.add("hidden");
        pendingDeleteEmail = null;
    });
});
