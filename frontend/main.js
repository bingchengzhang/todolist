const API = '/api/todos';
const AUTH = '/api/auth';

// ── 物理与动画引擎 ─────────────────────────────────────────────────────────────
const physics = (function initParticles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  let W, H, particles;
  let confettis = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
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
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      ctx.beginPath();
      ctx.fillStyle = `rgba(167, 139, 250, ${p.a})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

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
  particles = Array.from({ length: 50 }, mkParticle);
  resize();
  draw();

  return {
    explode: (x, y) => {
      for(let i = 0; i < 25; i++) {
        confettis.push({
          x, y, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 1) * 10,
          r: Math.random() * 2 + 1, color: '#a78bfa', life: 1, decay: 0.02
        });
      }
    }
  };
})();

// ── 应用状态 ──────────────────────────────────────────────────────────────────
let token = localStorage.getItem('token') || '';
let username = localStorage.getItem('username') || '';
let todos = [];
let currentFilter = 'all';

// ── 初始化 ───────────────────────────────────────────────────────────────────
const elements = {
  authOverlay: document.getElementById('auth-overlay'),
  app: document.getElementById('app'),
  authUsername: document.getElementById('auth-username'),
  authPassword: document.getElementById('auth-password'),
  authSubmit: document.getElementById('auth-submit'),
  authError: document.getElementById('auth-error'),
  tabLogin: document.getElementById('tab-login'),
  tabRegister: document.getElementById('tab-register'),
  todoInput: document.getElementById('todo-input'),
  addBtn: document.getElementById('add-btn'),
  addIcon: document.getElementById('add-icon'),
  aiLoader: document.getElementById('ai-loader'),
  catTags: document.getElementById('cat-tags'),
  priTags: document.getElementById('pri-tags'),
  deadlineInput: document.getElementById('deadline-input'),
  taskGroups: document.getElementById('task-groups'),
  doneList: document.getElementById('done-list'),
  doneCount: document.getElementById('done-count'),
  doneToggle: document.getElementById('done-toggle'),
  statTotal: document.getElementById('stat-total'),
  statToday: document.getElementById('stat-today'),
  statDone: document.getElementById('stat-done'),
  statOverdue: document.getElementById('stat-overdue'),
  logoutBtn: document.getElementById('logout-btn'),
  usernameDisplay: document.getElementById('username-display'),
};

let isRegister = false;

// ── Auth 逻辑 ────────────────────────────────────────────────────────────────
elements.tabLogin.addEventListener('click', () => {
  isRegister = false;
  elements.tabLogin.classList.add('active');
  elements.tabRegister.classList.remove('active');
  elements.authSubmit.textContent = '进入空间';
});

elements.tabRegister.addEventListener('click', () => {
  isRegister = true;
  elements.tabRegister.classList.add('active');
  elements.tabLogin.classList.remove('active');
  elements.authSubmit.textContent = '创建账户';
});

elements.authSubmit.addEventListener('click', async () => {
  const u = elements.authUsername.value.trim();
  const p = elements.authPassword.value.trim();
  if (!u || !p) return showError('请填写用户名和密码');

  const endpoint = isRegister ? `${AUTH}/register` : `${AUTH}/login`;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    const data = await res.json();
    if (data.ok) {
      token = data.token;
      username = u;
      localStorage.setItem('token', token);
      localStorage.setItem('username', username);
      enterApp();
    } else {
      showError(data.error || '认证失败');
    }
  } catch (e) {
    showError('连接服务器失败');
  }
});

function showError(msg) {
  elements.authError.textContent = msg;
  elements.authError.classList.remove('hidden');
  setTimeout(() => elements.authError.classList.add('hidden'), 3000);
}

function enterApp() {
  elements.authOverlay.classList.add('hidden');
  elements.app.classList.remove('hidden');
  elements.usernameDisplay.textContent = username;
  loadTodos();
}

function logout() {
  localStorage.clear();
  location.reload();
}

elements.logoutBtn.addEventListener('click', logout);

// ── API Helper ──────────────────────────────────────────────────────────────
async function apiFetch(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(opts.headers || {})
    },
  });
  if (res.status === 401) { logout(); return null; }
  return res;
}

// ── 任务操作 ──────────────────────────────────────────────────────────────────
async function loadTodos() {
  const res = await apiFetch(`${API}/`);
  if (!res) return;
  todos = await res.json();
  render();
}

async function addTodo() {
  const text = elements.todoInput.value.trim();
  if (!text) return;

  const category = elements.catTags.querySelector('.active').dataset.value;
  const priority = elements.priTags.querySelector('.active').dataset.value;
  const deadline = elements.deadlineInput.value;

  // UI 状态切换
  elements.addBtn.disabled = true;
  elements.addIcon.classList.add('hidden');
  elements.aiLoader.classList.remove('hidden');

  try {
    const res = await apiFetch(API, {
      method: 'POST',
      body: JSON.stringify({ text, category, priority, deadline })
    });
    const data = await res.json();
    if (data.ok) {
      elements.todoInput.value = '';
      elements.deadlineInput.value = '';
      loadTodos();
    } else {
      alert(data.error || '添加失败');
    }
  } catch (e) {
    alert('连接失败');
  } finally {
    elements.addBtn.disabled = false;
    elements.addIcon.classList.remove('hidden');
    elements.aiLoader.classList.add('hidden');
  }
}

async function toggleDone(id, done) {
  const res = await apiFetch(`${API}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ done })
  });
  if (!res) return;
  const todo = todos.find(t => t.id === id);
  if (todo) todo.done = done;
  render();
}

async function deleteTodo(id) {
  if (!confirm('确定删除此任务吗？')) return;
  const res = await apiFetch(`${API}/${id}`, { method: 'DELETE' });
  if (!res) return;
  todos = todos.filter(t => t.id !== id);
  render();
}

// ── 渲染逻辑 ──────────────────────────────────────────────────────────────────
function render() {
  updateStats();
  
  const activeTasks = todos.filter(t => !t.done);
  const doneTasks = todos.filter(t => t.done);

  // 渲染进行中任务
  renderGroups(activeTasks);
  
  // 渲染已完成任务
  elements.doneList.innerHTML = '';
  doneTasks.forEach(t => elements.doneList.appendChild(buildTaskItem(t)));
  elements.doneCount.textContent = doneTasks.length;
}

function updateStats() {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  
  const active = todos.filter(t => !t.done);
  const done = todos.filter(t => t.done);
  const todayTasks = active.filter(t => t.deadline && t.deadline.startsWith(todayStr));
  const overdueTasks = active.filter(t => t.deadline && new Date(t.deadline) < now);

  elements.statTotal.textContent = todos.length;
  elements.statToday.textContent = todayTasks.length;
  elements.statDone.textContent = done.length;
  elements.statOverdue.textContent = overdueTasks.length;
}

function renderGroups(activeTasks) {
  elements.taskGroups.innerHTML = '';
  
  let filtered = activeTasks;
  if (currentFilter === 'today') {
    const todayStr = new Date().toISOString().split('T')[0];
    filtered = activeTasks.filter(t => t.deadline && t.deadline.startsWith(todayStr));
  } else if (currentFilter === 'overdue') {
    filtered = activeTasks.filter(t => t.deadline && new Date(t.deadline) < new Date());
  }

  if (filtered.length === 0) {
    elements.taskGroups.innerHTML = `<div class="empty-state"><div class="empty-icon">🍵</div><p>空空如也，放松一下</p></div>`;
    return;
  }

  const groups = {};
  filtered.forEach(t => {
    const cat = t.category || '其他';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(t);
  });

  ['工作', '学习', '生活', '其他'].forEach(cat => {
    if (!groups[cat]) return;
    
    const section = document.createElement('div');
    section.className = 'group-section';
    section.innerHTML = `
      <div class="group-header">
        <div class="group-label">
          <span class="group-dot dot-${cat}"></span>
          ${cat}
        </div>
        <span class="group-count">${groups[cat].length}</span>
      </div>
    `;
    
    const ul = document.createElement('ul');
    ul.className = 'task-list';
    groups[cat].forEach(t => ul.appendChild(buildTaskItem(t)));
    
    section.appendChild(ul);
    elements.taskGroups.appendChild(section);
  });
}

function buildTaskItem(t) {
  const li = document.createElement('li');
  li.className = `task-item pri-${t.priority || '中'} ${t.done ? 'done-item' : ''}`;
  
  const now = new Date();
  const isOverdue = t.deadline && new Date(t.deadline) < now && !t.done;

  li.innerHTML = `
    <div class="task-check ${t.done ? 'checked' : ''}">
      ${t.done ? '✓' : ''}
    </div>
    <div class="task-body">
      <div class="task-text">${t.text}</div>
      <div class="task-meta">
        ${t.deadline ? `
          <div class="meta-item ${isOverdue ? 'dl-overdue' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${formatDate(t.deadline)}
          </div>
        ` : ''}
        <div class="meta-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
          ${t.category || '其他'}
        </div>
      </div>
    </div>
    <div class="task-actions">
      <button class="act-btn del-btn" title="删除">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>
  `;

  li.querySelector('.task-check').addEventListener('click', () => {
    if (!t.done && physics) {
      const rect = li.querySelector('.task-check').getBoundingClientRect();
      physics.explode(rect.left + 10, rect.top + 10);
    }
    toggleDone(t.id, !t.done);
  });

  li.querySelector('.del-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteTodo(t.id);
  });

  return li;
}

function formatDate(ds) {
  const d = new Date(ds);
  return d.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── 交互事件 ──────────────────────────────────────────────────────────────────
elements.addBtn.addEventListener('click', addTodo);
elements.todoInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addTodo();
});

// 标签切换
[elements.catTags, elements.priTags].forEach(container => {
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.itag');
    if (!btn) return;
    container.querySelectorAll('.itag').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// 折叠已完成
elements.doneToggle.addEventListener('click', () => {
  const expanded = elements.doneToggle.getAttribute('aria-expanded') === 'true';
  elements.doneToggle.setAttribute('aria-expanded', !expanded);
  elements.doneList.classList.toggle('collapsed');
});

// 统计项过滤
document.querySelectorAll('.stat-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.stat-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    currentFilter = pill.dataset.filter;
    render();
  });
});

// 启动
if (token) enterApp();
else elements.authOverlay.classList.remove('hidden');
