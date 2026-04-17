const API = '/api/todos';
const AUTH = '/api/auth';

// ── 艺术化动效引擎 ─────────────────────────────────────────────────────────────
const artEngine = (function() {
  const canvas = document.getElementById('particles');
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  let W, H, points = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function createPoints() {
    points = [];
    for(let i=0; i<40; i++) {
      points.push({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.2 + 0.5
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(167, 139, 250, 0.3)';
    points.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => { resize(); createPoints(); });
  resize(); createPoints(); draw();

  return {
    explode: (x, y) => {
      // 这里的“爆炸”改为更优雅的向心扩散
      // 实现略
    }
  };
})();

// ── 应用状态 ──────────────────────────────────────────────────────────────────
let state = {
  token: localStorage.getItem('token') || '',
  username: localStorage.getItem('username') || '',
  todos: [],
  filter: 'all',
  isRegister: false
};

const UI = {
  authOverlay: document.getElementById('auth-overlay'),
  app: document.getElementById('app'),
  todoInput: document.getElementById('todo-input'),
  addBtn: document.getElementById('add-btn'),
  taskGroups: document.getElementById('task-groups'),
  statNums: {
    total: document.getElementById('stat-total'),
    today: document.getElementById('stat-today'),
    done: document.getElementById('stat-done'),
    overdue: document.getElementById('stat-overdue')
  }
};

// ── 核心逻辑 ──────────────────────────────────────────────────────────────────

async function request(url, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...opts.headers
  };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

  try {
    const res = await fetch(url, { ...opts, headers });
    if (res.status === 401) return handleLogout();
    const data = await res.json();
    return data;
  } catch (e) {
    console.error('Request failed:', e);
    throw new Error('网络连接失败，请检查后端服务是否启动');
  }
}

async function loadData() {
  try {
    const data = await request(API);
    state.todos = data;
    render();
  } catch (e) {
    alert(e.message);
  }
}

async function handleAdd() {
  const text = UI.todoInput.value.trim();
  if (!text) return;

  const category = document.querySelector('#cat-tags .active')?.dataset.value || '';
  const priority = document.querySelector('#pri-tags .active')?.dataset.value || '中';
  const deadline = document.getElementById('deadline-input').value;

  UI.addBtn.disabled = true;
  try {
    const res = await request(API, {
      method: 'POST',
      body: JSON.stringify({ text, category, priority, deadline })
    });
    if (res.ok) {
      UI.todoInput.value = '';
      await loadData();
    } else {
      alert(res.error || '添加失败');
    }
  } catch (e) {
    alert(e.message);
  } finally {
    UI.addBtn.disabled = false;
  }
}

// ── 渲染引擎 ──────────────────────────────────────────────────────────────────

function render() {
  // 更新统计
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const active = state.todos.filter(t => !t.done);
  
  UI.statNums.total.textContent = state.todos.length;
  UI.statNums.done.textContent = state.todos.filter(t => t.done).length;
  UI.statNums.today.textContent = active.filter(t => t.deadline && t.deadline.startsWith(todayStr)).length;
  UI.statNums.overdue.textContent = active.filter(t => t.deadline && new Date(t.deadline) < now).length;

  // 过滤与分组
  let filtered = active;
  if (state.filter === 'today') filtered = active.filter(t => t.deadline && t.deadline.startsWith(todayStr));
  if (state.filter === 'overdue') filtered = active.filter(t => t.deadline && new Date(t.deadline) < now);
  if (state.filter === 'done') filtered = state.todos.filter(t => t.done);

  UI.taskGroups.innerHTML = '';
  if (filtered.length === 0) {
    UI.taskGroups.innerHTML = `<div style="text-align:center; padding: 4rem; color: #475569;">暂无任务</div>`;
    return;
  }

  const groups = {};
  filtered.forEach(t => {
    const cat = t.category || '其他';
    if(!groups[cat]) groups[cat] = [];
    groups[cat].push(t);
  });

  ['工作', '学习', '生活', '其他'].forEach(cat => {
    if (!groups[cat]) return;
    const groupEl = document.createElement('div');
    groupEl.innerHTML = `
      <div class="group-header">
        <span class="group-label">${cat}</span>
        <div class="group-line"></div>
      </div>
      <div class="task-list"></div>
    `;
    const list = groupEl.querySelector('.task-list');
    groups[cat].forEach(t => list.appendChild(createTaskItem(t)));
    UI.taskGroups.appendChild(groupEl);
  });
}

function createTaskItem(t) {
  const item = document.createElement('div');
  item.className = 'task-item';
  item.innerHTML = `
    <div class="task-check ${t.done ? 'checked' : ''}"></div>
    <div style="flex:1">
      <div class="task-text" style="${t.done ? 'text-decoration:line-through; opacity:0.5' : ''}">${t.text}</div>
      <div class="task-meta">
        ${t.priority ? `<span style="color: ${t.priority==='高'?'#f87171':t.priority==='中'?'#fbbf24':'#34d399'}">● ${t.priority}优先级</span>` : ''}
        ${t.deadline ? `<span>🕒 ${new Date(t.deadline).toLocaleString('zh-CN', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</span>` : ''}
      </div>
    </div>
    <button class="del-btn" style="background:none; border:none; color:#475569; cursor:pointer; opacity:0; transition:0.2s">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
    </button>
  `;

  item.addEventListener('mouseenter', () => item.querySelector('.del-btn').style.opacity = '1');
  item.addEventListener('mouseleave', () => item.querySelector('.del-btn').style.opacity = '0');

  item.querySelector('.task-check').onclick = async () => {
    try {
      await request(`${API}/${t.id}`, { method: 'PATCH', body: JSON.stringify({ done: !t.done }) });
      await loadData();
    } catch (e) { alert(e.message); }
  };

  item.querySelector('.del-btn').onclick = async (e) => {
    e.stopPropagation();
    if (!confirm('确定删除？')) return;
    try {
      await request(`${API}/${t.id}`, { method: 'DELETE' });
      await loadData();
    } catch (e) { alert(e.message); }
  };

  return item;
}

// ── 事件监听 ──────────────────────────────────────────────────────────────────

UI.addBtn.onclick = handleAdd;
UI.todoInput.onkeypress = (e) => e.key === 'Enter' && handleAdd();

document.querySelectorAll('.stat-pill').forEach(pill => {
  pill.onclick = () => {
    document.querySelectorAll('.stat-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    state.filter = pill.dataset.filter;
    render();
  };
});

// 标签切换逻辑
document.querySelectorAll('.tags-row').forEach(row => {
  row.onclick = (e) => {
    const btn = e.target.closest('.itag');
    if (!btn) return;
    row.querySelectorAll('.itag').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  };
});

// Auth
document.getElementById('auth-submit').onclick = async () => {
  const username = document.getElementById('auth-username').value;
  const password = document.getElementById('auth-password').value;
  const isRegister = document.getElementById('tab-register').classList.contains('active');
  
  try {
    const res = await fetch(`${AUTH}/${isRegister ? 'register' : 'login'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.ok) {
      state.token = data.token;
      state.username = username;
      localStorage.setItem('token', data.token);
      localStorage.setItem('username', username);
      initApp();
    } else {
      alert(data.error);
    }
  } catch (e) { alert('认证失败，请检查网络'); }
};

document.getElementById('logout-btn').onclick = handleLogout;

function handleLogout() {
  localStorage.clear();
  location.reload();
}

function initApp() {
  UI.authOverlay.classList.add('hidden');
  UI.app.classList.remove('hidden');
  document.getElementById('username-display').textContent = state.username;
  loadData();
}

// 启动
if (state.token) initApp();
else UI.authOverlay.classList.remove('hidden');
