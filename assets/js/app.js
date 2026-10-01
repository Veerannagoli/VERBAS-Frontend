(() => {
  const API = (window.VERBAS_CONFIG?.API_BASE || "").replace(/\/$/, "");
  const state = { csrf: null, role: null, user: null };

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];

  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }
  function fmtTime(v) {
    if (!v) return "—";
    const d = new Date(v);
    return isNaN(d) ? v : d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  }
  function fmtDate(v) {
    if (!v) return "—";
    const d = new Date(v + (String(v).length===10 ? "T00:00:00" : ""));
    return isNaN(d) ? v : d.toLocaleDateString([], {day:'2-digit', month:'short', year:'numeric'});
  }
  function today() { return new Date().toISOString().slice(0,10); }

  function toast(message, type="info") {
    let box = $("#toastBox");
    if (!box) { box=document.createElement("div"); box.id="toastBox"; document.body.appendChild(box); }
    const el=document.createElement("div");
    el.className=`toast toast-${type}`;
    el.innerHTML=`<strong>${esc(message)}</strong><button aria-label="Close">×</button>`;
    $("button",el).onclick=()=>el.remove();
    box.appendChild(el);
    setTimeout(()=>el.remove(),5000);
  }

  async function request(path, opts={}) {
    const headers = new Headers(opts.headers || {});
    if (opts.body && typeof opts.body === "object" && !(opts.body instanceof FormData)) {
      headers.set("Content-Type","application/json");
      opts.body=JSON.stringify(opts.body);
    }
    if (["POST","PUT","PATCH","DELETE"].includes((opts.method||"GET").toUpperCase()) && !path.endsWith("/auth/login") && !path.endsWith("/auth/csrf")) {
      if (!state.csrf) await getCsrf();
      headers.set("X-CSRF-Token", state.csrf || "");
    }
    const res=await fetch(API+path,{...opts,headers,credentials:"include"});
    let data=null; try { data=await res.json(); } catch {}
    if (!res.ok) {
      if (res.status===401) {
        state.csrf=null; state.role=null; state.user=null;
      }
      const err=new Error(data?.message || `Request failed (${res.status})`);
      err.status=res.status; err.data=data;
      throw err;
    }
    return data;
  }

  async function getCsrf() {
    const d=await request("/api/auth/csrf");
    state.csrf=d.csrf_token;
    return d;
  }

  async function me() {
    try {
      const d=await request("/api/auth/me");
      state.role=d.role; state.user=d.user;
      return d;
    } catch { return null; }
  }

  async function logout() {
    try { await request("/api/auth/logout",{method:"POST"}); } catch {}
    location.hash="#/login";
  }

  function shell(title, body, opts={}) {
    const admin=opts.admin;
    return `
      <div class="dashboard-shell ${admin?'admin-shell':''}">
        <header class="topbar">
          <a class="brand" href="#/${admin?'admin':'employee'}">
            <span class="brand-mark">VB</span>
            <span><strong>VERBAS</strong><small>${admin?'Admin Control Center':'Employee Workspace'}</small></span>
          </a>
          <div class="topbar-right">
            ${admin ? '<span class="admin-pill">ADMIN</span>' :
              `<div class="user-chip"><span class="avatar">${esc((state.user?.name||"?").slice(0,1).toUpperCase())}</span><span><strong>${esc(state.user?.name||"Employee")}</strong><small>${esc(state.user?.designation||"")}</small></span></div>`}
            <button class="btn btn-ghost btn-sm" id="logoutBtn">Logout</button>
          </div>
        </header>
        ${admin ? `<div class="admin-layout">
          <aside class="sidebar">
            <div class="sidebar-label">CONTROL CENTER</div>
            <a class="side-link active" href="#/admin"><span>▦</span> Dashboard</a>
            <a class="side-link" href="#/employees"><span>♙</span> Employees</a>
            <a class="side-link" href="#/admin#attendance"><span>◉</span> Attendance</a>
            <a class="side-link" href="#/admin#notes"><span>✎</span> Meeting Notes</a>
            <div class="sidebar-bottom"><div class="secure-mini">✓ <span>Protected admin session<br><small>Database authenticated</small></span></div></div>
          </aside>
          <main class="content admin-content">${body}</main>
        </div>` : `<main class="content employee-content">${body}</main>`}
      </div>`;
  }

  async function renderLogin(admin=false) {
    document.title = `${admin?'Admin Login':'Employee Login'} · VERBAS`;
    document.body.innerHTML=`
      <div class="auth-page">
        <div class="auth-card fade-up">
          <div class="auth-brand"><span class="brand-mark">VB</span><div><strong>VERBAS</strong><small>${admin?'Admin Control Center':'Employee Workspace'}</small></div></div>
          <div class="eyebrow">${admin?'SECURE ADMIN ACCESS':'EMPLOYEE ACCESS'}</div>
          <h1>${admin?'Welcome back':'Welcome to VERBAS'}</h1>
          <p class="muted">${admin?'Sign in to manage your team, attendance and work reports.':'Sign in to access your attendance and daily work.'}</p>
          <form id="loginForm" class="stack-form">
            <label>Email<input id="email" type="email" autocomplete="username" placeholder="name@verbas.in" required></label>
            <label>Password<input id="password" type="password" autocomplete="current-password" placeholder="Your password" required></label>
            <button class="btn btn-primary btn-wide" type="submit">Sign in securely</button>
          </form>
          <div class="auth-footer">${admin?'Employee login → <a href="#/login">Sign in as employee</a>':'Admin access → <a href="#/admin-login">Admin login</a>'}</div>
        </div>
      </div>`;
    $("#loginForm").onsubmit=async e=>{
      e.preventDefault();
      const btn=$("button",e.target); btn.disabled=true; btn.textContent="Signing in…";
      try {
        const d=await request("/api/auth/login",{method:"POST",body:{email:$("#email").value,password:$("#password").value,role:admin?"admin":"employee"}});
        state.csrf=d.csrf_token; state.role=d.role; state.user=d.user;
        toast("Signed in successfully","success");
        location.hash=admin?"#/admin":"#/employee";
      } catch(err) { toast(err.message,"error"); }
      finally { btn.disabled=false; btn.textContent="Sign in securely"; }
    };
  }

  async function renderEmployee() {
    const d=await request("/api/employee/dashboard");
    const a=d.attendance, w=d.work;
    document.title="Employee Dashboard · VERBAS";
    const body=`
      <section class="page-intro">
        <div><div class="eyebrow">YOUR WORKSPACE</div><h1>Good day, ${esc((d.employee.name||"").split(" ")[0])} 👋</h1><p>Your attendance and daily work for ${fmtDate(d.today)}.</p></div>
        <div class="date-chip">Today · ${fmtDate(d.today)}</div>
      </section>
      <section class="stat-grid four">
        <div class="stat-card"><div class="stat-label">Today's Attendance</div><div class="stat-value">${esc(a?.status||"Not marked")}</div><div class="stat-foot">${fmtTime(a?.check_in)}</div></div>
        <div class="stat-card"><div class="stat-label">Check-in</div><div class="stat-value">${fmtTime(a?.check_in)}</div><div class="stat-foot">Recorded by system</div></div>
        <div class="stat-card"><div class="stat-label">Check-out</div><div class="stat-value">${fmtTime(a?.check_out)}</div><div class="stat-foot">${a?.check_out?'Workday completed':'Available after work entry'}</div></div>
        <div class="stat-card"><div class="stat-label">Today's Progress</div><div class="stat-value">${w?.progress||0}%</div><div class="progress-track"><span style="width:${w?.progress||0}%"></span></div></div>
      </section>
      <div class="two-col employee-main">
        <section class="panel" id="attendance">
          <div class="panel-head"><div><div class="eyebrow">SECURE ATTENDANCE</div><h2>Today's attendance</h2></div><span class="live-dot">Live</span></div>
          ${!a ? `<div class="checkin-box"><div class="big-symbol">◎</div><h3>Check in for today</h3><p>Ask your admin for the current six-digit attendance code.</p>
            <form id="checkinForm" class="code-form"><input id="attendanceCode" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="000000" required><button class="btn btn-primary">Check In</button></form></div>`
          : `<div class="attendance-confirm"><div class="success-circle">✓</div><div><strong>You're checked in</strong><p>${fmtTime(a.check_in)} · ${esc(a.status)}</p></div></div>
             ${!a.check_out ? `<button class="btn btn-dark btn-wide" id="checkoutBtn">Check Out</button>` : `<div class="completed-banner">✓ Workday completed · ${fmtTime(a.check_out)}</div>`}`}
        </section>
        <section class="panel">
          <div class="panel-head"><div><div class="eyebrow">DAILY WORK</div><h2>Record today's work</h2></div><span class="panel-index">01</span></div>
          <form id="workForm" class="stack-form">
            <label>Work / Task Title<input id="workTitle" value="${esc(w?.work_title||"")}" required></label>
            <label>What did you work on today?<textarea id="workDescription" rows="4" required>${esc(w?.work_description||"")}</textarea></label>
            <div class="form-row"><label class="grow">Progress <output id="progressOutput">${w?.progress||0}%</output><input id="progressRange" type="range" min="0" max="100" value="${w?.progress||0}"></label>
            <label class="grow">Status<select id="workStatus"><option ${w?.status==="Not Started"?"selected":""}>Not Started</option><option ${w?.status==="In Progress"?"selected":""}>In Progress</option><option ${w?.status==="Completed"?"selected":""}>Completed</option></select></label></div>
            <label>Blockers <textarea id="blockers" rows="2">${esc(w?.blockers||"")}</textarea></label>
            <label>Tomorrow's plan <textarea id="tomorrow" rows="2">${esc(w?.tomorrow_plan||"")}</textarea></label>
            <button class="btn btn-primary" type="submit">Save Work Entry</button>
          </form>
        </section>
      </div>
      <section class="panel"><div class="panel-head"><div><div class="eyebrow">HISTORY</div><h2>Recent Work</h2></div></div>
        ${d.history.length?`<div class="table-wrap"><table><thead><tr><th>Date</th><th>Task</th><th>Status</th><th>Progress</th></tr></thead><tbody>${d.history.map(x=>`<tr><td>${fmtDate(x.work_date)}</td><td><strong>${esc(x.work_title)}</strong><small>${esc(x.work_description).slice(0,100)}</small></td><td>${esc(x.status)}</td><td>${x.progress}%</td></tr>`).join("")}</tbody></table></div>`:'<div class="empty-state"><strong>No work history yet.</strong></div>'}
      </section>`;
    document.body.innerHTML=shell("Employee Dashboard",body);
    bindCommon();
    $("#progressRange").oninput=e=>$("#progressOutput").textContent=e.target.value+"%";
    $("#workForm").onsubmit=async e=>{
      e.preventDefault();
      try { await request("/api/employee/work",{method:"POST",body:{work_title:$("#workTitle").value,work_description:$("#workDescription").value,progress:+$("#progressRange").value,status:$("#workStatus").value,blockers:$("#blockers").value,tomorrow_plan:$("#tomorrow").value}}); toast("Work entry saved","success"); await renderEmployee(); } catch(err){toast(err.message,"error");}
    };
    const cf=$("#checkinForm");
    if(cf) cf.onsubmit=async e=>{e.preventDefault();try{await request("/api/employee/check-in",{method:"POST",body:{code:$("#attendanceCode").value}});toast("Attendance marked","success");await renderEmployee();}catch(err){toast(err.message,"error");}};
    const co=$("#checkoutBtn");
    if(co) co.onclick=async()=>{try{await request("/api/employee/check-out",{method:"POST"});toast("Check-out recorded","success");await renderEmployee();}catch(err){toast(err.message,"error");}};
  }

  async function renderAdmin() {
    const d=await request("/api/admin/dashboard?date="+today());
    document.title="Admin Dashboard · VERBAS";
    const body=`
      <section class="page-intro"><div><div class="eyebrow">OPERATIONS OVERVIEW</div><h1>Team Operations Dashboard</h1><p>Monitor attendance, daily progress and team discussions.</p></div><div class="date-chip">Today · ${fmtDate(d.date)}</div></section>
      <section class="stat-grid five">
        <div class="stat-card"><div class="stat-label">Active Employees</div><div class="stat-value">${d.stats.active}</div><div class="stat-foot">Current team</div></div>
        <div class="stat-card"><div class="stat-label">Checked In</div><div class="stat-value">${d.stats.checked_in}</div><div class="stat-foot">Today</div></div>
        <div class="stat-card"><div class="stat-label">Checked Out</div><div class="stat-value">${d.stats.checked_out}</div><div class="stat-foot">Completed workday</div></div>
        <div class="stat-card"><div class="stat-label">Not Checked In</div><div class="stat-value">${d.stats.not_checked_in}</div><div class="stat-foot">No record yet</div></div>
        <div class="stat-card"><div class="stat-label">Work Records</div><div class="stat-value">${d.stats.work_records}</div><div class="stat-foot">Submitted today</div></div>
      </section>
      <section class="panel attendance-code-panel" id="attendance"><div class="panel-head"><div><div class="eyebrow">LIVE ATTENDANCE</div><h2>Today's Attendance Code</h2><p class="muted">Temporary six-digit code for your team.</p></div><span class="live-dot">Live</span></div>
        <div class="code-stage"><div><div class="code-caption">CURRENT SIX-DIGIT CODE</div><div id="attendanceCode" class="attendance-code">------</div><div id="codeExpiry" class="code-expiry">Loading…</div></div><div class="code-actions"><button class="btn btn-primary" id="generateCode">Generate Code</button><button class="btn btn-ghost" id="copyCode" disabled>Copy Code</button></div></div>
      </section>
      <section class="panel" id="team-attendance"><div class="panel-head"><div><div class="eyebrow">TEAM MONITOR</div><h2>Today's Team Attendance</h2></div><a class="btn btn-ghost btn-sm" href="#/employees">Manage Employees</a></div>
      ${d.employees.length?`<div class="table-wrap"><table class="wide-table"><thead><tr><th>Employee</th><th>Code</th><th>Designation</th><th>Attendance</th><th>Check-in</th><th>Check-out</th><th>Work</th><th>Progress</th></tr></thead><tbody>${d.employees.map(e=>`<tr><td><div class="person-cell"><span class="avatar">${esc((e.name||"?").slice(0,1).toUpperCase())}</span><strong>${esc(e.name)}</strong></div></td><td>${esc(e.employee_code)}</td><td>${esc(e.designation)}</td><td>${e.attendance_status?`<span class="status-badge ${e.attendance_status==="Present"?"status-present":"status-late"}">${esc(e.attendance_status)}</span>`:'<span class="status-badge status-muted">Not Marked</span>'}</td><td>${fmtTime(e.check_in)}</td><td>${fmtTime(e.check_out)}</td><td>${esc(e.work_status||"—")}</td><td>${e.progress??0}%</td></tr>`).join("")}</tbody></table></div>`:'<div class="empty-state"><strong>No active employees yet.</strong><span>Create employees to start tracking the team.</span></div>'}</section>
      <section class="panel" id="notes"><div class="panel-head"><div><div class="eyebrow">MEETING NOTES</div><h2>Today's Discussion</h2></div></div>
        <form id="noteForm" class="stack-form"><div class="form-row"><label class="grow">Topic<input id="noteTitle" required></label><label class="grow">Date<input id="noteDate" type="date" value="${d.date}" required></label></div><label>Discussion<textarea id="noteDiscussion" rows="3" required></textarea></label><div class="form-row"><label class="grow">Decisions<textarea id="noteDecisions" rows="2"></textarea></label><label class="grow">Action Items<textarea id="noteActions" rows="2"></textarea></label></div><button class="btn btn-primary">Save Notes</button></form>
        ${d.notes.length?`<div class="notes-list">${d.notes.map(n=>`<article class="note-card"><strong>${esc(n.title)}</strong><small>${fmtDate(n.note_date)} · ${esc(n.admin_name||"Admin")}</small><p>${esc(n.discussion)}</p></article>`).join("")}</div>`:""}
      </section>`;
    document.body.innerHTML=shell("Admin Dashboard",body,{admin:true});
    bindCommon(); await loadCurrentCode();
    $("#generateCode").onclick=async()=>{try{const x=await request("/api/admin/attendance/generate",{method:"POST"});setCode(x);toast("New attendance code generated","success");}catch(e){toast(e.message,"error");}};
    $("#copyCode").onclick=async()=>{const v=$("#attendanceCode").textContent;if(v!=="------"){await navigator.clipboard.writeText(v);toast("Code copied","success");}};
    $("#noteForm").onsubmit=async e=>{e.preventDefault();try{await request("/api/admin/notes",{method:"POST",body:{note_date:$("#noteDate").value,title:$("#noteTitle").value,discussion:$("#noteDiscussion").value,decisions:$("#noteDecisions").value,action_items:$("#noteActions").value}});toast("Notes saved","success");await renderAdmin();}catch(err){toast(err.message,"error");}};
  }

  async function loadCurrentCode(){
    try{const x=await request("/api/admin/attendance/current"); if(x.active)setCode(x); else {$("#attendanceCode").textContent="------";$("#codeExpiry").textContent="No active code";}}catch(e){toast(e.message,"error");}
  }
  function setCode(x){$("#attendanceCode").textContent=x.code;$("#codeExpiry").textContent=`Expires ${x.expires_at}`;$("#copyCode").disabled=false;}

  async function renderEmployees(){
    const d=await request("/api/admin/employees");
    document.title="Employees · VERBAS";
    const body=`
      <section class="page-intro"><div><div class="eyebrow">TEAM DIRECTORY</div><h1>Employees</h1><p>Create and manage database-backed employee accounts.</p></div><button class="btn btn-primary" id="openEmployee">+ Add Employee</button></section>
      <section class="panel"><div class="panel-head"><div><div class="eyebrow">PEOPLE</div><h2>Employee Directory</h2></div><span class="muted">${d.employees.length} result(s)</span></div>
      ${d.employees.length?`<div class="table-wrap"><table><thead><tr><th>Employee</th><th>Code</th><th>Contact</th><th>Designation</th><th>Department</th><th>Status</th><th></th></tr></thead><tbody>${d.employees.map(e=>`<tr><td><div class="person-cell"><span class="avatar">${esc((e.name||"?").slice(0,1).toUpperCase())}</span><div><strong>${esc(e.name)}</strong><small>${esc(e.email)}</small></div></div></td><td>${esc(e.employee_code)}</td><td>${esc(e.phone||"—")}</td><td>${esc(e.designation)}</td><td>${esc(e.department)}</td><td><span class="status-badge ${e.active?"status-present":"status-muted"}">${e.active?"Active":"Inactive"}</span></td><td><button class="btn btn-ghost btn-sm toggleEmp" data-id="${e.id}">${e.active?"Deactivate":"Activate"}</button></td></tr>`).join("")}</tbody></table></div>`:'<div class="empty-state"><strong>No employees found.</strong><span>Create the first employee account.</span></div>'}</section>
      <div class="modal-backdrop" id="employeeModal"><div class="modal"><div class="modal-head"><div><div class="eyebrow">NEW TEAM MEMBER</div><h2>Create Employee Account</h2></div><button class="modal-close" id="closeEmployee">×</button></div>
      <form id="employeeForm" class="stack-form"><div class="form-row"><label class="grow">Employee Code<input id="empCode" required></label><label class="grow">Full Name<input id="empName" required></label></div><div class="form-row"><label class="grow">Email<input id="empEmail" type="email" required></label><label class="grow">Temporary Password<input id="empPassword" type="password" minlength="10" required></label></div><div class="form-row"><label class="grow">Designation<input id="empDesignation" required></label><label class="grow">Department<input id="empDepartment" required></label></div><label>Phone <span class="muted">(optional)</span><input id="empPhone"></label><div class="modal-actions"><button class="btn btn-ghost" type="button" id="cancelEmployee">Cancel</button><button class="btn btn-primary">Create Employee</button></div></form></div></div>`;
    document.body.innerHTML=shell("Employees",body,{admin:true}); bindCommon();
    const modal=$("#employeeModal"); $("#openEmployee").onclick=()=>modal.classList.add("is-open"); $("#closeEmployee").onclick=$("#cancelEmployee").onclick=()=>modal.classList.remove("is-open");
    $$(".toggleEmp").forEach(btn=>btn.onclick=async()=>{if(!confirm("Change this employee's active status?"))return;try{await request(`/api/admin/employees/${btn.dataset.id}/toggle`,{method:"PATCH"});toast("Employee status updated","success");await renderEmployees();}catch(e){toast(e.message,"error");}});
    $("#employeeForm").onsubmit=async e=>{e.preventDefault();try{await request("/api/admin/employees",{method:"POST",body:{employee_code:$("#empCode").value,name:$("#empName").value,email:$("#empEmail").value,password:$("#empPassword").value,designation:$("#empDesignation").value,department:$("#empDepartment").value,phone:$("#empPhone").value}});toast("Employee created","success");await renderEmployees();}catch(err){toast(err.message,"error");}};
  }

  function bindCommon(){ $("#logoutBtn")?.addEventListener("click",logout); }

  async function router(){
    const route=location.hash.replace(/^#/,"")||"/login";
    try {
      if(route==="/login") return renderLogin(false);
      if(route==="/admin-login") return renderLogin(true);
      if(route==="/admin" || route==="/employees" || route==="/employee") {
        const m=await me();
        if(!m) return location.hash=route==="/employee"?"#/login":"#/admin-login";
        if(route==="/admin" && m.role==="admin") return renderAdmin();
        if(route==="/employees" && m.role==="admin") return renderEmployees();
        if(route==="/employee" && m.role==="employee") return renderEmployee();
        return location.hash=m.role==="admin"?"#/admin":"#/employee";
      }
      location.hash="#/login";
    } catch(e) {
      console.error(e); document.body.innerHTML=`<div class="auth-page"><div class="auth-card"><h1>Unable to load</h1><p class="muted">${esc(e.message)}</p><button class="btn btn-primary" onclick="location.reload()">Retry</button></div></div>`;
    }
  }

  window.addEventListener("hashchange",router);
  window.addEventListener("DOMContentLoaded",router);
})();