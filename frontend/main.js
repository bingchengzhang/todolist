const API  = '/api/todos';
const AUTH = '/api/auth';
const STATS_API = '/api/stats';

// ── 终极物理引擎 (神秘紫·隐形引力版) ──────────────────────────────────────────
const physics = (function initParticles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  let W, H, particles;
  let gravityWells = []; 
  let confettis = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    updateWells();
  }

  // 内部同步逻辑：只抓取坐标，不画丑漩涡
  function updateWells() {
    const items = document.querySelectorAll('.task-item.pri-高:not(.done-item)');
    gravityWells = Array.from(items).map(el => {
      const r = el.getBoundingClientRect();
      return { x: r.left + 20, y: r.top + r.height / 2 };
    });
  }

  function mkParticle() {
    return {
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.5 + 0.4,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      a: Math.random() * 0.4 + 0.15
    };
  }

  function draw() {
    ctx.fillStyle = 'rgba(7, 8, 16, 0.2)'; // 极暗底色配合微弱拖尾
    ctx.fillRect(0, 0, W, H);

    for (const p of particles) {
      // 隐形引力：粒子只有经过高优先级任务时才会产生微小的路径偏转和聚合
      for (const well of gravityWells) {
        const dx = well.x - p.x, dy = well.y - p.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < 150) {
          p.vx += dx * 0.0006; p.vy += dy * 0.0006;
          p.a = Math.min(0.8, p.a + 0.02);
        } else {
          p.a = Math.max(0.15, p.a - 0.01);
        }
      }

      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;

      ctx.beginPath();
      ctx.fillStyle = `rgba(167, 139, 250, ${p.a})`; // 神秘紫 (#a78bfa)
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      p.vx *= 0.99; p.vy *= 0.99;
    }

    // 庆祝碎片逻辑
    for (let i = confettis.length - 1; i >= 0; i--) {
      let c = confettis[i];
      c.x += c.vx; c.y += c.vy; c.vy += 0.4; c.vx *= 0.96; c.life -= c.decay;
      if (c.life <= 0) { confettis.splice(i, 1); continue; }
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fillStyle = c.color; ctx.globalAlpha = c.life; ctx.fill();
    }
    ctx.globalAlpha = 1;

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  particles = Array.from({ length: 65 }, mkParticle);
  resize();
  draw();

  return {
    sync: () => updateWells(),
    explode: (x, y) => {
      for(let i = 0; i < 35; i++) {
        confettis.push({
          x, y, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 1.2) * 12,
          r: Math.random() * 2.5 + 1, color: '#a78bfa', life: 1, decay: 0.02
        });
      }
    }
  };
})();

// ── 核心逻辑 ──────────────────────────────────────────────────────────────────
let token    = localStorage.getItem('token') || '';
let username = localStorage.getItem('username') || '';
let todos    = [];

// 统一渲染入口
function render() {
  updateStats();
  renderGroups();
  renderDone();
  
  // 确保物理引擎同步引力坐标
  if (physics && physics.sync) {
    physics.sync();
  }
}

// ── Auth & API Helper ─────────────────────────────────────────────────────────
const authOverlay  = document.getElementById('auth-overlay');
const appEl        = document.getElementById('app');
const authUsername = document.getElementById('auth-username');
const authPassword = document.getElementById('auth-password');
const authSubmit   = document.getElementById('auth-submit');

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...(opts.headers || {}) },
  });
  if (res.status === 401) { logout(); return null; }
  return res;
}

// ── Build Task Item (包含点击逻辑) ─────────────────────────────────────────────
function buildItem(t) {
  const li = document.createElement('li');
  const now = new Date();
  const dl  = t.deadline ? new Date(t.deadline) : null;
  const isOverdue = dl && dl < now && !t.done;

  li.className = [
    'task-item',
    `pri-${t.priority}`,
    t.done    ? 'done-item'  : '',
    isOverdue ? 'overdue'    : '',
  ].filter(Boolean).join(' ');
  li.dataset.id = t.id;

  const check = document.createElement('div');
  check.className = `task-check${t.done ? ' checked' : ''}`;
  
  // 核心交互：点击切换状态 + 物理爆炸动画
  check.addEventListener('click', async (e) => {
    const targetDone = !t.done;
    if (targetDone && physics) {
      const rect = check.getBoundingClientRect();
      physics.explode(rect.left + rect.width / 2, rect.top + rect.height / 2);
      li.classList.add('completing');
      await new Promise(r => setTimeout(r, 400));
    }
    toggleDone(t.id, targetDone);
  });

  const body = document.createElement('div');
  body.className = 'task-body';
  body.innerHTML = `<div class="task-text">${t.text}</div>`;

  const actions = document.createElement('div');
  actions.className = 'task-actions';
  const delBtn = document.createElement('button');
  delBtn.className = 'act-btn';
  delBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
  delBtn.addEventListener('click', () => deleteTodo(t.id));
  actions.appendChild(delBtn);

  li.appendChild(check);
  li.appendChild(body);
  li.appendChild(actions);
  return li;
}

// ── 功能函数 ──────────────────────────────────────────────────────────────────
async function toggleDone(id, done) {
  const res = await apiFetch(`${API}/${id}`, { method: 'PATCH', body: JSON.stringify({ done }) });
  if (!res) return;
  const idx = todos.findIndex(t => t.id === id);
  if (idx !== -1) todos[idx].done = done;
  render();
}

async function loadTodos() {
  const res = await apiFetch(`${API}/`);
  if (!res) return;
  todos = await res.json();
  render();
}

async function deleteTodo(id) {
  const res = await apiFetch(`${API}/${id}`, { method: 'DELETE' });
  if (!res) return;
  todos = todos.filter(t => t.id !== id);
  render();
}

// ── UI 渲染 (补完) ─────────────────────────────────────────────────────────────
function updateStats() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const active = todos.filter(t => !t.done);
  const done = todos.filter(t => t.done);
  const todayDue = active.filter(t => t.deadline && t.deadline.slice(0, 10) === today);
  const overdue = active.filter(t => t.deadline && new Date(t.deadline) < now);

  document.getElementById('stat-total').textContent   = todos.length;
  document.getElementById('stat-today').textContent   = todayDue.length;
  document.getElementById('stat-done').textContent    = done.length;
  document.getElementById('stat-overdue').textContent = overdue.length;
}

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

  ['工作', '学习', '生活', '其他'].forEach(cat => {
    if (!groups[cat]) return;
    const section = document.createElement('div');
    section.className = 'task-group';
    section.innerHTML = `<div class="group-label"><span class="group-dot dot-${cat}"></span>${cat}</div>`;
    const ul = document.createElement('ul');
    ul.className = 'task-list';
    groups[cat].forEach(t => ul.appendChild(buildItem(t)));
    section.appendChild(ul);
    container.appendChild(section);
  });
}

function renderDone() {
  const list = document.getElementById('done-list');
  const badge = document.getElementById('done-count');
  const done = todos.filter(t => t.done);
  badge.textContent = done.length;
  list.innerHTML = '';
  done.forEach(t => list.appendChild(buildItem(t)));
}

// ── Auth 处理与启动 ───────────────────────────────────────────────────────────
function enterApp() {
  authOverlay.classList.add('hidden');
  appEl.classList.remove('hidden');
  document.getElementById('username-display').textContent = username;
  loadTodos();
}

function logout() {
  token = ''; username = '';
  localStorage.clear();
  location.reload();
}

document.getElementById('logout-btn').addEventListener('click', logout);

if (token) {
  enterApp();
} else {
  authOverlay.classList.remove('hidden');
}