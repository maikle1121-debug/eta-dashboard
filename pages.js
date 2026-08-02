window.pages = {};

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ar-EG", { timeZone: "Africa/Cairo", dateStyle: "short", timeStyle: "short" });
}

function getParams() {
  return new URLSearchParams(location.hash.split("?")[1] || "");
}

window.pages.stats = async (content) => {
  const res = await api("/api/stats");
  if (res.status !== 200 || !res.data) throw new Error("bad stats");
  const s = res.data;
  const cards = [
    { c: "blue", label: "إجمالي المشتركين", value: s.totalSubscribers },
    { c: "teal", label: "مسجلون اليوم", value: s.todayRegistrations },
    { c: "green", label: "الأجهزة النشطة", value: s.activeDevices },
    { c: "purple", label: "إجمالي الأجهزة", value: s.totalDevices },
    { c: "red", label: "الأجهزة الملغاة", value: s.revokedDevices },
    { c: "orange", label: "أجهزة مسجلة اليوم", value: s.todayDevices },
  ];
  content.innerHTML =
    '<div class="cards">' +
    cards
      .map(
        (c) =>
          `<div class="card ${c.c}"><div class="card-value">${esc(c.value)}</div><div class="card-label">${esc(c.label)}</div></div>`
      )
      .join("") +
    "</div>";
};

function deviceTable(rows) {
  if (!rows || !rows.length) return `<div class="empty">لا توجد أجهزة.</div>`;
  return `<div class="table-wrap"><table>
    <thead><tr>
      <th>البريد</th><th>الجهاز</th><th>المعرف</th><th>الحالة</th><th>آخر ظهور</th><th>أول ظهور</th><th>فحوصات</th><th>طرد</th>
    </tr></thead>
    <tbody>
      ${rows
        .map(
          (r) => `<tr>
        <td>${esc(r.email)}</td>
        <td dir="ltr" style="text-align:right">${esc(r.user_agent || "—")}</td>
        <td dir="ltr" style="text-align:right">${esc(r.device_id || "")}</td>
        <td><span class="badge ${r.status === "active" ? "green" : "red"}">${r.status === "active" ? "نشط" : "ملغي"}</span></td>
        <td>${fmtDate(r.last_seen)}</td>
        <td>${fmtDate(r.first_seen)}</td>
        <td>${esc(r.check_count || 0)}</td>
        <td>${
          r.status === "active"
            ? `<button class="btn small danger" data-kick="${esc(r.id)}">طرد</button>`
            : `<span class="muted">—</span>`
        }</td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table></div>`;
}

function paginationControls(p, path, go) {
  if (!p || p.totalPages <= 1) return "";
  const nav = (dir) => (p.page + dir >= 1 && p.page + dir <= p.totalPages ? go(p.page + dir) : null);
  return `<div class="pagination">
    <button class="btn small" ${p.page <= 1 ? "disabled" : ""} onclick="pages.${path}.page=${p.page - 1};pages.${path}.reload()">السابق</button>
    <span>صفحة ${p.page} من ${p.totalPages} — ${p.total} عنصر</span>
    <button class="btn small" ${p.page >= p.totalPages ? "disabled" : ""} onclick="pages.${path}.page=${p.page + 1};pages.${path}.reload()">التالي</button>
  </div>`;
}

window.pages.devices = {
  page: 1,
  async render(content) {
    content.innerHTML = `
      <div class="toolbar">
        <input id="dev-search" placeholder="ابحث بالبريد أو معرف الجهاز…" value="${esc(getParams().get("q") || "")}">
        <button class="btn primary" id="dev-search-btn">بحث</button>
      </div>
      <div id="dev-list"></div>`;
    this.bind();
    this.reload();
  },
  bind() {
    const doSearch = () => {
      const q = document.getElementById("dev-search").value.trim();
      this.page = 1;
      location.hash = q ? `#/devices?q=${encodeURIComponent(q)}` : "#/devices";
    };
    document.getElementById("dev-search-btn").addEventListener("click", doSearch);
    document.getElementById("dev-search").addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSearch();
    });
  },
  async reload() {
    const q = getParams().get("q") || "";
    const res = await api(`/api/devices?page=${this.page}&pageSize=50${q ? `&search=${encodeURIComponent(q)}` : ""}`);
    if (res.status !== 200) throw new Error("bad devices");
    const { data, pagination } = res.data;
    document.getElementById("dev-list").innerHTML =
      deviceTable(data) + paginationControls(pagination, "devices", (p) => (this.page = p));
    document.querySelectorAll("[data-kick]").forEach((btn) => {
      btn.addEventListener("click", () => kickDevice(btn.getAttribute("data-kick"), btn));
    });
  },
};

async function kickDevice(id, btn) {
  if (!window.confirm("طرد هذا الجهاز الآن؟ سيفقد المحاسب الوصول فوراً.")) return;
  btn.disabled = true;
  btn.textContent = "جارٍ الطرد…";
  try {
    const res = await api("/api/kick", { method: "POST", body: JSON.stringify({ id }) });
    if (res.status === 200) {
      btn.textContent = "تم الطرد";
      setTimeout(() => window.location.reload(), 700);
    } else {
      btn.textContent = "فشل";
      btn.disabled = false;
    }
  } catch (e) {
    btn.textContent = "فشل";
    btn.disabled = false;
  }
}

window.pages.today = {
  page: 1,
  async render(content) {
    content.innerHTML = `<div id="today-list"></div>`;
    this.reload();
  },
  async reload() {
    const res = await api(`/api/subscribers?page=${this.page}&pageSize=25&registeredToday=1`);
    if (res.status !== 200) throw new Error("bad subscribers");
    const { data, pagination } = res.data;
    document.getElementById("today-list").innerHTML = subTable(data) + paginationControls(pagination, "today", (p) => (this.page = p));
  },
};

function subTable(rows) {
  if (!rows || !rows.length) return `<div class="empty">لا يوجد مسجلون اليوم.</div>`;
  return `<div class="table-wrap"><table>
    <thead><tr>
      <th>البريد</th><th>الاسم</th><th>الخطة</th><th>الحالة</th><th>تاريخ الانتهاء</th><th>التسجيل</th>
    </tr></thead>
    <tbody>
      ${rows
        .map(
          (r) => `<tr>
        <td>${esc(r.email)}</td>
        <td>${esc(r.name || "—")}</td>
        <td>${esc(r.plan_type || "—")}</td>
        <td><span class="badge ${r.status === "active" ? "green" : "red"}">${r.status === "active" ? "نشط" : "منتهي"}</span></td>
        <td>${esc(r.end_date || r.expiry_date || "—")}</td>
        <td>${fmtDate(r.created_at)}</td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table></div>`;
}

window.pages.add = async (content) => {
  content.innerHTML = `
    <div class="panel">
      <h3>إضافة / تحديث مشترك</h3>
      <p class="muted">إذا كان البريد موجوداً، سيتم تحديث بياناته.</p>
      <div class="form">
        <label>البريد الإلكتروني <span class="req">*</span></label>
        <input id="add-email" type="email" dir="ltr" placeholder="user@example.com">
        <label>الاسم</label>
        <input id="add-name" placeholder="اسم المستخدم">
        <label>نوع الخطة</label>
        <input id="add-plan" placeholder="سنوية / شهرية">
        <label>تاريخ الانتهاء</label>
        <input id="add-end" type="date" dir="ltr">
        <label>بريدات مرتبطة (اختياري، مفصولة بفاصلة)</label>
        <input id="add-linked" dir="ltr" placeholder="a@x.com, b@y.com">
        <label>الحالة</label>
        <input id="add-status" dir="ltr" placeholder="active أو expired" value="active">
        <button class="btn primary block" id="add-submit">حفظ</button>
        <div id="add-msg"></div>
      </div>
    </div>`;
  document.getElementById("add-submit").addEventListener("click", async () => {
    const msg = document.getElementById("add-msg");
    msg.className = "";
    msg.textContent = "";
    const email = document.getElementById("add-email").value.trim();
    if (!email) {
      msg.className = "error";
      msg.textContent = "أدخل البريد الإلكتروني.";
      return;
    }
    const body = {
      email,
      name: document.getElementById("add-name").value.trim(),
      plan_type: document.getElementById("add-plan").value.trim(),
      end_date: document.getElementById("add-end").value || null,
      linked_emails: document.getElementById("add-linked").value.split(",").map((s) => s.trim()).filter(Boolean),
      status: document.getElementById("add-status").value.trim(),
    };
    const res = await api("/api/subscribers", { method: "POST", body: JSON.stringify(body) });
    if (res.status === 200) {
      msg.className = "success";
      msg.textContent = "تم الحفظ بنجاح.";
    } else {
      msg.className = "error";
      msg.textContent = (res.data && res.data.error) || "حدث خطأ أثناء الحفظ.";
    }
  });
};

window.pages.settings = async (content) => {
  const res = await api("/api/settings");
  if (res.status !== 200 || !res.data) throw new Error("bad settings");
  const mode = res.data.mode === "free" ? "free" : "paid";
  content.innerHTML = `
    <div class="panel">
      <h3>وضع الاشتراك</h3>
      <p class="muted">في الوضع المجاني يتجاهل النظام حد الأجهزة، وفي وضع الاشتراك يُطبَّق حد الأجهزة لكل بريد.</p>
      <div class="toggle-row">
        <div class="toggle-option ${mode === "free" ? "selected" : ""}">
          <input type="radio" name="mode" value="free" ${mode === "free" ? "checked" : ""}>
          <div>مجاني</div>
        </div>
        <div class="toggle-option ${mode === "paid" ? "selected" : ""}">
          <input type="radio" name="mode" value="paid" ${mode === "paid" ? "checked" : ""}>
          <div>اشتراك</div>
        </div>
      </div>
      <button class="btn primary" id="save-mode">حفظ الوضع</button>
      <div id="settings-msg"></div>
    </div>`;
  document.querySelectorAll(".toggle-option").forEach((o) => {
    o.addEventListener("click", () => {
      o.querySelector("input").checked = true;
      document.querySelectorAll(".toggle-option").forEach((x) => x.classList.toggle("selected", x === o));
    });
  });
  document.getElementById("save-mode").addEventListener("click", async () => {
    const m = document.querySelector('input[name="mode"]:checked').value;
    const msg = document.getElementById("settings-msg");
    msg.className = "";
    msg.textContent = "";
    const r = await api("/api/settings", { method: "PUT", body: JSON.stringify({ mode: m }) });
    if (r.status === 200) {
      msg.className = "success";
      msg.textContent = "تم حفظ الوضع بنجاح.";
    } else {
      msg.className = "error";
      msg.textContent = "حدث خطأ أثناء الحفظ.";
    }
  });
};
