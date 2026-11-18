const PROD_URL = 'https://web-production-f1ba1.up.railway.app';

function getBaseUrl() {
  const host = window.location.hostname;
  if (host === '127.0.0.1' || host === 'localhost') {
    return 'http://127.0.0.1:5000';
  }
  return PROD_URL;
}

const BASE_URL = getBaseUrl();
const API = `${BASE_URL}/api/todos/`;
const AUTH = `${BASE_URL}/api/auth/`;

let state = {
  token: localStorage.getItem('token') || '',
  username: localStorage.getItem('username') || '',
  todos: [],
  filter: 'all'
};

// 默认停在登录页签。不能靠 borderBottom 判断：写了 border: none 时，读回来是空字符串。
let authMode = 'login';

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

const particles = (function() {
  const canvas = document.getElementById('particle-canvas');
  const ctx = canvas.getContext('2d');
  let pts = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function spawn(x, y, color = '#8b5cf6') {
    for (let i = 0; i < 25; i++) {
      pts.push({
        x, y,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12 - 3,
        life: 1,
        decay: Math.random() * 0.02 + 0.015,
        color
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.25;
      p.life -= p.decay;
      if (p.life <= 0) { pts.splice(i, 1); continue; }
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize(); draw();
  return { spawn };
})();

async function request(url, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  try {
    const res = await fetch(url, { ...opts, headers });
    if (res.status === 401) { logout(); return null; }
    return await res.json();
  } catch (e) {
    console.error('Fetch error:', e);
    return { ok: false, error: '连接失败' };
  }
}

async function loadData() {
  const data = await request(API);
  if (data && Array.isArray(data)) {
    state.todos = data;
    render();
  }
}

async function toggleTodo(id, el) {
  const todo = state.todos.find(t => t.id === id);
  if (!todo) return;

  const rect = el.getBoundingClientRect();
  particles.spawn(rect.left + 12, rect.top + 12, todo.done ? '#94a3b8' : '#8b5cf6');

  const oldStatus = todo.done;
  todo.done = !todo.done;
  render();

  const res = await request(`${API}${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ done: todo.done })
  });

  if (!res || !res.ok) {
    todo.done = oldStatus;
    render();
    alert('同步失败，已回滚状态');
  }
}

async function handleAdd() {
  const text = UI.todoInput.value.trim();
  if (!text) return;

  const category = document.querySelector('#cat-tags .active')?.dataset.value || null;
  const priority = document.querySelector('#pri-tags .active')?.dataset.value || '中';

  UI.addBtn.disabled = true;
  UI.todoInput.value = '';

  const res = await request(API, {
    method: 'POST',
    body: JSON.stringify({ text, category, priority })
  });

  if (res && res.ok) {
    await loadData();
  } else {
    alert('添加失败');
  }
  UI.addBtn.disabled = false;
}

function render() {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const active = state.todos.filter(t => !t.done);
  const done = state.todos.filter(t => t.done);

  UI.stats.all.textContent = state.todos.length;
  UI.stats.done.textContent = done.length;
  UI.stats.today.textContent = active.filter(t => t.deadline && t.deadline.startsWith(todayStr)).length;
  UI.stats.overdue.textContent = active.filter(t => t.deadline && new Date(t.deadline) < now).length;

  let list = state.todos;
  if (state.filter === 'today') list = active.filter(t => t.deadline && t.deadline.startsWith(todayStr));
  if (state.filter === 'overdue') list = active.filter(t => t.deadline && new Date(t.deadline) < now);
  if (state.filter === 'done') list = done;
  if (state.filter === 'all') list = active;

  UI.taskGroups.innerHTML = '';
  const groups = {};
  list.forEach(t => {
    const cat = t.category || '其他';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(t);
  });

  Object.keys(groups).sort().forEach((cat, idx) => {
    const groupEl = document.createElement('div');
    groupEl.style.animationDelay = `${idx * 0.1}s`;
    groupEl.innerHTML = `<h3 style="font-size:0.7rem; color:var(--text-dim); text-transform:uppercase; margin:2.5rem 0 1rem; letter-spacing:1.5px;">${cat}</h3>`;
    groups[cat].forEach(t => {
      const card = document.createElement('div');
      card.className = 'task-card';
      card.innerHTML = `
        <div class="task-check-circle ${t.done ? 'checked' : ''}"></div>
        <div class="task-content">
          <div class="task-title" style="${t.done ? 'text-decoration:line-through; opacity:0.5' : ''}">${t.text}</div>
          <div class="task-meta">
            <span style="color:${t.priority==='高'?'#f87171':t.priority==='中'?'#fbbf24':'#34d399'}">● ${t.priority}</span>
          </div>
        </div>
      `;
      card.querySelector('.task-check-circle').onclick = (e) => toggleTodo(t.id, e.target);
      groupEl.appendChild(card);
    });
    UI.taskGroups.appendChild(groupEl);
  });
}

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
  const isRegister = authMode === 'register';
  const data = await request(`${AUTH}${isRegister ? 'register' : 'login'}`, {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  if (data && data.ok) {
    state.token = data.token;
    state.username = username;
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', username);
    initApp();
  } else {
    alert(data.error || '认证失败');
  }
};

document.getElementById('tab-login').onclick = () => toggleAuthTab(true);
document.getElementById('tab-register').onclick = () => toggleAuthTab(false);
function toggleAuthTab(isLogin) {
  authMode = isLogin ? 'login' : 'register';
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
