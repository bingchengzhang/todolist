const API = '/api/todos';
const AUTH = '/api/auth';

// ── Particles ─────────────────────────────────────────────────────────────────
(function initParticles() {
  const canvas = document.getElementById('particles');
  const ctx    = canvas.getContext('2d');
  const COLORS = ['124,111,247', '167,139,250', '99,102,241', '196,181,253'];
  let pts = [];

  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  function make() {
    return { x: Math.random()*canvas.width, y: Math.random()*canvas.height,
             vx: (Math.random()-.5)*.22, vy: -(Math.random()*.30+.06),
             r: Math.random()*1.6+.3, a: Math.random()*.30+.06,
             c: COLORS[Math.floor(Math.random()*COLORS.length)] };
  }
  resize();
  window.addEventListener('resize', resize);
  for (let i = 0; i < 60; i++) pts.push(make());
  (function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.y < -6)              { p.y = canvas.height+6; p.x = Math.random()*canvas.width; }
      if (p.x < -6)               p.x = canvas.width+6;
      if (p.x > canvas.width+6)  p.x = -6;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(${p.c},${p.a})`; ctx.fill();
    }
    requestAnimationFrame(loop);
  })();
})();

// ── PWA ───────────────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(()=>{});

// ── Auth state ────────────────────────────────────────────────────────────────
const authOverlay = document.getElementById('auth-overlay');
const tabLogin    = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const authError   = document.getElementById('auth-error');
const authUser    = document.getElementById('auth-username');
const authPass    = document.getElementById('auth-password');
const authSubmit  = document.getElementById('auth-submit');
const logoutBtn   = document.getElementById('logout-btn');

let currentMode = 'login'; // 'login' | 'register'

function getToken() { return localStorage.getItem('token'); }
function setToken(t) { localStorage.setItem('token', t); }
function clearToken() { localStorage.removeItem('token'); }

function showAuth() {
  authOverlay.classList.remove('hidden');
  authUser.value = '';
  authPass.value = '';
  authError.classList.add('hidden');
  authUser.focus();
}
function hideAuth() { authOverlay.classList.add('hidden'); }

tabLogin.addEventListener('click', () => switchMode('login'));
tabRegister.addEventListener('click', () => switchMode('register'));
function switchMode(mode) {
  currentMode = mode;
  tabLogin.classList.toggle('active', mode === 'login');
  tabRegister.classList.toggle('active', mode === 'register');
  authSubmit.textContent = mode === 'login' ? '登录' : '注册';
  authError.classList.add('hidden');
}

authSubmit.addEventListener('click', doAuth);
authPass.addEventListener('keydown', e => { if (e.key === 'Enter') doAuth(); });
authUser.addEventListener('keydown', e => { if (e.key === 'Enter') authPass.focus(); });

async function doAuth() {
  const username = authUser.value.trim();
  const password = authPass.value;
  if (!username || !password) { showAuthError('请填写用户名和密码'); return; }

  authSubmit.disabled = true;
  authSubmit.textContent = '请稍候…';
  try {
    const res  = await fetch(`${AUTH}/${currentMode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) { showAuthError(data.error || '操作失败'); return; }
    setToken(data.token);
    hideAuth();
    loadTodos();
  } catch {
    showAuthError('网络错误，请重试');
  } finally {
    authSubmit.disabled = false;
    authSubmit.textContent = currentMode === 'login' ? '登录' : '注册';
  }
}

function showAuthError(msg) {
  authError.textContent = msg;
  authError.classList.remove('hidden');
}

logoutBtn.addEventListener('click', () => {
  clearToken();
  todoList.innerHTML = '';
  doneList.innerHTML = '';
  updateCounts(0, 0);
  showAuth();
});

// ── API helper ────────────────────────────────────────────────────────────────
function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`,
  };
}

async function apiFetch(url, opts = {}) {
  opts.headers = { ...authHeaders(), ...(opts.headers || {}) };
  const res = await fetch(url, opts);
  if (res.status === 401) {
    clearToken();
    showAuth();
    throw new Error('Unauthorized');
  }
  return res;
}

// ── Deadline helpers ──────────────────────────────────────────────────────────
const deadlineInput = document.getElementById('deadline-input');
const clearDl       = document.getElementById('clear-deadline');
deadlineInput.addEventListener('change', () => clearDl.classList.toggle('hidden', !deadlineInput.value));
clearDl.addEventListener('click', () => { deadlineInput.value = ''; clearDl.classList.add('hidden'); });

function deadlineStatus(iso) {
  if (!iso) return null;
  const diff = new Date(iso) - Date.now();
  return diff < 0 ? 'expired' : diff < 86400000 ? 'urgent' : 'ok';
}
function formatDeadline(iso) {
  if (!iso) return null;
  const dt  = new Date(iso);
  const now = new Date();
  const today    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);
  const dlDay    = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const time     = dt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (dlDay.getTime() === today.getTime())    return `今天 ${time}`;
  if (dlDay.getTime() === tomorrow.getTime()) return `明天 ${time}`;
  return `${dt.getMonth()+1}月${dt.getDate()}日 ${time}`;
}

// ── Completed section toggle ──────────────────────────────────────────────────
const doneToggle = document.getElementById('done-toggle');
doneToggle.addEventListener('click', () => {
  const expanded = doneToggle.getAttribute('aria-expanded') === 'true';
  doneToggle.setAttribute('aria-expanded', String(!expanded));
  doneList.classList.toggle('collapsed', expanded);
});

// ── DOM refs ──────────────────────────────────────────────────────────────────
const input       = document.getElementById('todo-input');
const addBtn      = document.getElementById('add-btn');
const inputErr    = document.getElementById('input-error');
const todoList    = document.getElementById('todo-list');
const doneList    = document.getElementById('done-list');
const doneCount   = document.getElementById('done-count');
const headerCount = document.getElementById('header-count');
const emptyHint   = document.getElementById('empty-hint');

// ── Load todos ────────────────────────────────────────────────────────────────
async function loadTodos() {
  try {
    const res  = await apiFetch(`${API}/`);
    const data = await res.json();
    todoList.innerHTML = '';
    doneList.innerHTML = '';
    let active = 0, completed = 0;
    data.forEach(todo => {
      if (todo.done) { completed++; doneList.appendChild(buildItem(todo)); }
      else           { active++;    todoList.appendChild(buildItem(todo)); }
    });
    updateCounts(active, completed);
  } catch {}
}

function updateCounts(active, completed) {
  headerCount.textContent = active > 0 ? `${active} 项` : '全部完成';
  doneCount.textContent   = completed;
  emptyHint.classList.toggle('hidden', active > 0);
}

// ── Build card ────────────────────────────────────────────────────────────────
function buildItem(todo, loading = false) {
  const li     = document.createElement('li');
  const status = deadlineStatus(todo.deadline);
  li.className = 'todo-item'
    + (todo.done     ? ' done'                      : '')
    + (todo.priority ? ` priority-${todo.priority}` : '');
  if (!todo.done && status === 'urgent')  li.classList.add('deadline-urgent');
  if (!todo.done && status === 'expired') li.classList.add('deadline-expired');
  li.dataset.id = todo.id;

  // Checkbox
  const checkWrap = document.createElement('label');
  checkWrap.className = 'check-wrap';
  const cb = document.createElement('input');
  cb.type = 'checkbox'; cb.checked = todo.done;
  cb.addEventListener('change', () => toggleDone(todo.id, cb.checked, li));
  const circle = document.createElement('span');
  circle.className = 'check-circle';
  circle.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  checkWrap.appendChild(cb);
  checkWrap.appendChild(circle);

  // Body
  const body   = document.createElement('div');
  body.className = 'todo-body';
  const textEl = document.createElement('p');
  textEl.className = 'todo-text'; textEl.textContent = todo.text;
  const meta   = document.createElement('div');
  meta.className = 'todo-meta';

  if (loading) {
    const tag = document.createElement('span');
    tag.className = 'loading-tag'; tag.textContent = 'AI 分析中';
    meta.appendChild(tag);
  } else {
    if (todo.category) {
      const cat = document.createElement('span');
      cat.className = 'badge badge-category'; cat.textContent = todo.category;
      meta.appendChild(cat);
    }
    if (todo.deadline) {
      const dl = document.createElement('span');
      dl.className = `badge badge-deadline${status === 'urgent' ? ' urgent' : status === 'expired' ? ' expired' : ''}`;
      dl.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${formatDeadline(todo.deadline)}`;
      meta.appendChild(dl);
    }
    const sel = document.createElement('select');
    sel.className = `priority-select priority-select-${todo.priority || '中'}`;
    sel.setAttribute('aria-label', '优先级');
    ['高','中','低'].forEach(p => {
      const opt = document.createElement('option');
      opt.value = p; opt.textContent = p;
      if (p === todo.priority) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', async () => {
      const p = sel.value;
      li.classList.remove('priority-高','priority-中','priority-低');
      li.classList.add(`priority-${p}`);
      sel.className = `priority-select priority-select-${p}`;
      await apiFetch(`${API}/${todo.id}`, { method:'PATCH', body: JSON.stringify({ priority: p }) });
    });
    sel.addEventListener('click', e => e.stopPropagation());
    meta.appendChild(sel);
  }

  body.appendChild(textEl);
  body.appendChild(meta);

  // Delete
  const del = document.createElement('button');
  del.className = 'delete-btn'; del.setAttribute('aria-label','删除');
  del.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
  del.addEventListener('click', () => removeTodo(todo.id, li));

  li.appendChild(checkWrap);
  li.appendChild(body);
  li.appendChild(del);
  return li;
}

// ── Add ───────────────────────────────────────────────────────────────────────
addBtn.addEventListener('click', addTodo);
input.addEventListener('keydown', e => { if (e.key === 'Enter') addTodo(); });

async function addTodo() {
  const text     = input.value.trim();
  const deadline = deadlineInput.value || null;
  inputErr.classList.add('hidden');
  if (!text) { showError('请输入任务内容'); return; }
  if (text.length > 200) { showError('任务内容不能超过 200 字'); return; }

  addBtn.disabled = true;
  input.value = ''; deadlineInput.value = ''; clearDl.classList.add('hidden');

  const placeholder = buildItem({ id:0, text, done:false, category:'', priority:'中', deadline }, true);
  todoList.prepend(placeholder);
  emptyHint.classList.add('hidden');
  headerCount.textContent = `${todoList.children.length} 项`;

  try {
    const res  = await apiFetch(`${API}/`, { method:'POST', body: JSON.stringify({ text, deadline }) });
    const data = await res.json();
    if (!res.ok) { showError(data.error || '添加失败'); placeholder.remove(); recalcCounts(); return; }
    placeholder.replaceWith(buildItem({ id:data.id, text, done:false, category:data.category, priority:data.priority, deadline }));
  } catch (e) {
    if (e.message !== 'Unauthorized') { showError('网络错误，请重试'); placeholder.remove(); recalcCounts(); }
  } finally {
    addBtn.disabled = false;
  }
}

// ── Toggle done ───────────────────────────────────────────────────────────────
async function toggleDone(id, done, li) {
  if (done) { li.classList.add('dissolving'); await new Promise(r => setTimeout(r, 360)); }
  try { await apiFetch(`${API}/${id}`, { method:'PATCH', body: JSON.stringify({ done }) }); } catch {}
  loadTodos();
}

// ── Delete ────────────────────────────────────────────────────────────────────
async function removeTodo(id, li) {
  li.classList.add('removing');
  await new Promise(r => setTimeout(r, 200));
  li.remove(); recalcCounts();
  try { await apiFetch(`${API}/${id}`, { method:'DELETE' }); } catch {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function showError(msg) { inputErr.textContent = msg; inputErr.classList.remove('hidden'); }
function recalcCounts() { updateCounts(todoList.children.length, doneList.children.length); }

setInterval(loadTodos, 60000);

// ── Init ──────────────────────────────────────────────────────────────────────
if (getToken()) { hideAuth(); loadTodos(); }
else            { showAuth(); }
