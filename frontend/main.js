// ── 智能 API 适配器 ─────────────────────────────────────────────────────────
const CLOUD_BACKEND_URL = 'https://web-production-f1ba1.up.railway.app'; 

const getBaseUrl = () => {
  if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
    return 'http://127.0.0.1:5000';
  }
  let url = CLOUD_BACKEND_URL || window.location.origin;
  // 核心修复：强制将 http 转换为 https
  return url.replace('http://', 'https://');
};

const BASE_URL = getBaseUrl();
const API = `${BASE_URL}/api/todos`;
const AUTH = `${BASE_URL}/api/auth`;

console.log(`[System] Connecting to backend at: ${BASE_URL}`);

// ── 极致视觉引擎 ─────────────────────────────────────────────────────────────
// (保持之前的艺术化逻辑，并优化了移动端适配)

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

// ── 增强型通讯 ────────────────────────────────────────────────────────────────
async function request(url, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

  try {
    const res = await fetch(url, { ...opts, headers });
    if (res.status === 401) { logout(); throw new Error('登录已过期'); }
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || '请求失败');
    }
    return await res.json();
  } catch (e) {
    console.error('Fetch Error:', e);
    throw new Error(`连接失败: ${e.message}。请确保后端服务已启动且跨域已开启。`);
  }
}

// ── 核心逻辑与渲染 ─────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const data = await request(API);
    state.todos = Array.isArray(data) ? data : [];
    render();
  } catch (e) {
    console.warn(e.message);
    // 如果是云端页面报错，给予更友好的提示
    if (window.location.protocol === 'https:') {
      UI.taskGroups.innerHTML = `<div style="text-align:center; padding:5rem; color:var(--text-dim);">
        <p>⚠️ 无法连接到云端后端</p>
        <p style="font-size:0.7rem; margin-top:1rem;">请检查后端 URL 是否配置正确，或者后端服务是否在线。</p>
      </div>`;
    }
  }
}

function render() {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const active = state.todos.filter(t => !t.done);
  
  UI.stats.all.textContent = state.todos.length;
  UI.stats.done.textContent = state.todos.filter(t => t.done).length;
  UI.stats.today.textContent = active.filter(t => t.deadline && t.deadline.startsWith(todayStr)).length;
  UI.stats.overdue.textContent = active.filter(t => t.deadline && new Date(t.deadline) < now).length;

  let list = state.todos;
  if (state.filter === 'today') list = active.filter(t => t.deadline && t.deadline.startsWith(todayStr));
  if (state.filter === 'overdue') list = active.filter(t => t.deadline && new Date(t.deadline) < now);
  if (state.filter === 'done') list = state.todos.filter(t => t.done);
  if (state.filter === 'all') list = active; // 默认只看未完成

  UI.taskGroups.innerHTML = '';
  if (list.length === 0) {
    UI.taskGroups.innerHTML = `<div style="text-align:center; padding:5rem; color:var(--text-dim);">当前无待办事项</div>`;
    return;
  }

  const groups = {};
  list.forEach(t => {
    const cat = t.category || '其他';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(t);
  });

  Object.keys(groups).sort().forEach(cat => {
    const groupEl = document.createElement('div');
    groupEl.innerHTML = `<h3 style="font-size:0.7rem; color:var(--text-dim); text-transform:uppercase; margin:2rem 0 1rem; letter-spacing:1px;">${cat}</h3>`;
    groups[cat].forEach(t => {
      const card = document.createElement('div');
      card.className = 'task-card';
      card.innerHTML = `
        <div class="task-check-circle ${t.done ? 'checked' : ''}"></div>
        <div class="task-content">
          <div class="task-title" style="${t.done ? 'text-decoration:line-through; opacity:0.5' : ''}">${t.text}</div>
          <div class="task-meta">
            <span style="color:${t.priority==='高'?'#f87171':t.priority==='中'?'#fbbf24':'#34d399'}">● ${t.priority}</span>
            ${t.deadline ? `<span>🕒 ${new Date(t.deadline).toLocaleDateString()}</span>` : ''}
          </div>
        </div>
        <div class="task-actions"><button class="del-btn" style="background:none;border:none;color:var(--text-dim);cursor:pointer;">✕</button></div>
      `;
      card.querySelector('.task-check-circle').onclick = () => updateTodo(t.id, { done: !t.done });
      card.querySelector('.del-btn').onclick = () => deleteTodo(t.id);
      groupEl.appendChild(card);
    });
    UI.taskGroups.appendChild(groupEl);
  });
}

async function updateTodo(id, data) {
  try {
    await request(`${API}/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    await loadData();
  } catch (e) { alert(e.message); }
}

async function deleteTodo(id) {
  if (!confirm('确认删除？')) return;
  try {
    await request(`${API}/${id}`, { method: 'DELETE' });
    await loadData();
  } catch (e) { alert(e.message); }
}

async function handleAdd() {
  const text = UI.todoInput.value.trim();
  if (!text) return;
  UI.addBtn.disabled = true;
  try {
    const cat = document.querySelector('#cat-tags .active')?.dataset.value || null;
    const pri = document.querySelector('#pri-tags .active')?.dataset.value || '中';
    await request(API, { method: 'POST', body: JSON.stringify({ text, category: cat, priority: pri }) });
    UI.todoInput.value = '';
    await loadData();
  } catch (e) { alert(e.message); }
  finally { UI.addBtn.disabled = false; }
}

// ── 交互绑定 ──────────────────────────────────────────────────────────────────
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

document.getElementById('auth-submit').onclick = async () => {
  const username = document.getElementById('auth-username').value;
  const password = document.getElementById('auth-password').value;
  const isRegister = document.getElementById('tab-register').style.borderBottom !== 'none';
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
    }
  } catch (e) { alert(e.message); }
};

document.getElementById('tab-login').onclick = () => toggleAuthTab(true);
document.getElementById('tab-register').onclick = () => toggleAuthTab(false);

function toggleAuthTab(isLogin) {
  document.getElementById('tab-login').style.borderBottom = isLogin ? '2px solid var(--accent)' : 'none';
  document.getElementById('tab-register').style.borderBottom = !isLogin ? '2px solid var(--accent)' : 'none';
}

function logout() { localStorage.clear(); location.reload(); }
document.getElementById('logout-btn').onclick = logout;

function initApp() {
  UI.authOverlay.classList.add('hidden');
  UI.app.classList.remove('hidden');
  document.getElementById('username-display').textContent = state.username;
  loadData();
}

if (state.token) initApp();
else UI.authOverlay.classList.remove('hidden');
