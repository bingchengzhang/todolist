const API = '/api/todos';

const input       = document.getElementById('todo-input');
const addBtn      = document.getElementById('add-btn');
const inputErr    = document.getElementById('input-error');
const todoList    = document.getElementById('todo-list');
const doneList    = document.getElementById('done-list');
const doneCount   = document.getElementById('done-count');
const headerCount = document.getElementById('header-count');
const emptyHint   = document.getElementById('empty-hint');
const doneToggle  = document.getElementById('done-toggle');

// ── PWA ──────────────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}

// ── Completed section toggle ──────────────────────────────────────────────────
doneToggle.addEventListener('click', () => {
  const expanded = doneToggle.getAttribute('aria-expanded') === 'true';
  doneToggle.setAttribute('aria-expanded', String(!expanded));
  doneList.classList.toggle('collapsed', expanded);
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function loadTodos() {
  try {
    const res  = await fetch(`${API}/`);
    const data = await res.json();
    todoList.innerHTML = '';
    doneList.innerHTML = '';
    let active = 0, completed = 0;
    data.forEach(todo => {
      if (todo.done) { completed++; doneList.appendChild(buildItem(todo)); }
      else           { active++;    todoList.appendChild(buildItem(todo)); }
    });
    updateCounts(active, completed);
  } catch {
    // offline — keep existing DOM
  }
}

function updateCounts(active, completed) {
  headerCount.textContent = active > 0 ? `${active} 项` : '全部完成';
  doneCount.textContent   = completed;
  emptyHint.classList.toggle('hidden', active > 0);
}

// ── Build card ────────────────────────────────────────────────────────────────
function buildItem(todo, loading = false) {
  const li = document.createElement('li');
  li.className = 'todo-item' + (todo.done ? ' done' : '') + (todo.priority ? ` priority-${todo.priority}` : '');
  li.dataset.id = todo.id;

  // Checkbox
  const checkWrap = document.createElement('label');
  checkWrap.className = 'check-wrap';

  const cb = document.createElement('input');
  cb.type    = 'checkbox';
  cb.checked = todo.done;
  cb.addEventListener('change', () => toggleDone(todo.id, cb.checked, li));

  const circle = document.createElement('span');
  circle.className = 'check-circle';
  circle.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none"
    stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="20 6 9 17 4 12"/></svg>`;

  checkWrap.appendChild(cb);
  checkWrap.appendChild(circle);

  // Body
  const body = document.createElement('div');
  body.className = 'todo-body';

  const textEl = document.createElement('p');
  textEl.className   = 'todo-text';
  textEl.textContent = todo.text;

  const meta = document.createElement('div');
  meta.className = 'todo-meta';

  if (loading) {
    const tag = document.createElement('span');
    tag.className   = 'loading-tag';
    tag.textContent = 'AI 分析中';
    meta.appendChild(tag);
  } else {
    if (todo.category) {
      const cat = document.createElement('span');
      cat.className   = 'badge badge-category';
      cat.textContent = todo.category;
      meta.appendChild(cat);
    }

    const sel = document.createElement('select');
    sel.className = `priority-select priority-select-${todo.priority || '中'}`;
    sel.setAttribute('aria-label', '优先级');
    ['高', '中', '低'].forEach(p => {
      const opt = document.createElement('option');
      opt.value = p; opt.textContent = p;
      if (p === todo.priority) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', async () => {
      const p = sel.value;
      // Update glow class on card
      li.classList.remove('priority-高', 'priority-中', 'priority-低');
      li.classList.add(`priority-${p}`);
      sel.className = `priority-select priority-select-${p}`;
      await fetch(`${API}/${todo.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ priority: p }),
      });
    });
    sel.addEventListener('click', e => e.stopPropagation());
    meta.appendChild(sel);
  }

  body.appendChild(textEl);
  if (loading || todo.category || todo.priority) body.appendChild(meta);

  // Delete button
  const del = document.createElement('button');
  del.className = 'delete-btn';
  del.title     = '删除';
  del.setAttribute('aria-label', '删除');
  del.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
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
  const text = input.value.trim();
  inputErr.classList.add('hidden');

  if (!text) { showError('请输入任务内容'); return; }
  if (text.length > 200) { showError('任务内容不能超过 200 字'); return; }

  addBtn.disabled = true;
  input.value = '';

  const placeholder = buildItem({ id: 0, text, done: false, category: '', priority: '中' }, true);
  todoList.prepend(placeholder);
  emptyHint.classList.add('hidden');
  headerCount.textContent = `${todoList.children.length} 项`;

  try {
    const res  = await fetch(`${API}/`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text }),
    });
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || '添加失败');
      placeholder.remove();
      recalcCounts();
      return;
    }

    const real = buildItem({ id: data.id, text, done: false, category: data.category, priority: data.priority });
    placeholder.replaceWith(real);
  } catch {
    showError('网络错误，请重试');
    placeholder.remove();
    recalcCounts();
  } finally {
    addBtn.disabled = false;
  }
}

// ── Toggle done ───────────────────────────────────────────────────────────────
async function toggleDone(id, done, li) {
  if (done) {
    // Dissolve animation before moving to done list
    li.classList.add('dissolving');
    await new Promise(r => setTimeout(r, 360));
  }
  try {
    await fetch(`${API}/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ done }),
    });
  } catch {}
  loadTodos();
}

// ── Delete ────────────────────────────────────────────────────────────────────
async function removeTodo(id, li) {
  li.classList.add('removing');
  await new Promise(r => setTimeout(r, 200));
  li.remove();
  recalcCounts();
  try { await fetch(`${API}/${id}`, { method: 'DELETE' }); } catch {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function showError(msg) {
  inputErr.textContent = msg;
  inputErr.classList.remove('hidden');
}

function recalcCounts() {
  updateCounts(todoList.children.length, doneList.children.length);
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadTodos();
