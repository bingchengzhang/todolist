// ── 自动环境探测 ─────────────────────────────────────────────────────────────
const isLocalFile = window.location.protocol === 'file:';
const BASE_URL = isLocalFile ? 'http://127.0.0.1:5000' : '';
const API = `${BASE_URL}/api/todos`;
const AUTH = `${BASE_URL}/api/auth`;

// ── 状态管理 ──────────────────────────────────────────────────────────────────
let state = {
  token: localStorage.getItem('token') || '',
  username: localStorage.getItem('username') || '',
  todos: [],
  filter: 'all'
};

const UI = {
  authOverlay: document.getElementById('auth-overlay'),
  app: document.getElementById('app'),
  todoInput: document.getElementById('todo-input'),
  addBtn: document.getElementById('add-btn'),
  taskGroups: document.getElementById('task-groups'),
  stats: {
    all: document.getElementById('stat-total'),
    today: document.getElementById('stat-today'),
    done: document.getElementById('stat-done'),
    overdue: document.getElementById('stat-overdue')
  }
};

// ── 通讯引擎 (增强异常捕获) ───────────────────────────────────────────────────
async function request(url, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

  try {
    const res = await fetch(url, { ...opts, headers });
    if (res.status === 401) { logout(); throw new Error('会话过期，请重新登录'); }
    const data = await res.json();
    return data;
  } catch (e) {
    console.error('API Error:', e);
    const msg = e.message.includes('fetch') ? '无法连接到服务器。请确保后端服务 (app.py) 已在端口 5000 启动。' : e.message;
    throw new Error(msg);
  }
}

// ── 核心功能 ──────────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const data = await request(API);
    state.todos = Array.isArray(data) ? data : [];
    render();
  } catch (e) {
    alert(e.message);
  }
}

async function handleAdd() {
  const text = UI.todoInput.value.trim();
  if (!text) return;

  const category = document.querySelector('#cat-tags .active')?.dataset.value || null;
  const priority = document.querySelector('#pri-tags .active')?.dataset.value || '中';
  const deadline = document.getElementById('deadline-input').value || null;

  UI.addBtn.textContent = '分析中...';
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
    UI.addBtn.textContent = '添加';
    UI.addBtn.disabled = false;
  }
}

// ── 渲染逻辑 ──────────────────────────────────────────────────────────────────
function render() {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const active = state.todos.filter(t => !t.done);
  const done = state.todos.filter(t => t.done);

  // 更新左侧统计
  UI.stats.all.textContent = state.todos.length;
  UI.stats.done.textContent = done.length;
  UI.stats.today.textContent = active.filter(t => t.deadline && t.deadline.startsWith(todayStr)).length;
  UI.stats.overdue.textContent = active.filter(t => t.deadline && new Date(t.deadline) < now).length;

  // 过滤逻辑
  let displayList = active;
  if (state.filter === 'done') displayList = done;
  if (state.filter === 'today') displayList = active.filter(t => t.deadline && t.deadline.startsWith(todayStr));
  if (state.filter === 'overdue') displayList = active.filter(t => t.deadline && new Date(t.deadline) < now);

  UI.taskGroups.innerHTML = '';
  if (displayList.length === 0) {
    UI.taskGroups.innerHTML = `<div style="text-align:center; padding:5rem; color:var(--text-dim);">此视图下暂无任务</div>`;
    return;
  }

  // 按分类分组显示
  const groups = {};
  displayList.forEach(t => {
    const cat = t.category || '其他';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(t);
  });

  Object.keys(groups).sort().forEach(cat => {
    const groupEl = document.createElement('div');
    groupEl.className = 'task-group';
    groupEl.innerHTML = `<h3 style="font-size:0.7rem; color:var(--text-dim); text-transform:uppercase; margin-bottom:1rem; letter-spacing:1px;">${cat}</h3>`;
    groups[cat].forEach(t => {
      const card = createTaskCard(t);
      groupEl.appendChild(card);
    });
    UI.taskGroups.appendChild(groupEl);
  });
}

function createTaskCard(t) {
  const card = document.createElement('div');
  card.className = 'task-card';
  const now = new Date();
  const isOverdue = t.deadline && new Date(t.deadline) < now && !t.done;

  card.innerHTML = `
    <div class="task-check-circle ${t.done ? 'checked' : ''}"></div>
    <div class="task-content">
      <div class="task-title" style="${t.done ? 'text-decoration:line-through; opacity:0.5' : ''}">${t.text}</div>
      <div class="task-meta">
        <span style="color:${t.priority==='高'?'#f87171':t.priority==='中'?'#fbbf24':'#34d399'}">● ${t.priority}</span>
        ${t.deadline ? `<span>🕒 ${new Date(t.deadline).toLocaleString('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span>` : ''}
        ${isOverdue ? '<span style="color:#f87171">已逾期</span>' : ''}
      </div>
    </div>
    <div class="task-actions">
      <button class="del-btn" style="background:none; border:none; color:var(--text-dim); cursor:pointer;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
      </button>
    </div>
  `;

  card.querySelector('.task-check-circle').onclick = async () => {
    try {
      await request(`${API}/${t.id}`, { method: 'PATCH', body: JSON.stringify({ done: !t.done }) });
      await loadData();
    } catch (e) { alert(e.message); }
  };

  card.querySelector('.del-btn').onclick = async () => {
    if (!confirm('彻底删除这项任务？')) return;
    try {
      await request(`${API}/${t.id}`, { method: 'DELETE' });
      await loadData();
    } catch (e) { alert(e.message); }
  };

  return card;
}

// ── 交互事件 ──────────────────────────────────────────────────────────────────
UI.addBtn.onclick = handleAdd;
UI.todoInput.onkeypress = (e) => e.key === 'Enter' && handleAdd();

document.querySelectorAll('.stat-item').forEach(item => {
  item.onclick = () => {
    document.querySelectorAll('.stat-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    state.filter = item.dataset.filter;
    render();
  };
});

document.querySelectorAll('.itag').forEach(tag => {
  tag.onclick = () => {
    tag.parentElement.querySelectorAll('.itag').forEach(t => t.classList.remove('active'));
    tag.classList.add('active');
  };
});

// Auth 逻辑
document.getElementById('auth-submit').onclick = async () => {
  const username = document.getElementById('auth-username').value;
  const password = document.getElementById('auth-password').value;
  const isRegister = document.getElementById('tab-register').style.color === 'rgb(255, 255, 255)';

  try {
    const data = await request(`${AUTH}/${isRegister ? 'register' : 'login'}`, {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (data.ok) {
      state.token = data.token;
      state.username = username;
      localStorage.setItem('token', data.token);
      localStorage.setItem('username', username);
      initApp();
    } else { alert(data.error); }
  } catch (e) { alert(e.message); }
};

document.getElementById('tab-login').onclick = () => {
  document.getElementById('tab-login').style.color = '#fff';
  document.getElementById('tab-login').style.borderBottom = '2px solid var(--accent)';
  document.getElementById('tab-register').style.color = 'var(--text-dim)';
  document.getElementById('tab-register').style.borderBottom = 'none';
};
document.getElementById('tab-register').onclick = () => {
  document.getElementById('tab-register').style.color = '#fff';
  document.getElementById('tab-register').style.borderBottom = '2px solid var(--accent)';
  document.getElementById('tab-login').style.color = 'var(--text-dim)';
  document.getElementById('tab-login').style.borderBottom = 'none';
};

document.getElementById('logout-btn').onclick = logout;

function logout() {
  localStorage.clear();
  location.reload();
}

function initApp() {
  UI.authOverlay.classList.add('hidden');
  UI.app.classList.remove('hidden');
  document.getElementById('username-display').textContent = state.username;
  loadData();
}

if (state.token) initApp();
else UI.authOverlay.classList.remove('hidden');
