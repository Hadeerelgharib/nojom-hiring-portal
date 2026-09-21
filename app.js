/* =====================================================================
   Nojom Hiring Request Portal — application logic.
   Brand + Supabase project settings live in config.js, not here.
   ===================================================================== */

/* ===================================================================== */
/* Small utilities                                                       */
/* ===================================================================== */
const $ = (id) => document.getElementById(id);
const qs = (sel, root) => (root || document).querySelector(sel);
const qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));

function escAttr(s) {
  return String(s == null ? "" : s).replace(/"/g, "&quot;");
}
function escHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function xmlEsc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  }[c]));
}
function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "id" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function todayISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function nowStamp() {
  return new Date().toISOString();
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function addDaysISO(iso, days) {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function timeToFillDays(value, unit) {
  const v = Number(value) || 0;
  if (unit === "Days") return v;
  if (unit === "Months") return v * 30;
  return v * 7; // Weeks
}
function money(n, currency) {
  if (n === "" || n == null || isNaN(n)) return "—";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) + " " + (currency || "");
}
function currentTheme() {
  const cs = getComputedStyle(document.documentElement);
  return cs.getPropertyValue("--ink").trim() || "#15161a";
}

/* ===================================================================== */
/* Toast + Modal                                                         */
/* ===================================================================== */
function toast(msg, type) {
  const host = $("toast-host");
  const el = document.createElement("div");
  el.className = "toast" + (type ? " toast-" + type : "");
  el.textContent = msg;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 250);
  }, 3600);
}

function openModal({ title, body, confirmLabel, cancelLabel, danger, onConfirm }) {
  const host = $("modal-host");
  host.innerHTML =
    '<div class="modal-overlay" id="modal-overlay"><div class="modal-box" role="dialog" aria-modal="true">' +
    "<h3>" + escHtml(title) + "</h3><p>" + escHtml(body) + "</p>" +
    '<div class="modal-actions">' +
    '<button class="btn btn-secondary" id="modal-cancel">' + escHtml(cancelLabel || "Cancel") + "</button>" +
    '<button class="btn ' + (danger ? "btn-danger" : "btn-primary") + '" id="modal-confirm">' + escHtml(confirmLabel || "Confirm") + "</button>" +
    "</div></div></div>";
  const close = () => { host.innerHTML = ""; };
  $("modal-overlay").addEventListener("click", (e) => { if (e.target.id === "modal-overlay") close(); });
  $("modal-cancel").addEventListener("click", close);
  $("modal-confirm").addEventListener("click", () => { close(); onConfirm && onConfirm(); });
}

function closeModal() { $("modal-host").innerHTML = ""; }

/* ---- sign-in modal (email + password, Supabase Auth) ---- */
function openSignInModal() {
  if (!requireConfigured()) return;
  const host = $("modal-host");
  host.innerHTML =
    '<div class="modal-overlay" id="modal-overlay"><div class="modal-box" role="dialog" aria-modal="true">' +
    "<h3>Sign in</h3>" +
    '<p>For HR Manager, Final Approver, and HR Admin accounts. Submitting a new hiring request never requires signing in.</p>' +
    '<div class="auth-form-row"><label for="auth-email">Email</label><input type="email" id="auth-email" autocomplete="username"></div>' +
    '<div class="auth-form-row"><label for="auth-password">Password</label><input type="password" id="auth-password" autocomplete="current-password"></div>' +
    '<div class="auth-error" id="auth-error"></div>' +
    '<div class="modal-actions">' +
    '<button class="btn btn-secondary" id="modal-cancel">Cancel</button>' +
    '<button class="btn btn-primary" id="btn-do-sign-in">Sign in</button>' +
    "</div></div></div>";
  const close = () => { host.innerHTML = ""; };
  $("modal-overlay").addEventListener("click", (e) => { if (e.target.id === "modal-overlay") close(); });
  $("modal-cancel").addEventListener("click", close);
  const submit = async () => {
    const email = $("auth-email").value.trim();
    const password = $("auth-password").value;
    const errEl = $("auth-error");
    errEl.textContent = "";
    if (!email || !password) { errEl.textContent = "Enter your email and password."; return; }
    const btn = $("btn-do-sign-in");
    btn.disabled = true; btn.textContent = "Signing in…";
    const { error } = await sb.auth.signInWithPassword({ email, password });
    btn.disabled = false; btn.textContent = "Sign in";
    if (error) { errEl.textContent = error.message || "Could not sign in."; return; }
    close();
  };
  $("btn-do-sign-in").addEventListener("click", submit);
  $("auth-password").addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
}

/* ===================================================================== */
/* Supabase client + auth state                                          */
/* ===================================================================== */
let sb = null;
let configured = false;
let session = null;
let myProfile = null; // { id, full_name, role, roles: string[] } or null
let passwordRecoveryMode = false; // true while the user is on a Supabase password-recovery session

function initSupabase() {
  configured = !!(window.supabase && SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey &&
    !SUPABASE_CONFIG.url.includes("YOUR-PROJECT-REF") && !SUPABASE_CONFIG.anonKey.includes("YOUR-ANON"));
  if (!configured) return;
  sb = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
}

async function refreshAuthState() {
  if (passwordRecoveryMode) return; // don't render the normal app while a new password is pending
  if (!configured) { myProfile = null; renderAuthArea(); return; }
  const { data } = await sb.auth.getSession();
  session = data.session || null;
  if (session) {
    const { data: prof, error } = await sb.from("profiles").select("id, full_name, role").eq("id", session.user.id).single();
    if (error || !prof) {
      myProfile = null;
      toast("Your account isn't set up as an approver yet — contact your HR Admin.", "danger");
    } else {
      // Almost every account has exactly one role (profiles.role). A small
      // number of accounts may additionally hold a row in
      // user_extra_roles (grantable only from the Supabase SQL editor —
      // never from this app) giving them a second role. myProfile.roles
      // is the de-duplicated union of both; every permission check below
      // tests membership in this array, never a single role string.
      const { data: extra } = await sb.from("user_extra_roles").select("role").eq("user_id", session.user.id);
      const roleSet = new Set([prof.role].concat((extra || []).map((e) => e.role)));
      myProfile = Object.assign({}, prof, { roles: Array.from(roleSet) });
    }
  } else {
    myProfile = null;
  }
  renderAuthArea();
  await refreshRequests();
}

const ROLE_LABEL = { hr_manager: "HR Manager", final_approver: "Final Approver", hr_admin: "HR Admin" };

function renderAuthArea() {
  const area = $("auth-area");
  if (myProfile) {
    const roleTags = myProfile.roles.map((r) => '<span class="role-tag">' + escHtml(ROLE_LABEL[r] || r) + '</span>').join("");
    area.innerHTML =
      '<div class="auth-chip"><span class="who">' + escHtml(myProfile.full_name) + '</span>' +
      roleTags +
      '<button class="btn btn-ghost btn-sm" id="btn-sign-out">Sign out</button></div>';
    $("btn-sign-out").addEventListener("click", async () => { await sb.auth.signOut(); await refreshAuthState(); });
  } else if (session) {
    area.innerHTML = '<div class="auth-chip"><span class="who">Signed in</span><button class="btn btn-ghost btn-sm" id="btn-sign-out">Sign out</button></div>';
    $("btn-sign-out").addEventListener("click", async () => { await sb.auth.signOut(); await refreshAuthState(); });
  } else {
    area.innerHTML = '<button class="btn btn-secondary btn-sm" id="btn-sign-in">Sign in</button>';
    $("btn-sign-in").addEventListener("click", openSignInModal);
  }
  const note = $("requests-auth-note");
  if (myProfile) {
    note.classList.remove("hidden");
    const roleLabels = myProfile.roles.map((r) => ROLE_LABEL[r] || r).join(" + ");
    $("requests-auth-name").textContent = myProfile.full_name + " (" + roleLabels + ")";
  } else {
    note.classList.add("hidden");
  }
  $("requests-signin-gate").classList.toggle("hidden", !!myProfile);
  $("requests-list-pane").classList.toggle("hidden", !myProfile);
  if (!myProfile) $("requests-detail-pane").classList.add("hidden");
}

/* ===================================================================== */
/* Password recovery mode                                                */
/* Reached when the user follows a Supabase "reset password" email link. */
/* Supabase's client detects the recovery tokens in the URL and fires an */
/* auth event named "PASSWORD_RECOVERY" (wired up in init(), below). We  */
/* show a dedicated, non-dismissable "set a new password" screen instead */
/* of letting the user fall through to the normal signed-in app.         */
/* ===================================================================== */
function enterPasswordRecoveryMode() {
  passwordRecoveryMode = true;
  renderPasswordRecoveryScreen();
}

function renderPasswordRecoveryScreen() {
  const host = $("modal-host");
  host.innerHTML =
    '<div class="modal-overlay" id="recovery-overlay"><div class="modal-box" role="dialog" aria-modal="true">' +
    "<h3>Set a new password</h3>" +
    '<p>You followed a password reset link. Choose a new password for your account to continue.</p>' +
    '<div class="auth-form-row"><label for="recovery-password">New password</label><input type="password" id="recovery-password" autocomplete="new-password"></div>' +
    '<div class="auth-form-row"><label for="recovery-password-confirm">Confirm new password</label><input type="password" id="recovery-password-confirm" autocomplete="new-password"></div>' +
    '<div class="auth-error" id="recovery-error"></div>' +
    '<div class="modal-actions">' +
    '<button class="btn btn-primary" id="btn-do-recovery">Update password</button>' +
    "</div></div></div>";
  // Deliberately no overlay-click-to-close and no Cancel button here —
  // unlike openSignInModal/openModal, this screen must not be dismissable
  // until a new password is actually set.
  const submit = async () => {
    const pw = $("recovery-password").value;
    const pw2 = $("recovery-password-confirm").value;
    const errEl = $("recovery-error");
    errEl.textContent = "";
    if (!pw || pw.length < 6) { errEl.textContent = "Password must be at least 6 characters."; return; }
    if (pw !== pw2) { errEl.textContent = "Passwords do not match."; return; }
    const btn = $("btn-do-recovery");
    btn.disabled = true; btn.textContent = "Updating…";
    const { error } = await sb.auth.updateUser({ password: pw });
    btn.disabled = false; btn.textContent = "Update password";
    if (error) { errEl.textContent = error.message || "Could not update password."; return; }
    await exitPasswordRecoveryMode();
    toast("Password updated — you're signed in.", "success");
  };
  $("btn-do-recovery").addEventListener("click", submit);
  $("recovery-password-confirm").addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
}

async function exitPasswordRecoveryMode() {
  passwordRecoveryMode = false;
  $("modal-host").innerHTML = "";
  // Strip the recovery tokens out of the URL so they don't linger in the
  // address bar or browser history once they've been consumed.
  if (window.history && window.history.replaceState) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  await refreshAuthState();
}

/* ===================================================================== */
/* Application state                                                     */
/* ===================================================================== */
const state = {
  view: "new",
  requests: [],
  currentDraftId: null,
  currentDraftToken: null,
  dirty: false,
  detailId: null,
  filters: { search: "", status: "", priority: "" }
};

let respList, qualList;
let realtimeChannel = null;

/* ===================================================================== */
/* Signature pad                                                         */
/* ===================================================================== */
class SignaturePad {
  constructor(canvas, placeholderEl) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.placeholderEl = placeholderEl;
    this.hasInk = false;
    this.drawing = false;
    this._setupSize();
    window.addEventListener("resize", () => this._setupSize());
    const posFromEvent = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    canvas.addEventListener("pointerdown", (e) => {
      this.drawing = true;
      const p = posFromEvent(e);
      this.ctx.beginPath();
      this.ctx.moveTo(p.x, p.y);
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!this.drawing) return;
      const p = posFromEvent(e);
      this.ctx.lineTo(p.x, p.y);
      this.ctx.stroke();
      if (!this.hasInk) { this.hasInk = true; if (this.placeholderEl) this.placeholderEl.style.display = "none"; }
      e.preventDefault();
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((ev) =>
      canvas.addEventListener(ev, () => { this.drawing = false; })
    );
  }
  _setupSize() {
    const canvas = this.canvas;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    let snapshot = null;
    if (this.hasInk && canvas.width) { try { snapshot = canvas.toDataURL(); } catch (e) {} }
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(ratio, ratio);
    this.ctx.lineWidth = 2.2;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.strokeStyle = currentTheme();
    if (snapshot) {
      const img = new Image();
      img.onload = () => this.ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = snapshot;
    }
  }
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.hasInk = false;
    if (this.placeholderEl) this.placeholderEl.style.display = "flex";
  }
  isEmpty() { return !this.hasInk; }
  toDataURL() { return this.hasInk ? this.canvas.toDataURL("image/png") : null; }
  loadFromDataURL(url) {
    if (!url) return;
    const img = new Image();
    img.onload = () => {
      const rect = this.canvas.getBoundingClientRect();
      this.ctx.drawImage(img, 0, 0, rect.width, rect.height);
      this.hasInk = true;
      if (this.placeholderEl) this.placeholderEl.style.display = "none";
    };
    img.src = url;
  }
}
let rmPad = null;

/* ===================================================================== */
/* Dynamic list helper (responsibilities / qualifications)               */
/* ===================================================================== */
function createDynamicList(containerId, placeholder) {
  const container = $(containerId);
  function addRow(value) {
    const row = document.createElement("div");
    row.className = "dyn-row";
    row.innerHTML =
      '<input type="text" class="dyn-input" placeholder="' + escAttr(placeholder) + '" value="' + escAttr(value || "") + '">' +
      '<button type="button" class="btn-icon" aria-label="Remove line">&#10005;</button>';
    row.querySelector("input").addEventListener("input", markDirty);
    row.querySelector("button").addEventListener("click", () => {
      if (container.children.length > 1) row.remove(); else row.querySelector("input").value = "";
      markDirty();
    });
    container.appendChild(row);
  }
  function setValues(values) {
    container.innerHTML = "";
    (values && values.length ? values : [""]).forEach(addRow);
  }
  function getValues() {
    return qsa(".dyn-input", container).map((i) => i.value.trim()).filter(Boolean);
  }
  setValues([]);
  return { addRow, setValues, getValues, container };
}

function markDirty() { state.dirty = true; }

/* ===================================================================== */
/* Form <-> data model                                                   */
/* ===================================================================== */
function blankForm() {
  return {
    jobTitle: "", department: "", departmentOther: "", jobGrade: "", reportingTo: "",
    employmentType: "Full-Time", workMode: "On-site", workLocation: "", numPositions: 1,
    requestType: "new",
    replacementName: "", replacementReason: "", replacementReasonOther: "", lastWorkingDay: "",
    newPosJustification: "",
    responsibilities: [], qualifications: [], otherRequirements: "",
    submissionDate: todayISO(), timeToFillValue: 4, timeToFillUnit: "Weeks",
    priority: "High", businessImpact: "", urgencyReason: "",
    currency: "EGP", approvedBudget: "", salaryMin: "", salaryMax: "", benefits: "",
    inBudget: "Yes", budgetJustification: "",
    rmName: "", rmSignature: null, rmDate: null
  };
}

function readFormIntoObject() {
  const f = {};
  f.jobTitle = $("f-jobTitle").value.trim();
  f.department = $("f-department").value;
  f.departmentOther = $("f-departmentOther").value.trim();
  f.jobGrade = $("f-jobGrade").value.trim();
  f.reportingTo = $("f-reportingTo").value.trim();
  f.employmentType = (qs('input[name="employmentType"]:checked') || {}).value || "Full-Time";
  f.workMode = $("f-workMode").value;
  f.workLocation = $("f-workLocation").value.trim();
  f.numPositions = Number($("f-numPositions").value) || 1;
  f.requestType = (qs('input[name="requestType"]:checked') || {}).value || "new";
  f.replacementName = $("f-replacementName").value.trim();
  f.replacementReason = $("f-replacementReason").value;
  f.replacementReasonOther = $("f-replacementReasonOther").value.trim();
  f.lastWorkingDay = $("f-lastWorkingDay").value;
  f.newPosJustification = $("f-newPosJustification").value.trim();
  f.responsibilities = respList.getValues();
  f.qualifications = qualList.getValues();
  f.otherRequirements = $("f-otherRequirements").value.trim();
  f.submissionDate = $("f-submissionDate").value || todayISO();
  f.timeToFillValue = Number($("f-timeToFillValue").value) || 0;
  f.timeToFillUnit = $("f-timeToFillUnit").value;
  f.priority = (qs('input[name="priority"]:checked') || {}).value || "High";
  f.businessImpact = $("f-businessImpact").value.trim();
  f.urgencyReason = $("f-urgencyReason").value.trim();
  f.currency = $("f-currency").value;
  f.approvedBudget = $("f-approvedBudget").value;
  f.salaryMin = $("f-salaryMin").value;
  f.salaryMax = $("f-salaryMax").value;
  f.benefits = $("f-benefits").value.trim();
  f.inBudget = (qs('input[name="inBudget"]:checked') || {}).value || "Yes";
  f.budgetJustification = $("f-budgetJustification").value.trim();
  f.rmName = $("f-rmName").value.trim();
  f.rmSignature = rmPad ? rmPad.toDataURL() : null;
  f.rmDate = $("f-rmDateDisplay").value || null;
  return f;
}

function writeObjectIntoForm(f) {
  f = Object.assign(blankForm(), f);
  $("f-jobTitle").value = f.jobTitle;
  $("f-department").value = f.department;
  $("f-departmentOther").value = f.departmentOther;
  toggleHidden("wrap-departmentOther", f.department !== "Other");
  $("f-jobGrade").value = f.jobGrade;
  $("f-reportingTo").value = f.reportingTo;
  setRadio("employmentType", f.employmentType);
  $("f-workMode").value = f.workMode;
  $("f-workLocation").value = f.workLocation;
  $("f-numPositions").value = f.numPositions;
  setRadio("requestType", f.requestType);
  $("f-replacementName").value = f.replacementName;
  $("f-replacementReason").value = f.replacementReason;
  $("f-replacementReasonOther").value = f.replacementReasonOther;
  toggleHidden("wrap-replacementReasonOther", f.replacementReason !== "Other");
  $("f-lastWorkingDay").value = f.lastWorkingDay;
  $("f-newPosJustification").value = f.newPosJustification;
  respList.setValues(f.responsibilities);
  qualList.setValues(f.qualifications);
  $("f-otherRequirements").value = f.otherRequirements;
  $("f-submissionDate").value = f.submissionDate || todayISO();
  $("f-timeToFillValue").value = f.timeToFillValue;
  $("f-timeToFillUnit").value = f.timeToFillUnit;
  setRadio("priority", f.priority);
  $("f-businessImpact").value = f.businessImpact;
  $("f-urgencyReason").value = f.urgencyReason;
  $("f-currency").value = f.currency;
  $("f-approvedBudget").value = f.approvedBudget;
  $("f-salaryMin").value = f.salaryMin;
  $("f-salaryMax").value = f.salaryMax;
  $("f-benefits").value = f.benefits;
  setRadio("inBudget", f.inBudget);
  $("f-budgetJustification").value = f.budgetJustification;
  $("f-rmName").value = f.rmName || "";
  $("f-rmDateDisplay").value = f.rmDate ? fmtDate(f.rmDate) : "";
  if (rmPad) { rmPad.clear(); if (f.rmSignature) rmPad.loadFromDataURL(f.rmSignature); }
  updateConditionalVisibility();
  state.dirty = false;
}

function setRadio(name, value) {
  qsa('input[name="' + name + '"]').forEach((r) => { r.checked = r.value === value; });
}
function toggleHidden(id, hidden) { $(id).classList.toggle("hidden", hidden); }

function updateConditionalVisibility() {
  const reqType = (qs('input[name="requestType"]:checked') || {}).value;
  toggleHidden("block-replacement", reqType !== "replacement");
  toggleHidden("block-newposition", reqType !== "new");
  const dept = $("f-department").value;
  toggleHidden("wrap-departmentOther", dept !== "Other");
  const reason = $("f-replacementReason").value;
  toggleHidden("wrap-replacementReasonOther", reason !== "Other");
  const inBudget = (qs('input[name="inBudget"]:checked') || {}).value;
  toggleHidden("block-budgetJustification", inBudget === "Yes");
}

/* ===================================================================== */
/* Validation                                                            */
/* ===================================================================== */
function setFieldError(fieldEl, hasError) {
  if (!fieldEl) return;
  fieldEl.classList.toggle("has-error", !!hasError);
}
function fieldWrap(inputId) {
  const el = $(inputId);
  return el ? el.closest(".field") : null;
}

function validateForm() {
  let firstInvalid = null;
  const mark = (inputId, ok) => {
    const w = fieldWrap(inputId);
    setFieldError(w, !ok);
    if (!ok && !firstInvalid) firstInvalid = w;
    return ok;
  };
  const reqType = (qs('input[name="requestType"]:checked') || {}).value;
  const inBudget = (qs('input[name="inBudget"]:checked') || {}).value;

  let ok = true;
  ok = mark("f-jobTitle", !!$("f-jobTitle").value.trim()) && ok;
  ok = mark("f-department", !!$("f-department").value) && ok;
  ok = mark("f-jobGrade", !!$("f-jobGrade").value.trim()) && ok;
  ok = mark("f-reportingTo", !!$("f-reportingTo").value.trim()) && ok;
  ok = mark("f-workLocation", !!$("f-workLocation").value.trim()) && ok;
  ok = mark("f-numPositions", Number($("f-numPositions").value) >= 1) && ok;

  if (reqType === "replacement") {
    ok = mark("f-replacementName", !!$("f-replacementName").value.trim()) && ok;
    ok = mark("f-replacementReason", !!$("f-replacementReason").value) && ok;
    ok = mark("f-lastWorkingDay", !!$("f-lastWorkingDay").value) && ok;
  } else {
    ok = mark("f-newPosJustification", !!$("f-newPosJustification").value.trim()) && ok;
  }

  const respWrap = $("err-responsibilities").closest(".field");
  const respOk = respList.getValues().length > 0;
  setFieldError(respWrap, !respOk);
  if (!respOk && !firstInvalid) firstInvalid = respWrap;
  ok = respOk && ok;

  const qualWrap = $("err-qualifications").closest(".field");
  const qualOk = qualList.getValues().length > 0;
  setFieldError(qualWrap, !qualOk);
  if (!qualOk && !firstInvalid) firstInvalid = qualWrap;
  ok = qualOk && ok;

  ok = mark("f-businessImpact", !!$("f-businessImpact").value.trim()) && ok;
  const ttfOk = Number($("f-timeToFillValue").value) > 0;
  setFieldError($("err-timeToFill").closest(".field"), !ttfOk);
  if (!ttfOk && !firstInvalid) firstInvalid = $("err-timeToFill").closest(".field");
  ok = ttfOk && ok;

  ok = mark("f-approvedBudget", $("f-approvedBudget").value !== "") && ok;
  ok = mark("f-salaryMin", $("f-salaryMin").value !== "") && ok;
  const maxOk = $("f-salaryMax").value !== "" && Number($("f-salaryMax").value) >= Number($("f-salaryMin").value || 0);
  setFieldError($("err-salaryMax").closest(".field"), !maxOk);
  if (!maxOk && !firstInvalid) firstInvalid = $("err-salaryMax").closest(".field");
  ok = maxOk && ok;

  if (inBudget !== "Yes") {
    ok = mark("f-budgetJustification", !!$("f-budgetJustification").value.trim()) && ok;
  }

  ok = mark("f-rmName", !!$("f-rmName").value.trim()) && ok;
  const sigOk = rmPad && !rmPad.isEmpty();
  setFieldError($("err-sig-rm").closest(".field"), !sigOk);
  if (!sigOk && !firstInvalid) firstInvalid = $("err-sig-rm").closest(".field");
  ok = sigOk && ok;

  if (!ok && firstInvalid) firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
  return ok;
}

/* ===================================================================== */
/* Draft continuity (anonymous, localStorage pointer + edit_token)       */
/* ===================================================================== */
const DRAFT_PTR_KEY = "nojom_hiring_draft_ptr";
function saveDraftPointer(id, token) {
  try { localStorage.setItem(DRAFT_PTR_KEY, JSON.stringify({ id, token })); } catch (e) {}
}
function readDraftPointer() {
  try { return JSON.parse(localStorage.getItem(DRAFT_PTR_KEY) || "null"); } catch (e) { return null; }
}
function clearDraftPointer() {
  try { localStorage.removeItem(DRAFT_PTR_KEY); } catch (e) {}
}

function checkForResumableDraft() {
  const ptr = readDraftPointer();
  $("resume-draft-banner").classList.toggle("hidden", !ptr || !!state.currentDraftId);
}

/* ===================================================================== */
/* Save draft / submit / reset / cancel                                  */
/* ===================================================================== */
async function saveDraft() {
  if (!requireConfigured()) return;
  const f = readFormIntoObject();
  const { data, error } = await sb.rpc("create_or_update_draft", {
    p_id: state.currentDraftId, p_edit_token: state.currentDraftToken, p_form: f
  });
  if (error) { toast(error.message || "Could not save the draft.", "danger"); return; }
  const row = Array.isArray(data) ? data[0] : data;
  state.currentDraftId = row.id;
  state.currentDraftToken = row.edit_token;
  saveDraftPointer(row.id, row.edit_token);
  state.dirty = false;
  toast("Draft saved on this device.", "success");
  checkForResumableDraft();
}

async function resumeDraft() {
  if (!requireConfigured()) return;
  const ptr = readDraftPointer();
  if (!ptr) return;
  const { data, error } = await sb.rpc("get_draft", { p_id: ptr.id, p_edit_token: ptr.token });
  if (error) {
    toast("That saved draft could not be found — it may have already been submitted.", "danger");
    clearDraftPointer();
    checkForResumableDraft();
    return;
  }
  state.currentDraftId = ptr.id;
  state.currentDraftToken = ptr.token;
  writeObjectIntoForm(data.form || {});
  $("draft-banner").style.display = "flex";
  $("resume-draft-banner").classList.add("hidden");
  switchView("new");
  toast("Draft loaded.", "success");
}

async function submitRequest() {
  if (!requireConfigured()) return;
  if (!validateForm()) { toast("Please complete the highlighted fields before submitting.", "danger"); return; }
  const f = readFormIntoObject();
  const rm = { name: f.rmName, signature: f.rmSignature, date: todayISO(), status: "Approved" };
  const submitBtn = $("btn-submit");
  submitBtn.disabled = true;
  const { data, error } = await sb.rpc("submit_hiring_request", {
    p_id: state.currentDraftId, p_edit_token: state.currentDraftToken, p_form: f, p_rm: rm
  });
  submitBtn.disabled = false;
  if (error) { toast(error.message || "Could not submit the request.", "danger"); return; }
  const row = Array.isArray(data) ? data[0] : data;
  clearDraftPointer();
  state.currentDraftId = null;
  state.currentDraftToken = null;
  const submittedForm = Object.assign({}, f);
  clearFormToBlank();
  showConfirmation(row.display_id, submittedForm);
}

function clearFormToBlank() {
  writeObjectIntoForm(blankForm());
  $("f-rmDateDisplay").value = "";
  qsa(".field").forEach((f) => setFieldError(f, false));
  $("draft-banner").style.display = "none";
  state.currentDraftId = null;
  state.currentDraftToken = null;
  checkForResumableDraft();
}

function showConfirmation(displayId, form) {
  const el = $("view-confirm");
  el.innerHTML =
    '<div class="card"><div class="card-body confirm-hero">' +
    '<div class="check">&#10003;</div>' +
    '<h2 style="font-size:18px;">Request submitted</h2>' +
    '<p class="hint" style="max-width:440px; margin:8px auto 0;">Thank you — your hiring request for <strong>' + escHtml(form.jobTitle) + '</strong> has been sent to HR for review.</p>' +
    '<div class="confirm-id">' + escHtml(displayId) + '</div>' +
    '<p class="hint">Save this ID for your records — it identifies your request to HR.</p>' +
    '<div style="display:flex; gap:10px; justify-content:center; margin-top:18px; flex-wrap:wrap;">' +
    '<button class="btn btn-secondary" id="btn-confirm-new">Submit another request</button>' +
    "</div></div></div>";
  el.classList.remove("hidden");
  qsa("#view-new > .card, #view-new > .action-bar, #view-new > #resume-draft-banner, #view-new > #draft-banner").forEach((n) => n.style.display = "none");
  $("btn-confirm-new").addEventListener("click", () => {
    el.classList.add("hidden");
    el.innerHTML = "";
    qsa("#view-new > .card, #view-new > .action-bar").forEach((n) => n.style.display = "");
    checkForResumableDraft();
  });
  window.scrollTo({ top: 0 });
}

function requireConfigured() {
  if (configured) return true;
  toast("This site isn't connected to a database yet — see config.js.", "danger");
  return false;
}

/* ===================================================================== */
/* View switching                                                        */
/* ===================================================================== */
function switchView(view) {
  state.view = view;
  $("view-new").classList.toggle("hidden", view !== "new");
  $("view-requests").classList.toggle("hidden", view !== "requests");
  $("tab-new").classList.toggle("active", view === "new");
  $("tab-requests").classList.toggle("active", view === "requests");
  if (view === "requests") {
    if (!myProfile) { openSignInModal(); }
    else if (!state.detailId) showListPane();
  }
  window.scrollTo({ top: 0 });
}

function showListPane() {
  state.detailId = null;
  $("requests-list-pane").classList.remove("hidden");
  $("requests-detail-pane").classList.add("hidden");
  renderRequestGrid();
}

function openDetail(id) {
  state.detailId = id;
  $("requests-list-pane").classList.add("hidden");
  $("requests-detail-pane").classList.remove("hidden");
  renderDetail(id);
}

/* ===================================================================== */
/* Requests grid (list view)                                             */
/* ===================================================================== */
const STATUS_LABEL = {
  draft: "Draft", pending_hr: "Pending HR Review", pending_final: "Pending Final Approval",
  approved: "Fully Approved", rejected: "Rejected"
};
function statusPillHtml(status) {
  return '<span class="pill pill-' + status + '">' + escHtml(STATUS_LABEL[status] || status) + "</span>";
}
function priorityPillHtml(p) {
  return '<span class="pill pill-' + String(p).toLowerCase() + '">' + escHtml(p) + "</span>";
}

function passesFilters(r) {
  const f = state.filters;
  if (f.status && r.approvalStatus !== f.status) return false;
  if (f.priority && r.form.priority !== f.priority) return false;
  if (f.search) {
    const hay = (r.displayId + " " + r.form.jobTitle + " " + r.form.department).toLowerCase();
    if (!hay.includes(f.search.toLowerCase())) return false;
  }
  return true;
}

function renderRequestGrid() {
  const grid = $("req-grid");
  const list = state.requests.filter(passesFilters);
  if (!list.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><h3>No requests yet</h3><p>Submitted hiring requests will appear here once HR review begins.</p></div>';
    return;
  }
  grid.innerHTML = list.map((r) => {
    const f = r.form;
    return '<div class="req-card" data-id="' + r.id + '">' +
      '<div class="req-card-top"><div><div class="req-card-title">' + escHtml(f.jobTitle || "Untitled position") + '</div>' +
      '<div class="req-card-id">' + escHtml(r.displayId || "DRAFT") + "</div></div>" +
      statusPillHtml(r.approvalStatus) + "</div>" +
      '<div class="req-card-meta"><span>' + escHtml(f.department || "—") + "</span><span>&middot;</span>" +
      "<span>" + escHtml(f.jobGrade || "—") + "</span><span>&middot;</span>" +
      "<span>" + (f.requestType === "replacement" ? "Replacement" : "New Position") + "</span></div>" +
      '<div class="req-card-pills">' + priorityPillHtml(f.priority) +
      '<span class="pill pill-draft">Requested ' + fmtDate(f.submissionDate) + "</span></div>" +
      "</div>";
  }).join("");
  qsa(".req-card", grid).forEach((card) => card.addEventListener("click", () => openDetail(card.dataset.id)));
}

/* ===================================================================== */
/* Detail view                                                           */
/* ===================================================================== */
function computeTargetDate(r) {
  const f = r.form;
  return addDaysISO(f.submissionDate, timeToFillDays(f.timeToFillValue, f.timeToFillUnit));
}
function finalRequirementText(r) {
  const rec = (r.hrOnly && r.hrOnly.recruitmentStatus) || "";
  if (rec === "Filled") return "Filled" + (r.hrOnly.finalCandidate ? " — " + r.hrOnly.finalCandidate : "");
  if (r.approvalStatus !== "approved") return r.form.numPositions + " position(s) — pending approval";
  return r.form.numPositions + " position(s) — " + (rec || "Not started");
}

function renderDetail(id) {
  const r = findRequest(id);
  const pane = $("requests-detail-pane");
  if (!r) { pane.innerHTML = "<p>Request not found.</p>"; return; }
  const f = r.form;
  const target = computeTargetDate(r);

  pane.innerHTML =
    '<div class="detail-header">' +
    '<button class="btn btn-secondary btn-sm" id="btn-back-to-list">&larr; All requests</button>' +
    '<div class="grow"></div>' +
    '<div class="export-row">' +
    '<button class="btn btn-secondary btn-sm" id="btn-print">Print</button>' +
    '<button class="btn btn-secondary btn-sm" id="btn-export-pdf">Export PDF</button>' +
    '<button class="btn btn-secondary btn-sm" id="btn-export-docx">Export Word</button>' +
    '<button class="btn btn-secondary btn-sm" id="btn-export-xlsx">Export Excel</button>' +
    '<button class="btn btn-secondary btn-sm" id="btn-export-csv">Export CSV</button>' +
    "</div></div>" +

    '<div class="card"><div class="card-body">' +
    '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px;">' +
    "<div><h2 style=\"font-size:18px;\">" + escHtml(f.jobTitle || "Untitled position") + "</h2>" +
    '<p class="hint">' + escHtml(r.displayId || "—") + "</p></div>" +
    statusPillHtml(r.approvalStatus) +
    "</div>" +
    '<div class="summary-grid">' +
    summaryItem("Position", f.jobTitle) +
    summaryItem("Department", f.department === "Other" ? f.departmentOther : f.department) +
    summaryItem("Grade", f.jobGrade) +
    summaryItem("Hiring Type", f.requestType === "replacement" ? "Replacement" : "New Position") +
    summaryItem("Priority", f.priority) +
    summaryItem("Requested Date", fmtDate(f.submissionDate)) +
    summaryItem("Target Hiring Date", fmtDate(target)) +
    summaryItem("Expected Time to Fill", f.timeToFillValue + " " + f.timeToFillUnit.toLowerCase()) +
    summaryItem("Current Approval Status", STATUS_LABEL[r.approvalStatus]) +
    summaryItem("Final Requirement", finalRequirementText(r)) +
    "</div></div></div>" +

    sectionCard("Position Information", positionInfoRows(f)) +
    (f.requestType === "replacement" ? sectionCard("Replacement Details", replacementRows(f)) : sectionCard("New Position Justification", [["Business Justification", f.newPosJustification]])) +
    sectionCardCustom("Job Requirements",
      '<p style="font-weight:600; font-size:12.5px; color:var(--ink-soft); margin-bottom:4px;">Key Responsibilities</p>' +
      bulletList(f.responsibilities) +
      '<p style="font-weight:600; font-size:12.5px; color:var(--ink-soft); margin:12px 0 4px;">Required Qualifications</p>' +
      bulletList(f.qualifications) +
      (f.otherRequirements ? '<p style="font-weight:600; font-size:12.5px; color:var(--ink-soft); margin:12px 0 4px;">Other Requirements</p><p style="font-size:13px;">' + escHtml(f.otherRequirements) + "</p>" : "")
    ) +
    sectionCard("Timeline & Priority", [
      ["Submission Date", fmtDate(f.submissionDate)],
      ["Expected Time to Fill", f.timeToFillValue + " " + f.timeToFillUnit],
      ["Priority", f.priority],
      ["Business Impact if Delayed", f.businessImpact],
      ["Reason for Urgency", f.urgencyReason || "—"]
    ]) +
    sectionCard("Budget & Compensation", [
      ["Approved / Planned Budget", money(f.approvedBudget, f.currency)],
      ["Salary Range", money(f.salaryMin, f.currency) + " – " + money(f.salaryMax, f.currency)],
      ["Benefits / Allowances", f.benefits || "—"],
      ["In Approved Manpower Budget?", f.inBudget],
      ["Budget Justification", f.inBudget !== "Yes" ? (f.budgetJustification || "—") : "—"]
    ]) +

    renderApprovalsCard(r) +
    renderHrCard(r) +
    renderAuditCard(r);

  qs("#btn-back-to-list", pane).addEventListener("click", showListPane);
  qs("#btn-print", pane).addEventListener("click", () => printRequest(r));
  qs("#btn-export-pdf", pane).addEventListener("click", () => exportPdf(r));
  qs("#btn-export-docx", pane).addEventListener("click", () => exportDocx(r));
  qs("#btn-export-xlsx", pane).addEventListener("click", () => exportXlsx(r));
  qs("#btn-export-csv", pane).addEventListener("click", () => exportCsv(r));

  wireApprovalActions(r);
  wireHrForm(r);
}

function summaryItem(label, value) {
  return '<div class="summary-item"><span>' + escHtml(label) + "</span><strong>" + escHtml(value || "—") + "</strong></div>";
}
function sectionCard(title, rows) {
  return sectionCardCustom(title, '<table class="kv-table">' + rows.map((row) =>
    "<tr><td>" + escHtml(row[0]) + "</td><td>" + escHtml(row[1] || "—") + "</td></tr>"
  ).join("") + "</table>");
}
function sectionCardCustom(title, innerHtml) {
  return '<div class="card"><div class="card-head"><div><h2 style="font-size:15px;">' + escHtml(title) + "</h2></div></div>" +
    '<div class="card-body">' + innerHtml + "</div></div>";
}
function bulletList(arr) {
  if (!arr || !arr.length) return '<p class="hint">None provided.</p>';
  return '<ul class="bullet-list">' + arr.map((x) => "<li>" + escHtml(x) + "</li>").join("") + "</ul>";
}
function positionInfoRows(f) {
  return [
    ["Job Title", f.jobTitle],
    ["Department", f.department === "Other" ? f.departmentOther : f.department],
    ["Job Grade", f.jobGrade],
    ["Reporting To", f.reportingTo],
    ["Employment Type", f.employmentType],
    ["Work Location", f.workMode + " — " + f.workLocation],
    ["Positions Required", f.numPositions],
    ["Hiring Request Type", f.requestType === "replacement" ? "Replacement" : "New Position"]
  ];
}
function replacementRows(f) {
  return [
    ["Employee Being Replaced", f.replacementName],
    ["Reason for Replacement", f.replacementReason === "Other" ? f.replacementReasonOther : f.replacementReason],
    ["Expected Last Working Day", fmtDate(f.lastWorkingDay)]
  ];
}

/* ---- Approvals card ---- */
function approvalStepHtml(key, label, approval, opts) {
  approval = approval || {};
  const status = approval.status || "Pending";
  const canAct = opts.canAct;
  let body =
    '<div class="approval-step-head"><h4>' + escHtml(label) + "</h4>" +
    '<span class="pill pill-' + (status === "Approved" ? "approved" : status === "Rejected" ? "rejected" : "draft") + '">' + escHtml(status) + "</span></div>";
  if (approval.name) {
    body += '<div class="approval-meta">Signed by <strong>' + escHtml(approval.name) + "</strong> on " + fmtDate(approval.date) + (approval.comment ? " — “" + escHtml(approval.comment) + "”" : "") + "</div>";
    if (approval.signature) body += '<img src="' + approval.signature + '" alt="Signature of ' + escAttr(approval.name) + '" style="height:44px; margin-top:8px; filter:contrast(1.1);">';
  } else if (canAct) {
    body += '<div class="approval-sign-panel" id="sign-panel-' + key + '">' +
      '<p class="hint">Signing as <strong>' + escHtml(myProfile.full_name) + '</strong> (' + escHtml(opts.actingRoleLabel || "") + ')</p>' +
      '<div class="field" style="margin-top:8px;"><label for="sign-comment-' + key + '">Comment <span class="hint">(required to reject)</span></label><input type="text" id="sign-comment-' + key + '" placeholder="Optional note"></div>' +
      '<div class="field" style="margin-top:8px;"><label>Signature</label>' +
      '<div class="sig-wrap"><canvas class="sig-canvas" id="sign-canvas-' + key + '"></canvas><div class="sig-placeholder">Sign here</div></div>' +
      '<div class="sig-actions"><button type="button" class="btn btn-ghost btn-sm" data-clear-sig="step-' + key + '">Clear signature</button></div></div>' +
      '<div style="display:flex; gap:8px; margin-top:10px;">' +
      '<button class="btn btn-danger btn-sm" data-decision="reject" data-key="' + key + '">Reject</button>' +
      '<button class="btn btn-success btn-sm" data-decision="approve" data-key="' + key + '">Approve</button>' +
      "</div></div>";
  } else {
    body += '<div class="locked-note">' + (opts.lockedReason || "Waiting on an earlier approval step.") + "</div>";
  }
  return '<div class="approval-step">' + body + "</div>";
}

function renderApprovalsCard(r) {
  const roles = myProfile ? myProfile.roles : [];
  const a = r.approvals || {};
  const rmHtml = approvalStepHtml("rm", "Requesting Manager", a.requestingManager, { canAct: false });
  const hrCanAct = roles.includes("hr_manager") && r.approvalStatus === "pending_hr";
  const hrHtml = approvalStepHtml("hr", "HR Manager", a.hrManager, {
    canAct: hrCanAct,
    actingRoleLabel: ROLE_LABEL.hr_manager,
    lockedReason: r.approvalStatus === "pending_hr" ? "Sign in as HR Manager to act on this request." : (a.hrManager && a.hrManager.status ? "" : "Not reached yet.")
  });
  const finalCanAct = roles.includes("final_approver") && r.approvalStatus === "pending_final";
  const finalHtml = approvalStepHtml("final", "Final Management Approval", a.finalApproval, {
    canAct: finalCanAct,
    actingRoleLabel: ROLE_LABEL.final_approver,
    lockedReason: (r.approvalStatus === "pending_final") ? "Sign in as Final Approver to act on this request." : (a.finalApproval && a.finalApproval.status ? "" : "Waiting on HR Manager approval first.")
  });
  return sectionCardCustom("Approvals & Signatures", rmHtml + hrHtml + finalHtml);
}

function wireApprovalActions(r) {
  ["hr", "final"].forEach((key) => {
    const canvas = $("sign-canvas-" + key);
    if (canvas) {
      const pad = new SignaturePad(canvas, canvas.parentElement.querySelector(".sig-placeholder"));
      canvas._pad = pad;
      const clearBtn = qs('[data-clear-sig="step-' + key + '"]', $("requests-detail-pane"));
      if (clearBtn) clearBtn.addEventListener("click", () => pad.clear());
    }
  });
  qsa("[data-decision]", $("requests-detail-pane")).forEach((btn) => {
    btn.addEventListener("click", async () => {
      const key = btn.dataset.key;
      const decision = btn.dataset.decision;
      const commentEl = $("sign-comment-" + key);
      const canvas = $("sign-canvas-" + key);
      const pad = canvas && canvas._pad;
      const comment = commentEl ? commentEl.value.trim() : "";
      if (decision === "approve" && (!pad || pad.isEmpty())) { toast("Please sign before approving.", "danger"); return; }
      if (decision === "reject" && !comment) { toast("Please add a comment explaining the rejection.", "danger"); return; }
      await recordApprovalDecision(r.id, key, decision, comment, pad ? pad.toDataURL() : null);
    });
  });
}

async function recordApprovalDecision(reqId, stepKey, decision, comment, signature) {
  const { error } = await sb.rpc("record_approval_decision", {
    p_request_id: reqId, p_stage: stepKey, p_decision: decision, p_comment: comment, p_signature: signature
  });
  if (error) { toast(error.message || "Could not record the decision.", "danger"); return; }
  toast("Decision recorded.", "success");
  await refreshRequests();
  openDetail(reqId);
}

/* ---- HR-only card ---- */
function renderHrCard(r) {
  const editable = myProfile && myProfile.roles.includes("hr_admin");
  const h = r.hrOnly || {};
  const disabled = editable ? "" : "disabled";
  const body =
    '<div class="banner banner-info" style="margin-top:0; margin-bottom:14px;">HR Use Only — editable only by signed-in HR Admin accounts.</div>' +
    '<div class="field-grid">' +
    '<div class="field"><label>Request ID</label><input type="text" value="' + escAttr(r.displayId || "—") + '" disabled></div>' +
    '<div class="field"><label for="hr-dateReceived">Date Received by HR</label><input type="date" id="hr-dateReceived" value="' + escAttr(h.dateReceived || "") + '" ' + disabled + "></div>" +
    '<div class="field"><label for="hr-recruiter">Recruiter Assigned</label><input type="text" id="hr-recruiter" value="' + escAttr(h.recruiter || "") + '" ' + disabled + "></div>" +
    '<div class="field"><label for="hr-recruitmentStatus">Recruitment Status</label><select id="hr-recruitmentStatus" ' + disabled + ">" +
    ["Not Started", "Sourcing", "Interviewing", "Offer Stage", "Filled", "On Hold", "Cancelled"].map((o) =>
      "<option" + (h.recruitmentStatus === o ? " selected" : "") + ">" + o + "</option>").join("") + "</select></div>" +
    '<div class="field"><label for="hr-postingDate">Job Posting Date</label><input type="date" id="hr-postingDate" value="' + escAttr(h.postingDate || "") + '" ' + disabled + "></div>" +
    '<div class="field"><label for="hr-pipeline">Candidate Pipeline Status</label><input type="text" id="hr-pipeline" placeholder="e.g. 12 applied, 4 shortlisted" value="' + escAttr(h.pipeline || "") + '" ' + disabled + "></div>" +
    '<div class="field"><label for="hr-dateFilled">Date Position Filled</label><input type="date" id="hr-dateFilled" value="' + escAttr(h.dateFilled || "") + '" ' + disabled + "></div>" +
    '<div class="field"><label>Actual Time to Fill</label><input type="text" value="' + escAttr(actualTimeToFill(r)) + '" disabled></div>' +
    '<div class="field"><label for="hr-finalCandidate">Final Candidate</label><input type="text" id="hr-finalCandidate" value="' + escAttr(h.finalCandidate || "") + '" ' + disabled + "></div>" +
    "</div>" +
    '<div class="field" style="margin-top:14px;"><label for="hr-notes">Notes / HR Comments</label><textarea id="hr-notes" ' + disabled + ">" + escHtml(h.notes || "") + "</textarea></div>" +
    (editable ? '<div style="margin-top:14px;"><button class="btn btn-primary btn-sm" id="btn-save-hr">Save HR Details</button></div>' : "");
  return sectionCardCustom("HR Use Only", body);
}
function actualTimeToFill(r) {
  const h = r.hrOnly || {};
  if (!h.dateFilled || !r.submittedAt) return "—";
  const start = new Date(r.submittedAt);
  const end = new Date(h.dateFilled + "T00:00:00");
  const days = Math.round((end - start) / 86400000);
  return days >= 0 ? days + " days" : "—";
}
function wireHrForm(r) {
  const btn = $("btn-save-hr");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const hrOnly = {
      dateReceived: $("hr-dateReceived").value,
      recruiter: $("hr-recruiter").value.trim(),
      recruitmentStatus: $("hr-recruitmentStatus").value,
      postingDate: $("hr-postingDate").value,
      pipeline: $("hr-pipeline").value.trim(),
      dateFilled: $("hr-dateFilled").value,
      finalCandidate: $("hr-finalCandidate").value.trim(),
      notes: $("hr-notes").value.trim()
    };
    const { error } = await sb.rpc("save_hr_details", { p_request_id: r.id, p_hr_only: hrOnly });
    if (error) { toast(error.message || "Could not save HR details.", "danger"); return; }
    toast("HR details saved.", "success");
    await refreshRequests();
    openDetail(r.id);
  });
}

/* ---- Audit trail ---- */
function renderAuditCard(r) {
  const items = (r.audit || []).slice().reverse();
  const html = !items.length ? '<p class="hint">No activity recorded yet.</p>' :
    '<div class="audit-list">' + items.map((a) =>
      '<div class="audit-item"><div class="audit-dot"></div><div><div class="audit-text">' + escHtml(a.action) +
      " — <strong>" + escHtml(a.actor || "") + "</strong></div><div class=\"audit-time\">" + fmtDateTime(a.ts) + "</div></div></div>"
    ).join("") + "</div>";
  return sectionCardCustom("Activity & Audit Trail", html);
}

/* ===================================================================== */
/* Notifications                                                         */
/* ===================================================================== */
function pendingForRole(role) {
  return state.requests.filter((r) => {
    if (role === "hr_manager") return r.approvalStatus === "pending_hr";
    if (role === "final_approver") return r.approvalStatus === "pending_final";
    if (role === "hr_admin") return r.approvalStatus === "approved" && (!r.hrOnly || !r.hrOnly.recruitmentStatus || r.hrOnly.recruitmentStatus === "Not Started");
    return false;
  });
}
function pendingForRoles(roles) {
  const seen = new Set();
  const out = [];
  (roles || []).forEach((role) => {
    pendingForRole(role).forEach((r) => {
      if (!seen.has(r.id)) { seen.add(r.id); out.push(r); }
    });
  });
  return out;
}
function renderNotifications() {
  const list = myProfile ? pendingForRoles(myProfile.roles) : [];
  $("bell-dot").classList.toggle("hidden", list.length === 0);
  $("bell-dot").textContent = list.length > 9 ? "9+" : String(list.length);
  const panel = $("bell-panel");
  panel.innerHTML = '<h4>Needs your attention</h4>' +
    (list.length ? list.map((r) =>
      '<button class="bell-item" data-id="' + r.id + '"><strong>' + escHtml(r.form.jobTitle) + "</strong><br><span class=\"hint\">" + escHtml(r.displayId || "") + "</span></button>"
    ).join("") : '<div class="bell-empty">' + (myProfile ? "Nothing needs action right now." : "Sign in to see items needing your attention.") + '</div>');
  qsa(".bell-item", panel).forEach((b) => b.addEventListener("click", () => {
    panel.classList.add("hidden");
    switchView("requests");
    openDetail(b.dataset.id);
  }));
}

/* ===================================================================== */
/* Row mapping (Supabase snake_case -> app's camelCase model)            */
/* ===================================================================== */
function mapRow(row) {
  return {
    id: row.id,
    displayId: row.display_id,
    status: row.status,
    approvalStatus: row.approval_status,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    form: row.form || {},
    approvals: row.approvals || {},
    hrOnly: row.hr_only || {},
    audit: row.audit || []
  };
}
function findRequest(id) { return state.requests.find((r) => r.id === id); }

/* ===================================================================== */
/* Refresh / realtime                                                    */
/* ===================================================================== */
async function refreshRequests() {
  if (!configured || !myProfile) {
    state.requests = [];
    renderNotifications();
    if (state.view === "requests" && !state.detailId) renderRequestGrid();
    return;
  }
  const { data, error } = await sb.from("requests").select("*").order("updated_at", { ascending: false }).limit(500);
  if (error) { console.warn(error); return; }
  state.requests = (data || []).map(mapRow);
  renderNotifications();
  if (state.view === "requests") {
    if (state.detailId && findRequest(state.detailId)) renderDetail(state.detailId);
    else renderRequestGrid();
  }
}

function subscribeRealtime() {
  if (!configured || realtimeChannel) return;
  realtimeChannel = sb.channel("requests-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () => { refreshRequests(); })
    .subscribe();
}

/* ===================================================================== */
/* Report data builder — shared by print / PDF / Word / Excel / CSV      */
/* ===================================================================== */
function buildReportSections(r) {
  const f = r.form;
  const sections = [];
  sections.push({ heading: "Position Information", rows: positionInfoRows(f) });
  if (f.requestType === "replacement") sections.push({ heading: "Replacement Details", rows: replacementRows(f) });
  else sections.push({ heading: "New Position Justification", rows: [["Business Justification", f.newPosJustification]] });
  sections.push({ heading: "Key Responsibilities", bullets: f.responsibilities });
  sections.push({ heading: "Required Qualifications", bullets: f.qualifications });
  if (f.otherRequirements) sections.push({ heading: "Other Requirements", rows: [["Details", f.otherRequirements]] });
  sections.push({
    heading: "Timeline & Priority", rows: [
      ["Submission Date", fmtDate(f.submissionDate)],
      ["Target Hiring Date", fmtDate(computeTargetDate(r))],
      ["Expected Time to Fill", f.timeToFillValue + " " + f.timeToFillUnit],
      ["Priority", f.priority],
      ["Business Impact if Delayed", f.businessImpact],
      ["Reason for Urgency", f.urgencyReason || "—"]
    ]
  });
  sections.push({
    heading: "Budget & Compensation", rows: [
      ["Approved / Planned Budget", money(f.approvedBudget, f.currency)],
      ["Salary Range", money(f.salaryMin, f.currency) + " – " + money(f.salaryMax, f.currency)],
      ["Benefits / Allowances", f.benefits || "—"],
      ["In Approved Manpower Budget?", f.inBudget],
      ["Budget Justification", f.inBudget !== "Yes" ? (f.budgetJustification || "—") : "—"]
    ]
  });
  const a = r.approvals || {};
  sections.push({
    heading: "Approvals & Signatures", table: [
      ["Role", "Name", "Status", "Date"],
      ["Requesting Manager", (a.requestingManager && a.requestingManager.name) || "—", (a.requestingManager && a.requestingManager.status) || "Pending", fmtDate(a.requestingManager && a.requestingManager.date)],
      ["HR Manager", (a.hrManager && a.hrManager.name) || "—", (a.hrManager && a.hrManager.status) || "Pending", fmtDate(a.hrManager && a.hrManager.date)],
      ["Final Management", (a.finalApproval && a.finalApproval.name) || "—", (a.finalApproval && a.finalApproval.status) || "Pending", fmtDate(a.finalApproval && a.finalApproval.date)]
    ]
  });
  const h = r.hrOnly || {};
  sections.push({
    heading: "HR Use Only", rows: [
      ["Request ID", r.displayId || "—"], ["Date Received by HR", fmtDate(h.dateReceived)],
      ["Recruiter Assigned", h.recruiter || "—"], ["Recruitment Status", h.recruitmentStatus || "Not Started"],
      ["Job Posting Date", fmtDate(h.postingDate)], ["Candidate Pipeline Status", h.pipeline || "—"],
      ["Date Position Filled", fmtDate(h.dateFilled)], ["Actual Time to Fill", actualTimeToFill(r)],
      ["Final Candidate", h.finalCandidate || "—"], ["Notes", h.notes || "—"]
    ]
  });
  return sections;
}

/* ===================================================================== */
/* Print                                                                 */
/* ===================================================================== */
function printRequest(r) {
  const sections = buildReportSections(r);
  let html = '<div class="print-doc"><div class="print-head"><img src="' + COMPANY.logoDataUri + '" alt="' + escAttr(COMPANY.name) + '"><div>' +
    "<h1 style=\"font-size:17px; margin:0;\">Hiring Request — " + escHtml(r.displayId || "Draft") + "</h1>" +
    '<p style="font-size:11.5px; color:#666; margin-top:2px;">' + escHtml(COMPANY.name) + " &middot; Generated " + fmtDateTime(nowStamp()) + "</p></div></div>";
  sections.forEach((s) => {
    html += "<h2>" + escHtml(s.heading) + "</h2>";
    if (s.rows) html += "<table>" + s.rows.map((row) => "<tr><td>" + escHtml(row[0]) + "</td><td>" + escHtml(row[1] || "—") + "</td></tr>").join("") + "</table>";
    if (s.bullets) html += (s.bullets.length ? "<ul>" + s.bullets.map((b) => "<li>" + escHtml(b) + "</li>").join("") + "</ul>" : "<p>None provided.</p>");
    if (s.table) html += "<table>" + s.table.map((row, i) => "<tr>" + row.map((c) => (i === 0 ? "<td style=\"font-weight:700; background:#f2f3f8;\">" : "<td>") + escHtml(c) + "</td>").join("") + "</tr>").join("") + "</table>";
  });
  html += "</div>";
  $("printArea").innerHTML = html;
  setTimeout(() => window.print(), 60);
}

/* ===================================================================== */
/* Downloads — plain browser Blob download (no sandbox to work around)   */
/* ===================================================================== */
function downloadBlob(filename, blobOrString, mime) {
  const blob = blobOrString instanceof Blob ? blobOrString : new Blob([blobOrString], { type: mime || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast("Downloaded " + filename, "success");
}

/* ===================================================================== */
/* Export: CSV                                                           */
/* ===================================================================== */
function csvEscape(v) {
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function exportCsv(r) {
  const sections = buildReportSections(r);
  const lines = [["Section", "Field", "Value"]];
  sections.forEach((s) => {
    if (s.rows) s.rows.forEach((row) => lines.push([s.heading, row[0], row[1]]));
    if (s.bullets) s.bullets.forEach((b, i) => lines.push([s.heading, "Item " + (i + 1), b]));
    if (s.table) s.table.slice(1).forEach((row) => lines.push([s.heading, row[0], row.slice(1).join(" / ")]));
  });
  const csv = lines.map((l) => l.map(csvEscape).join(",")).join("\r\n");
  downloadBlob((r.displayId || "hiring-request-draft") + ".csv", "﻿" + csv, "text/csv;charset=utf-8");
}

/* ===================================================================== */
/* Export: Excel (SheetJS)                                               */
/* ===================================================================== */
function exportXlsx(r) {
  if (typeof XLSX === "undefined") { toast("Excel export library did not load — check your connection and try again.", "danger"); return; }
  const sections = buildReportSections(r);
  const wb = XLSX.utils.book_new();
  const summary = [["Field", "Value"],
    ["Request ID", r.displayId || "Draft"], ["Position", r.form.jobTitle], ["Department", r.form.department],
    ["Grade", r.form.jobGrade], ["Hiring Type", r.form.requestType === "replacement" ? "Replacement" : "New Position"],
    ["Priority", r.form.priority], ["Requested Date", r.form.submissionDate], ["Target Hiring Date", computeTargetDate(r)],
    ["Expected Time to Fill", r.form.timeToFillValue + " " + r.form.timeToFillUnit],
    ["Current Approval Status", STATUS_LABEL[r.approvalStatus]],
    ["Final Requirement", finalRequirementText(r)]];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");
  sections.forEach((s) => {
    let aoa = [];
    if (s.rows) aoa = s.rows;
    else if (s.bullets) aoa = s.bullets.map((b, i) => ["Item " + (i + 1), b]);
    else if (s.table) aoa = s.table;
    const name = s.heading.replace(/[\\/*?:\[\]]/g, "").slice(0, 31) || "Sheet";
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  });
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob((r.displayId || "hiring-request-draft") + ".xlsx", new Blob([wbout], { type: "application/octet-stream" }));
}

/* ===================================================================== */
/* Export: PDF (jsPDF)                                                   */
/* ===================================================================== */
function exportPdf(r) {
  if (typeof window.jspdf === "undefined") { toast("PDF export library did not load — check your connection and try again.", "danger"); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 42;
  let y = 40;

  function ensureSpace(h) {
    if (y + h > pageH - 36) { doc.addPage(); y = 40; }
  }
  try {
    const logoW = 92, logoH = logoW * COMPANY.logoAspect;
    doc.addImage(COMPANY.logoDataUri, "PNG", marginX, y, logoW, logoH);
  } catch (e) {}
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(31, 42, 86);
  doc.text("Hiring Request — " + (r.displayId || "Draft"), marginX + 106, y + 22);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(110, 110, 120);
  doc.text(COMPANY.name + "  ·  Generated " + fmtDateTime(nowStamp()), marginX + 106, y + 38);
  y += 62;

  function drawHeading(text) {
    ensureSpace(24);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11.5); doc.setTextColor(49, 64, 140);
    doc.text(text, marginX, y);
    y += 8;
    doc.setDrawColor(220, 222, 232); doc.line(marginX, y, pageW - marginX, y);
    y += 14;
  }
  function drawRows(rows) {
    const colA = 150, colB = pageW - marginX * 2 - colA;
    rows.forEach((row) => {
      const label = String(row[0] || "");
      const value = String(row[1] == null || row[1] === "" ? "—" : row[1]);
      const lines = doc.splitTextToSize(value, colB);
      const rowH = Math.max(14, lines.length * 12 + 4);
      ensureSpace(rowH);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(90, 93, 105);
      doc.text(label, marginX, y + 9);
      doc.setFont("helvetica", "normal"); doc.setTextColor(21, 22, 26);
      doc.text(lines, marginX + colA, y + 9);
      y += rowH;
    });
    y += 6;
  }
  function drawBullets(items) {
    if (!items.length) { drawRows([["", "None provided."]]); return; }
    items.forEach((it) => {
      const lines = doc.splitTextToSize("• " + it, pageW - marginX * 2 - 6);
      const h = lines.length * 12 + 2;
      ensureSpace(h);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(21, 22, 26);
      doc.text(lines, marginX, y + 9);
      y += h;
    });
    y += 6;
  }
  function drawTable(table) {
    const widths = [140, 140, 90, 90];
    const startX = marginX;
    table.forEach((row, ri) => {
      const rowH = 18;
      ensureSpace(rowH);
      let x = startX;
      if (ri === 0) { doc.setFillColor(234, 237, 250); doc.rect(startX, y, widths.reduce((a, b) => a + b, 0), rowH, "F"); }
      row.forEach((cell, ci) => {
        doc.setDrawColor(217, 219, 227);
        doc.rect(x, y, widths[ci], rowH);
        doc.setFont("helvetica", ri === 0 ? "bold" : "normal"); doc.setFontSize(8.5);
        doc.setTextColor(ri === 0 ? 49 : 21, ri === 0 ? 64 : 22, ri === 0 ? 140 : 26);
        doc.text(String(cell), x + 5, y + 12, { maxWidth: widths[ci] - 8 });
        x += widths[ci];
      });
      y += rowH;
    });
    y += 8;
  }

  const sections = buildReportSections(r);
  sections.forEach((s) => {
    drawHeading(s.heading);
    if (s.rows) drawRows(s.rows);
    if (s.bullets) drawBullets(s.bullets);
    if (s.table) drawTable(s.table);
  });

  downloadBlob((r.displayId || "hiring-request-draft") + ".pdf", doc.output("blob"));
}

/* ===================================================================== */
/* Export: Word (.docx) — hand-built OOXML via JSZip, verified structure */
/* ===================================================================== */
function docxP(text, opts) {
  opts = opts || {};
  const rPr = [];
  if (opts.bold) rPr.push("<w:b/>");
  if (opts.size) rPr.push('<w:sz w:val="' + opts.size * 2 + '"/>');
  if (opts.color) rPr.push('<w:color w:val="' + opts.color + '"/>');
  const rPrXml = rPr.length ? "<w:rPr>" + rPr.join("") + "</w:rPr>" : "";
  const pPr = [];
  if (opts.spacingBefore || opts.spacingAfter) pPr.push('<w:spacing w:before="' + (opts.spacingBefore || 0) * 20 + '" w:after="' + (opts.spacingAfter || 0) * 20 + '"/>');
  const pPrXml = pPr.length ? "<w:pPr>" + pPr.join("") + "</w:pPr>" : "";
  const lines = String(text == null ? "" : text).split("\n");
  const runs = lines.map((line, i) => (i > 0 ? "<w:br/>" : "") + '<w:t xml:space="preserve">' + xmlEsc(line) + "</w:t>").join("");
  return "<w:p>" + pPrXml + "<w:r>" + rPrXml + runs + "</w:r></w:p>";
}
function docxTable(rows, widths) {
  widths = widths || [3000, 6500];
  const trs = rows.map((row, ri) => {
    const tcs = row.map((cell, ci) => {
      const shade = ri === 0 ? '<w:shd w:val="clear" w:fill="EAEDFA"/>' : "";
      return '<w:tc><w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/>' + shade + "</w:tcPr>" +
        docxP(cell, { bold: ri === 0 }) + "</w:tc>";
    }).join("");
    return "<w:tr>" + tcs + "</w:tr>";
  }).join("");
  return '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>' +
    ["top", "left", "bottom", "right", "insideH", "insideV"].map((b) => "<w:" + b + ' w:val="single" w:sz="4" w:space="0" w:color="D9DBE3"/>').join("") +
    "</w:tblBorders></w:tblPr><w:tblGrid>" + widths.map((w) => '<w:gridCol w:w="' + w + '"/>').join("") + "</w:tblGrid>" + trs + "</w:tbl>";
}
function dataUriToUint8Array(dataUri) {
  const base64 = dataUri.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
async function exportDocx(r) {
  if (typeof JSZip === "undefined") { toast("Word export library did not load — check your connection and try again.", "danger"); return; }
  const zip = new JSZip();
  zip.file("[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="png" ContentType="image/png"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    "</Types>");
  zip.file("_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    "</Relationships>");
  zip.file("word/_rels/document.xml.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>' +
    "</Relationships>");
  zip.file("word/media/logo.png", dataUriToUint8Array(COMPANY.logoDataUri));

  const maxWidthIn = 1.5;
  const cx = Math.round(maxWidthIn * 914400);
  const cy = Math.round(cx * COMPANY.logoAspect);
  const logoDrawing = "<w:p><w:r><w:drawing><wp:inline distT=\"0\" distB=\"0\" distL=\"0\" distR=\"0\">" +
    '<wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="1" name="Logo"/>' +
    '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr>' +
    '<pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
    '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>' +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';

  const sections = buildReportSections(r);
  const bodyParts = [];
  bodyParts.push(docxP("Hiring Request — " + (r.displayId || "Draft"), { bold: true, size: 18, color: "1F2A56", spacingAfter: 2 }));
  bodyParts.push(docxP(COMPANY.name + "  ·  Generated " + fmtDateTime(nowStamp()), { size: 9, color: "6B6E79", spacingAfter: 10 }));
  sections.forEach((s) => {
    bodyParts.push(docxP(s.heading, { bold: true, size: 12.5, color: "1F2A56", spacingBefore: 10, spacingAfter: 4 }));
    if (s.rows) bodyParts.push(docxTable([["Field", "Value"]].concat(s.rows.map((row) => [row[0], row[1] == null || row[1] === "" ? "—" : String(row[1])]))));
    if (s.bullets) bodyParts.push(docxP(s.bullets.length ? s.bullets.map((b) => "•  " + b).join("\n") : "None provided."));
    if (s.table) bodyParts.push(docxTable(s.table, [2600, 2600, 2000, 1800]));
  });

  const doc =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    "<w:body>" + logoDrawing + bodyParts.join("") +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>' +
    "</w:body></w:document>";
  zip.file("word/document.xml", doc);

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob((r.displayId || "hiring-request-draft") + ".docx", blob);
}

/* ===================================================================== */
/* Wiring / init                                                         */
/* ===================================================================== */
function wireStaticEvents() {
  $("tab-new").addEventListener("click", () => {
    if (state.dirty) {
      openModal({
        title: "Discard unsaved changes?",
        body: "Switching tabs will not save your current edits. Save as a draft first if you want to keep them.",
        confirmLabel: "Continue without saving", danger: true,
        onConfirm: () => switchView("new")
      });
    } else switchView("new");
  });
  $("tab-requests").addEventListener("click", () => switchView("requests"));
  $("btn-new-from-list").addEventListener("click", () => { clearFormToBlank(); switchView("new"); });
  $("btn-resume-draft").addEventListener("click", resumeDraft);
  $("btn-sign-in-gate").addEventListener("click", openSignInModal);

  $("bell-btn").addEventListener("click", () => $("bell-panel").classList.toggle("hidden"));
  document.addEventListener("click", (e) => {
    if (!$("bell-panel").contains(e.target) && e.target !== $("bell-btn") && !$("bell-btn").contains(e.target)) $("bell-panel").classList.add("hidden");
  });

  qsa('input[name="requestType"]').forEach((r) => r.addEventListener("change", () => { updateConditionalVisibility(); markDirty(); }));
  qsa('input[name="inBudget"]').forEach((r) => r.addEventListener("change", () => { updateConditionalVisibility(); markDirty(); }));
  $("f-department").addEventListener("change", () => { updateConditionalVisibility(); markDirty(); });
  $("f-replacementReason").addEventListener("change", () => { updateConditionalVisibility(); markDirty(); });
  qsa("#view-new input, #view-new select, #view-new textarea").forEach((el) => el.addEventListener("input", markDirty));

  qsa("[data-add]").forEach((btn) => btn.addEventListener("click", () => {
    (btn.dataset.add === "responsibilities" ? respList : qualList).addRow("");
    markDirty();
  }));

  qsa('[data-clear-sig="rm"]').forEach((b) => b.addEventListener("click", () => { rmPad.clear(); markDirty(); }));

  $("btn-reset").addEventListener("click", () => {
    openModal({
      title: "Reset this form?",
      body: "All fields will be cleared back to blank. This cannot be undone.",
      confirmLabel: "Reset form", danger: true,
      onConfirm: () => { clearFormToBlank(); toast("Form reset."); }
    });
  });
  $("btn-cancel").addEventListener("click", () => {
    if (!state.dirty) { switchView("requests"); return; }
    openModal({
      title: "Discard this request?",
      body: "You have unsaved changes. Leaving now will discard them unless you save a draft first.",
      confirmLabel: "Discard and leave", danger: true,
      onConfirm: () => { clearFormToBlank(); switchView("requests"); }
    });
  });
  $("btn-save-draft").addEventListener("click", () => saveDraft().catch((e) => { console.error(e); toast("Could not save the draft.", "danger"); }));
  $("btn-submit").addEventListener("click", () => submitRequest().catch((e) => { console.error(e); toast("Could not submit the request.", "danger"); }));

  $("filter-search").addEventListener("input", (e) => { state.filters.search = e.target.value; renderRequestGrid(); });
  $("filter-status").addEventListener("change", (e) => { state.filters.status = e.target.value; renderRequestGrid(); });
  $("filter-priority").addEventListener("change", (e) => { state.filters.priority = e.target.value; renderRequestGrid(); });
}

function setTodayDefaults() {
  $("f-submissionDate").value = todayISO();
}

async function init() {
  $("logo-img").src = COMPANY.logoDataUri;
  respList = createDynamicList("list-responsibilities", "e.g. Own end-to-end delivery of…");
  qualList = createDynamicList("list-qualifications", "e.g. 5+ years of experience in…");
  rmPad = new SignaturePad($("sig-rm"), $("sig-rm-placeholder"));

  initSupabase();
  if (!configured) {
    const banner = document.createElement("div");
    banner.className = "banner banner-warn";
    banner.style.marginTop = "14px";
    banner.innerHTML = "<span>&#9888;</span><div><strong>Not connected yet.</strong> Add your Supabase project URL and anon key to config.js, then reload this page. See README.md.</div>";
    $("view-new").insertBefore(banner, $("view-new").firstChild);
  } else {
    sb.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") { enterPasswordRecoveryMode(); return; }
      refreshAuthState();
    });
    subscribeRealtime();
  }

  clearFormToBlank();
  setTodayDefaults();
  wireStaticEvents();
  renderAuthArea();
  checkForResumableDraft();
  await refreshAuthState();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
