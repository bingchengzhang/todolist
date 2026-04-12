const API  = '/api/todos';
const AUTH = '/api/auth';
const STATS_API = '/api/stats';

const physics = (function initParticles() {
  const canvas = document.getElementById('particles');
  const ctx = canvas.getContext('2d');
  let W, H, particles, gravityWells = [];
  let mx = -1000, my = -1000;

  // --- 1. 艺术级色温色板 ---
  const getTheme = () => {
    const h = new Date().getHours();
    // 黎明：冷紫转暖橙 | 午后：通透天蓝 | 傍晚：火烧云 | 深夜：幽冥蓝
    if (h >= 5 && h < 9)   return { p: '255,167,118', o1: 'rgba(255,167,118,0.4)', o2: 'rgba(129,140,248,0.2)' };
    if (h >= 9 && h < 17)  return { p: '56,189,248',  o1: 'rgba(56,189,248,0.3)',  o2: 'rgba(255,255,255,0.1)' };
    if (h >= 17 && h < 20) return { p: '251,113,133', o1: 'rgba(251,113,133,0.4)', o2: 'rgba(124,58,237,0.3)' };
    return { p: '127,119,221', o1: 'rgba(79,70,229,0.2)', o2: 'rgba(15,23,42,0.4)' };
  };

  const theme = getTheme();
  document.documentElement.style.setProperty('--orb-1-color', theme.o1);
  document.documentElement.style.setProperty('--orb-2-color', theme.o2);
  document.documentElement.style.setProperty('--accent-primary', `rgba(${theme.p}, 1)`);

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    setTimeout(() => { if(typeof syncGravityWells !== 'undefined') syncGravityWells(); }, 100);
  }

  function mkParticle() {
    return {
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
      alpha: Math.random() * 0.5 + 0.2
    };
  }

  function draw() {
    // 这里的清屏方式是精髓：保留 0.1 的透明度，制造粒子的“拖尾”丝滑感
    ctx.fillStyle = 'rgba(10, 12, 20, 0.15)';
    ctx.fillRect(0, 0, W, H);

    for (const p of particles) {
      // 2. 引力计算：不再有红圈，只有引力
      for (const well of gravityWells) {
        const dx = well.x - p.x, dy = well.y - p.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < 150) {
          // 靠近高优先级任务时，粒子会被加速并产生向心力
          p.vx += dx * 0.001; p.vy += dy * 0.001;
          // 粒子经过引力场时会变亮，产生“星云”闪烁感
          p.alpha = Math.min(1, p.alpha + 0.05);
        } else {
          p.alpha = Math.max(0.2, p.alpha - 0.01);
        }
      }

      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;

      ctx.beginPath();
      // 使用 theme.p 动态颜色，实现粒子随时间变色
      ctx.fillStyle = `rgba(${theme.p}, ${p.alpha})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();

      // 摩擦力，防止粒子速度无限叠加
      p.vx *= 0.99; p.vy *= 0.99;
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  particles = Array.from({ length: 60 }, mkParticle);
  draw();

  return { setWells: (wells) => { gravityWells = wells; } };
})();
// ── 同步高优先级引力坐标 ────────────────────────────────────────────────────────
function syncGravityWells() {
  // 核心修复：检查 physics 是否已存在，且是否具备 setWells 方法
  // 这里的 typeof 判断可以避开死区报错
  if (typeof physics === 'undefined' || !physics || !physics.setWells) {
    return; 
  }

  const highPriItems = document.querySelectorAll('.task-item.pri-高:not(.done-item)');
  const wells = Array.from(highPriItems).map(el => {
    const rect = el.getBoundingClientRect();
    return { 
      x: rect.left + 20, 
      y: rect.top + rect.height / 2 
    };
  });
  physics.setWells(wells);
}
// ── State ──────────────────────────────────────────────────────────────────────
let token    = localStorage.getItem('token') || '';
let username = localStorage.getItem('username') || '';
let todos    = [];

// ── Auth UI ────────────────────────────────────────────────────────────────────
const authOverlay  = document.getElementById('auth-overlay');
const appEl        = document.getElementById('app');
const tabLogin     = document.getElementById('tab-login');
const tabRegister  = document.getElementById('tab-register');
const authError    = document.getElementById('auth-error');
const authUsername = document.getElementById('auth-username');
const authPassword = document.getElementById('auth-password');
const authSubmit   = document.getElementById('auth-submit');
const usernameDisp = document.getElementById('username-display');
const logoutBtn    = document.getElementById('logout-btn');

let authMode = 'login';

function setAuthMode(mode) {
  authMode = mode;
  tabLogin.classList.toggle('active', mode === 'login');
  tabRegister.classList.toggle('active', mode === 'register');
  authSubmit.textContent = mode === 'login' ? '登录' : '注册';
  authError.classList.add('hidden');
}

tabLogin.addEventListener('click', () => setAuthMode('login'));
tabRegister.addEventListener('click', () => setAuthMode('register'));

authSubmit.addEventListener('click', async () => {
  const u = authUsername.value.trim();
  const p = authPassword.value;
  if (!u || !p) { showAuthError('请填写用户名和密码'); return; }

  authSubmit.disabled = true;
  try {
    const res = await fetch(`${AUTH}/${authMode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p }),
    });
    const data = await res.json();
    if (!res.ok) { showAuthError(data.error || '操作失败'); return; }

    token    = data.token;
    username = data.username;
    localStorage.setItem('token', token);
    localStorage.setItem('username', username);
    enterApp();
  } catch {
    showAuthError('网络错误，请重试');
  } finally {
    authSubmit.disabled = false;
  }
});

[authUsername, authPassword].forEach(el =>
  el.addEventListener('keydown', e => { if (e.key === 'Enter') authSubmit.click(); })
);

function showAuthError(msg) {
  authError.textContent = msg;
  authError.classList.remove('hidden');
}

function enterApp() {
  authOverlay.classList.add('hidden');
  appEl.classList.remove('hidden');
  usernameDisp.textContent = username;
  loadTodos();
}

function logout() {
  token = ''; username = '';
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  authOverlay.classList.remove('hidden');
  appEl.classList.add('hidden');
  authUsername.value = '';
  authPassword.value = '';
  authError.classList.add('hidden');
  todos = [];
}

logoutBtn.addEventListener('click', logout);

// ── API helper ─────────────────────────────────────────────────────────────────
async function apiFetch(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) { logout(); return null; }
  return res;
}

// ── Load & render ──────────────────────────────────────────────────────────────
async function loadTodos() {
  const res = await apiFetch(`${API}/`);
  if (!res) return;
  todos = await res.json();
  render();
}

function render() {
  updateStats();
  renderGroups();
  renderDone();
  
  // DOM 渲染完成后，利用 requestAnimationFrame 确保布局已稳定，再去抓取坐标
  requestAnimationFrame(syncGravityWells);
}

// ── Stats ──────────────────────────────────────────────────────────────────────
function updateStats() {
  const now   = new Date();
  const today = now.toISOString().slice(0, 10);

  const active  = todos.filter(t => !t.done);
  const done    = todos.filter(t => t.done);
  const todayDue = active.filter(t => t.deadline && t.deadline.slice(0, 10) === today);
  const overdue  = active.filter(t => t.deadline && new Date(t.deadline) < now);

  document.getElementById('stat-total').textContent   = todos.length;
  document.getElementById('stat-today').textContent   = todayDue.length;
  document.getElementById('stat-done').textContent    = done.length;
  document.getElementById('stat-overdue').textContent = overdue.length;
}

// ── Active tasks grouped by category ──────────────────────────────────────────
const CAT_ORDER = ['工作', '学习', '生活', '其他'];

function renderGroups() {
  const container = document.getElementById('task-groups');
  container.innerHTML = '';

  const active = todos.filter(t => !t.done);
  if (active.length === 0) return;

  const groups = {};
  for (const t of active) {
    const cat = t.category || '其他';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(t);
  }

  for (const cat of CAT_ORDER) {
    if (!groups[cat]) continue;
    const section = document.createElement('div');
    section.className = 'task-group';

    const label = document.createElement('div');
    label.className = 'group-label';
    label.innerHTML = `<span class="group-dot dot-${cat}"></span>${cat}`;
    section.appendChild(label);

    const ul = document.createElement('ul');
    ul.className = 'task-list';
    for (const t of groups[cat]) ul.appendChild(buildItem(t));
    section.appendChild(ul);

    container.appendChild(section);
  }
}

// ── Done tasks ─────────────────────────────────────────────────────────────────
function renderDone() {
  const list  = document.getElementById('done-list');
  const badge = document.getElementById('done-count');
  const done  = todos.filter(t => t.done);

  badge.textContent = done.length;
  list.innerHTML = '';
  for (const t of done) list.appendChild(buildItem(t));
}

// ── Build task item ────────────────────────────────────────────────────────────
function buildItem(t) {
  const now = new Date();
  const dl  = t.deadline ? new Date(t.deadline) : null;
  const isToday   = dl && dl.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
  const isOverdue = dl && dl < now && !t.done;

  const li = document.createElement('li');
  li.className = [
    'task-item',
    `pri-${t.priority}`,
    t.done    ? 'done-item'  : '',
    isOverdue ? 'overdue'    : '',
  ].filter(Boolean).join(' ');
  li.dataset.id = t.id;

  // Category dot
  const dot = document.createElement('div');
  dot.className = `task-dot dot-${t.category || '其他'}`;

  // 修改：Checkbox 绑定逻辑
  const check = document.createElement('div');
  check.className = `task-check${t.done ? ' checked' : ''}`;
  check.addEventListener('click', (e) => toggleDone(t.id, !t.done, e, t.category, li));
  // Body
  const body = document.createElement('div');
  body.className = 'task-body';

  const textEl = document.createElement('div');
  textEl.className = 'task-text';
  textEl.textContent = t.text;

  const meta = document.createElement('div');
  meta.className = 'task-meta';

  // Priority badge
  const priBadge = document.createElement('span');
  priBadge.className = `pri-badge p-${t.priority}`;
  priBadge.textContent = t.priority;
  meta.appendChild(priBadge);

  // Deadline badge
  if (dl) {
    const dlBadge = document.createElement('span');
    dlBadge.className = [
      'dl-badge',
      isOverdue ? 'dl-overdue' : (isToday ? 'dl-today' : ''),
    ].filter(Boolean).join(' ');
    dlBadge.textContent = formatDeadline(dl);
    meta.appendChild(dlBadge);
  }

  body.appendChild(textEl);
  body.appendChild(meta);

  // Actions (delete)
  const actions = document.createElement('div');
  actions.className = 'task-actions';

  const delBtn = document.createElement('button');
  delBtn.className = 'act-btn';
  delBtn.title = '删除';
  delBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
  delBtn.addEventListener('click', () => deleteTodo(t.id));
  actions.appendChild(delBtn);

  li.appendChild(dot);
  li.appendChild(check);
  li.appendChild(body);
  li.appendChild(actions);
  return li;
}

function formatDeadline(dl) {
  const now   = new Date();
  const today = now.toISOString().slice(0, 10);
  const dlDay = dl.toISOString().slice(0, 10);
  if (dlDay === today) {
    return `今天 ${dl.toTimeString().slice(0, 5)}`;
  }
  const diff = Math.floor((dl - now) / 86400000);
  if (diff < 0) return `逾期 ${Math.abs(diff)} 天`;
  if (diff === 1) return `明天 ${dl.toTimeString().slice(0, 5)}`;
  return `${dlDay} ${dl.toTimeString().slice(0, 5)}`;
}

// ── Toggle done ────────────────────────────────────────────────────────────────
async function toggleDone(id, done, event, category, liElement) {
  // 如果是标记为完成，触发动画缓冲
  if (done && event && liElement) {
    const rect = event.target.getBoundingClientRect();
    // 触发锚点爆炸，提取卡片中心坐标
    physics.explode(rect.left + rect.width / 2, rect.top + rect.height / 2, category);
    
    // 给卡片加上即将消失的 CSS 类
    liElement.classList.add('completing');
    
    // 延迟 400ms 给前端动画表现时间，然后再发请求刷新
    await new Promise(r => setTimeout(r, 400));
  }

  const res = await apiFetch(`${API}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ done }),
  });
  
  if (!res) return;
  const idx = todos.findIndex(t => t.id === id);
  if (idx !== -1) todos[idx].done = done;
  render();
}

// ── Delete ─────────────────────────────────────────────────────────────────────
async function deleteTodo(id) {
  const res = await apiFetch(`${API}/${id}`, { method: 'DELETE' });
  if (!res) return;
  todos = todos.filter(t => t.id !== id);
  render();
}

// ── Add todo ───────────────────────────────────────────────────────────────────
const todoInput    = document.getElementById('todo-input');
const addBtn       = document.getElementById('add-btn');
const inputError   = document.getElementById('input-error');
const deadlineInput = document.getElementById('deadline-input');
const clearDeadline = document.getElementById('clear-deadline');

let selCat = '';   // '' = auto
let selPri = '中';

// Category tag toggle
document.getElementById('cat-tags').addEventListener('click', e => {
  const btn = e.target.closest('.itag');
  if (!btn) return;
  document.querySelectorAll('#cat-tags .itag').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selCat = btn.dataset.value;
});

// Priority tag toggle
document.getElementById('pri-tags').addEventListener('click', e => {
  const btn = e.target.closest('.itag');
  if (!btn) return;
  document.querySelectorAll('#pri-tags .itag').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selPri = btn.dataset.value;
});

// Deadline clear button
deadlineInput.addEventListener('change', () => {
  clearDeadline.classList.toggle('hidden', !deadlineInput.value);
});
clearDeadline.addEventListener('click', () => {
  deadlineInput.value = '';
  clearDeadline.classList.add('hidden');
});

addBtn.addEventListener('click', addTodo);
todoInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTodo(); });

async function addTodo() {
  const text = todoInput.value.trim();
  if (!text) { showInputError('请输入任务内容'); return; }
  inputError.classList.add('hidden');
  addBtn.disabled = true;

  const body = {
    text,
    category: selCat || undefined,
    priority: selPri || undefined,
    deadline: deadlineInput.value || undefined,
  };

  try {
    const res = await apiFetch(`${API}/`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!res) return;
    const data = await res.json();
    if (!data.ok) { showInputError(data.error || '添加失败'); return; }

    todoInput.value = '';
    deadlineInput.value = '';
    clearDeadline.classList.add('hidden');
    await loadTodos();
  } catch {
    showInputError('网络错误，请重试');
  } finally {
    addBtn.disabled = false;
  }
}

function showInputError(msg) {
  inputError.textContent = msg;
  inputError.classList.remove('hidden');
  setTimeout(() => inputError.classList.add('hidden'), 3000);
}

// ── Done section toggle ────────────────────────────────────────────────────────
document.getElementById('done-toggle').addEventListener('click', function () {
  const expanded = this.getAttribute('aria-expanded') === 'true';
  this.setAttribute('aria-expanded', String(!expanded));
  document.getElementById('done-list').classList.toggle('collapsed', expanded);
});

// ── Heatmap ────────────────────────────────────────────────────────────────────
async function loadHeatmap() {
  const res = await apiFetch(`${STATS_API}/heatmap`);
  if (!res) return;
  const data = await res.json();   // { "2026-04-01": 3, ... }
  renderHeatmap(data);
}

function renderHeatmap(data) {
  const container = document.getElementById('heatmap');
  container.innerHTML = '';

  // Build 84 day range ending today (12 weeks × 7 days)
  const today  = new Date();
  today.setHours(0, 0, 0, 0);
  const days   = [];

  // Start from the Monday of the week 12 weeks ago
  const start  = new Date(today);
  start.setDate(start.getDate() - 83);

  for (let i = 0; i < 84; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }

  const maxCount = Math.max(1, ...Object.values(data));

  for (const day of days) {
    const count = data[day] || 0;
    let level = 0;
    if (count > 0) {
      const ratio = count / maxCount;
      if (ratio <= 0.25)      level = 1;
      else if (ratio <= 0.5)  level = 2;
      else if (ratio <= 0.75) level = 3;
      else                    level = 4;
    }
    const cell = document.createElement('div');
    cell.className = 'hm-cell';
    cell.dataset.level = level;
    cell.title = count > 0 ? `${day}：完成 ${count} 项` : day;
    container.appendChild(cell);
  }
}

// ── Init ───────────────────────────────────────────────────────────────────────
if (token) {
  enterApp();
} else {
  authOverlay.classList.remove('hidden');
  appEl.classList.add('hidden');
}
