/* ════════════════════════════════════════════
   Task Manager — script.js
   Covers: Tiers 1–4
   ════════════════════════════════════════════ */

/* ── State ── */
let tasks = [];
let categories = [];
let nextId = 1;
let searchQuery = '';
let filterCat = '';
let notifTimer = null;

/* ── DOM References ── */
const taskForm       = document.getElementById('taskForm');
const taskInput      = document.getElementById('taskInput');
const categorySelect = document.getElementById('categorySelect');
const prioritySelect = document.getElementById('prioritySelect');
const taskList       = document.getElementById('taskList');
const emptyState     = document.getElementById('emptyState');
const searchInput    = document.getElementById('searchInput');
const filterCategory = document.getElementById('filterCategory');
const statTotal      = document.getElementById('statTotal');
const statPending    = document.getElementById('statPending');
const statDone       = document.getElementById('statDone');
const notification   = document.getElementById('notification');
const darkToggle     = document.getElementById('darkModeToggle');
const exportBtn      = document.getElementById('exportBtn');
const loadingState   = document.getElementById('loadingState');

/* Core */

/* DOM selection, event listeners, and form submission handling */
taskForm.addEventListener('submit', function (event) {
  event.preventDefault();

  const text = taskInput.value.trim();
  if (!text) return;

  const task = {
    id: nextId++,
    text,
    completed: false,
    category: categorySelect.value || '',
    priority: prioritySelect.value || 'medium',
    timerSeconds: 0,
    timerRunning: false,
    timerInterval: null,
  };

  tasks.push(task);

  saveToLocalStorage();
  renderTasks();
  showNotification(`Task added: "${text}"`);
  taskInput.value = '';
});

/* Task actions with event delegation */
taskList.addEventListener('click', function (event) {
  const target = event.target;

  // Delete task
  if (target.classList.contains('del-btn')) {
    const id = +target.closest('.task-item').dataset.id;
    const task = getTask(id);
    deleteTask(id);
    showNotification(`Deleted: "${task.text}"`);
    return;
  }

  // Toggle completion
  if (target.classList.contains('task-check') || target.classList.contains('task-text')) {
    const id = +target.closest('.task-item').dataset.id;
    toggleComplete(id);
    return;
  }

  // Timer controls
  if (target.classList.contains('timer-btn')) {
    const id = +target.closest('.task-item').dataset.id;
    const action = target.dataset.action;
    handleTimer(id, action);
  }
});

function getTask(id) {
  return tasks.find(t => t.id === id);
}

function deleteTask(id) {
  const task = getTask(id);

  if (task && task.timerInterval) {
    clearInterval(task.timerInterval);
  }

  tasks = tasks.filter(t => t.id !== id);

  saveToLocalStorage();
  renderTasks();
}

function toggleComplete(id) {
  const task = getTask(id);
  if (!task) return;

  task.completed = !task.completed;

  saveToLocalStorage();
  renderTasks();

  showNotification(
    task.completed ? 'Task completed ✓' : 'Task reopened'
  );
}

/* Rendering */

function renderTasks() {
  updateStats();
  taskList.innerHTML = '';

  const filtered = tasks.filter(task => {
    const matchSearch = task.text
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    const matchCat =
      filterCat === '' || task.category === filterCat;

    return matchSearch && matchCat;
  });

  if (filtered.length === 0) {
    emptyState.classList.add('visible');
  } else {
    emptyState.classList.remove('visible');
  }

  filtered.forEach(task => {
    const li = document.createElement('li');

    li.className =
      `task-item priority-${task.priority}${
        task.completed ? ' completed' : ''
      }`;

    li.dataset.id = task.id;

    const catBadge = task.category
      ? `<span class="category-badge">${escapeHtml(task.category)}</span>`
      : '';

    const timerClass =
      task.timerRunning
        ? 'running'
        : (task.timerSeconds === 0 ? '' : '');

    const timerLabel = formatTime(task.timerSeconds);

    li.innerHTML = `
      <div class="task-check"></div>

      <div class="task-main">
        <span class="task-text">${escapeHtml(task.text)}</span>

        <div class="task-meta">
          ${catBadge}

          <span
            class="timer-display ${timerClass}"
            id="timer-${task.id}"
          >
            ${timerLabel}
          </span>

          <div class="timer-controls">
            <button class="timer-btn" data-action="start" title="Start">▶</button>
            <button class="timer-btn" data-action="pause" title="Pause">⏸</button>
            <button class="timer-btn" data-action="reset" title="Reset">↺</button>
            <button class="timer-btn" data-action="add" title="+1 min">+1m</button>
          </div>
        </div>
      </div>

      <div class="task-actions">
        <button class="del-btn" title="Delete">×</button>
      </div>
    `;

    // Inline editing on double-click
    const textSpan = li.querySelector('.task-text');

    textSpan.addEventListener('dblclick', function () {
      startEditing(task.id, textSpan);
    });

    taskList.appendChild(li);
  });
}

/* Task statistics */
function updateStats() {
  const total   = tasks.length;
  const done    = tasks.filter(t => t.completed).length;
  const pending = total - done;

  statTotal.textContent   = `${total} total`;
  statPending.textContent = `${pending} pending`;
  statDone.textContent    = `${done} done`;
}

/* TIER 2 — Inline Editing */

function startEditing(id, span) {
  const task = getTask(id);
  if (!task) return;

  const input = document.createElement('input');

  input.type = 'text';
  input.value = task.text;
  input.className = 'task-text-input';

  span.replaceWith(input);

  input.focus();
  input.select();

  function commitEdit() {
    const newText = input.value.trim();

    if (newText) {
      task.text = newText;
    }

    saveToLocalStorage();
    renderTasks();
  }

  input.addEventListener('blur', commitEdit);

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') input.blur();

    if (e.key === 'Escape') {
      input.value = task.text;
      input.blur();
    }
  });
}

/* TIER 2 — Search + Debounce */

/* Debounce helper */
function debounce(fn, delay) {
  let timer;

  return function (...args) {
    clearTimeout(timer);

    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

const handleSearch = debounce(function (event) {
  searchQuery = event.target.value;
  renderTasks();
}, 300);

searchInput.addEventListener('input', handleSearch);

/* Category filter */
filterCategory.addEventListener('change', function (event) {
  filterCat = event.target.value;
  renderTasks();
});

/*  Notifications + Loading State */

/* Auto-hide notification */
function showNotification(msg) {
  notification.textContent = msg;

  notification.classList.remove('hidden');

  if (notifTimer) {
    clearTimeout(notifTimer);
  }

  notifTimer = setTimeout(() => {
    notification.classList.add('hidden');
  }, 2500);
}

/* Loading indicator */
function setLoading(on) {
  loadingState.classList.toggle('hidden', !on);
}

/* Fetch + Async/Await + Error Handling */

/* Load categories from API */
async function fetchCategories() {
  setLoading(true);

  try {
    const response = await fetch(
      'https://jsonplaceholder.typicode.com/users'
    );

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();

    // Use company names as categories
    categories = data
      .slice(0, 6)
      .map(u => u.company.name);

    populateCategoryDropdowns();

    showNotification('Categories loaded ✓');

  } catch (error) {

    showNotification(
      `Could not load categories: ${error.message}`
    );

    // Fallback categories
    categories = ['Work', 'Personal', 'School', 'Health'];

    populateCategoryDropdowns();

  } finally {
    setLoading(false);
  }
}

function populateCategoryDropdowns() {
  const opts = categories
    .map(c =>
      `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`
    )
    .join('');

  categorySelect.innerHTML =
    `<option value="">Category</option>${opts}`;

  filterCategory.innerHTML =
    `<option value="">All categories</option>${opts}`;
}

/* Countdown Timers */

function handleTimer(id, action) {
  const task = getTask(id);

  if (!task) return;

  if (action === 'start') {

    if (task.timerRunning) return;

    if (task.timerSeconds === 0) {
      task.timerSeconds = 60;
    }

    task.timerRunning = true;

    task.timerInterval = setInterval(() => {
      task.timerSeconds--;

      updateTimerDisplay(task);

      if (task.timerSeconds <= 0) {
        task.timerSeconds = 0;
        task.timerRunning = false;

        clearInterval(task.timerInterval);

        task.timerInterval = null;

        updateTimerDisplay(task);

        showNotification(`⏰ Timer done: "${task.text}"`);
      }

    }, 1000);

    updateTimerDisplay(task);
  }

  if (action === 'pause') {

    if (task.timerInterval) {
      clearInterval(task.timerInterval);
      task.timerInterval = null;
    }

    task.timerRunning = false;

    updateTimerDisplay(task);
  }

  if (action === 'reset') {

    if (task.timerInterval) {
      clearInterval(task.timerInterval);
    }

    task.timerInterval = null;
    task.timerRunning = false;
    task.timerSeconds = 0;

    updateTimerDisplay(task);
  }

  if (action === 'add') {
    task.timerSeconds += 60;
    updateTimerDisplay(task);
  }
}

function updateTimerDisplay(task) {
  const el = document.getElementById(`timer-${task.id}`);

  if (!el) return;

  el.textContent = formatTime(task.timerSeconds);

  el.className =
    'timer-display' +
    (task.timerRunning ? ' running' : '') +
    (task.timerSeconds === 0 && !task.timerRunning ? '' : '');
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');

  const s = (seconds % 60)
    .toString()
    .padStart(2, '0');

  return `${m}:${s}`;
}

/* Dark Mode */

darkToggle.addEventListener('click', function () {

  document.body.classList.toggle('dark');

  const isDark =
    document.body.classList.contains('dark');

  localStorage.setItem(
    'darkMode',
    isDark ? '1' : '0'
  );

  showNotification(
    isDark ? 'Dark mode on' : 'Light mode on'
  );
});

/*  localStorage Persistence */

function saveToLocalStorage() {

  new Promise((resolve, reject) => {

    try {

      // Remove intervals before saving
      const saveable = tasks.map(
        ({ timerInterval, ...rest }) => rest
      );

      localStorage.setItem(
        'tm_tasks',
        JSON.stringify(saveable)
      );

      localStorage.setItem(
        'tm_nextId',
        nextId
      );

      resolve();

    } catch (e) {
      reject(e);
    }

  }).catch(err => {
    console.warn('localStorage save failed:', err);
  });
}

function loadFromLocalStorage() {

  return new Promise((resolve, reject) => {

    try {

      const saved =
        localStorage.getItem('tm_tasks');

      const savedId =
        localStorage.getItem('tm_nextId');

      if (saved) {
        tasks = JSON.parse(saved).map(t => ({
          ...t,
          timerInterval: null
        }));
      }

      if (savedId) {
        nextId = parseInt(savedId, 10);
      }

      resolve();

    } catch (e) {
      reject(e);
    }
  });
}

/* Export JSON */

exportBtn.addEventListener('click', function () {

  const exportable = tasks.map(
    ({ timerInterval, ...rest }) => rest
  );

  const blob = new Blob(
    [JSON.stringify(exportable, null, 2)],
    { type: 'application/json' }
  );

  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');

  a.href = url;
  a.download = 'tasks.json';

  a.click();

  URL.revokeObjectURL(url);

  showNotification('Tasks exported as JSON');
});

/* Boot */

async function init() {

  // Restore saved dark mode
  if (localStorage.getItem('darkMode') === '1') {
    document.body.classList.add('dark');
  }

  // Restore saved tasks
  try {
    await loadFromLocalStorage();

  } catch (e) {
    console.warn(
      'Could not load tasks from localStorage'
    );
  }

  renderTasks();

  // Load categories from API
  await fetchCategories();
}

init();

/* ── Utilities ── */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}