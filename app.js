'use strict';
/* ── Storage ────────────────────────────────────────────────── */
const STORAGE_KEY = 'trackerData_v1';
const BACKUP_KEY  = 'trackerData_backup';
const SCHEMA_VERSION = 5;

function defaultStore() {
  return {
    schemaVersion: SCHEMA_VERSION,
    bodyweight: [],       // [{date, kg}]
    workoutLogs: {},      // { 'YYYY-MM-DD': workoutName | 'Rest' | null }
    setLogs: {},          // { 'YYYY-MM-DD_exerciseId_setIdx': {weight, reps, done} }
    mealLogs: {},         // { 'YYYY-MM-DD': { mealId: bool } }
    waterLogs: {},        // { 'YYYY-MM-DD': number (glasses of 250ml) }
    supplementLogs: {},   // { 'YYYY-MM-DD': { suppId: bool } }
    mealOrder: {},        // { 'YYYY-MM-DD': [mealId, ...] }
    settings: { waterUnit: 'cups', waterGoalCups: 16 }, // unit is display only; goal stored in cups
    lastBackup: null,
    firstRun: true
  };
}

// migrations[n] upgrades data from version n to n+1. Never remove entries.
const migrations = [
  d => Object.assign(defaultStore(), d, { firstRun: d.firstRun ?? true }),
  d => { d.mealOrder = d.mealOrder || {}; return d; },
  d => { d.settings = Object.assign({ waterUnit: 'L' }, d.settings); return d; },
  d => { if (!['cups', 'oz'].includes(d.settings.waterUnit)) d.settings.waterUnit = 'cups'; return d; },
  d => { if (!(d.settings.waterGoalCups > 0)) d.settings.waterGoalCups = 16; return d; }
];

function runMigrations(data) {
  let v = data.schemaVersion || 0;
  while (v < SCHEMA_VERSION) {
    if (migrations[v]) data = migrations[v](data);
    v++;
    data.schemaVersion = v;
  }
  return data;
}

const Store = {
  _data: null,
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if ((parsed.schemaVersion || 0) < SCHEMA_VERSION) {
          localStorage.setItem(BACKUP_KEY, raw);
          this._data = runMigrations(parsed);
          this.save();
        } else {
          this._data = parsed;
        }
      } else {
        this._data = defaultStore();
      }
    } catch (e) {
      // Keep unreadable data recoverable instead of overwriting it
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) localStorage.setItem(BACKUP_KEY + '_corrupt_' + Date.now(), raw);
      console.error('Store load error', e);
      this._data = defaultStore();
    }
  },
  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
  },
  get() { return this._data; },
  set(fn) {
    fn(this._data);
    this.save();
  },
  exportJSON() {
    Store.set(d => d.lastBackup = todayStr());
    return JSON.stringify(this._data, null, 2);
  },
  importJSON(json) {
    const parsed = JSON.parse(json);
    if (!parsed.schemaVersion) throw new Error('Invalid backup');
    if (parsed.schemaVersion > SCHEMA_VERSION) throw new Error('Backup is from a newer app version');
    // backup current
    localStorage.setItem(BACKUP_KEY, localStorage.getItem(STORAGE_KEY) || '{}');
    this._data = runMigrations(parsed);
    this.save();
  }
};

/* ── Date helpers ───────────────────────────────────────────── */
function todayStr() {
  return fmtDate(new Date());
}
function fmtDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function parseDate(s) {
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y, m-1, d);
}
function mondayOfWeek(d) {
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day);
  const m = new Date(d); m.setDate(d.getDate() + diff);
  return m;
}
function weekDays(monday) {
  return Array.from({length:7}, (_,i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    return d;
  });
}
const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

/* ── Workout helpers ────────────────────────────────────────── */
function workoutsThisWeek(monday) {
  const days = weekDays(monday);
  const logs = Store.get().workoutLogs;
  return days.map(d => logs[fmtDate(d)] || null);
}
function completedCountThisWeek(monday) {
  const entries = workoutsThisWeek(monday);
  return entries.filter(w => w && w !== 'Rest').length;
}
function nextWorkout(monday) {
  const done = new Set(workoutsThisWeek(monday).filter(Boolean));
  return PLAN.workoutOrder.find(w => !done.has(w)) || null;
}
function isTrainingDay(dateStr) {
  const w = Store.get().workoutLogs[dateStr];
  if (!w) return false;
  return ['Day 1','Day 2','Day 3','Day 4'].includes(w);
}

/* ── PR helpers ─────────────────────────────────────────────── */
function getPR(exerciseId) {
  const setLogs = Store.get().setLogs;
  let best = 0;
  for (const key of Object.keys(setLogs)) {
    if (key.includes('_' + exerciseId + '_')) {
      const entry = setLogs[key];
      if (entry.done && parseFloat(entry.weight) > best) best = parseFloat(entry.weight);
    }
  }
  return best;
}
function getLastSession(exerciseId, beforeDate) {
  const setLogs = Store.get().setLogs;
  // find most recent date before beforeDate that has this exercise
  const dates = Object.keys(setLogs)
    .filter(k => k.includes('_' + exerciseId + '_'))
    .map(k => k.split('_')[0])
    .filter(d => d < beforeDate);
  if (!dates.length) return null;
  dates.sort().reverse();
  const lastDate = dates[0];
  const setKeys = Object.keys(setLogs).filter(k => k.startsWith(lastDate + '_' + exerciseId + '_'));
  setKeys.sort();
  return setKeys.map(k => setLogs[k]).filter(s => s.done);
}

/* ── App shell ──────────────────────────────────────────────── */
const App = {
  currentScreen: 'today',
  screens: {},

  init() {
    Store.load();

    // Request persistent storage
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist();
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    // First run: ask for bodyweight
    const data = Store.get();
    if (data.firstRun) {
      Store.set(d => d.firstRun = false);
      if (!data.bodyweight.length) setTimeout(() => this.openWeightEntry(true), 0);
    }
    document.getElementById('weight-btn').addEventListener('click', () => this.openWeightEntry(false));

    // Nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.screen));
    });

    this.navigate('today');
    this.startRestTimerUI();
  },

  navigate(screen) {
    this.currentScreen = screen;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.screen === screen));
    document.getElementById('screen-title').textContent =
      {today:'Today', workouts:'Workouts', meals:'Meals', history:'History'}[screen];
    const container = document.getElementById('screen-container');
    container.innerHTML = '';
    const fn = this.screens[screen];
    if (fn) fn(container);
  },

  openWeightEntry(welcome) {
    const bw = Store.get().bodyweight;
    const last = bw.length ? bw.slice().sort((a, b) => a.date.localeCompare(b.date))[bw.length - 1] : null;
    this.showModal(`<h2>${welcome ? 'Welcome!' : 'Enter weight'}</h2>
      <p class="text-sm text-muted mt8">${welcome ? 'Enter your current bodyweight to start your log. You can add more anytime with the Weight button.' : last ? `Last: ${last.kg} on ${last.date}` : 'No entries yet.'}</p>
      <div class="row mt12">
        <input type="number" step="0.1" inputmode="decimal" id="bw-entry" style="flex:1" placeholder="Weight">
        <button class="btn btn-primary btn-sm" id="bw-entry-save">Save</button>
      </div>`);
    document.getElementById('bw-entry-save').onclick = () => {
      const v = parseFloat(document.getElementById('bw-entry').value);
      if (isNaN(v)) return;
      const ds = todayStr();
      Store.set(d => {
        d.bodyweight = d.bodyweight.filter(e => e.date !== ds);
        d.bodyweight.push({ date: ds, kg: v });
      });
      this.closeModal();
      this.toast('Weight saved');
      if (this.currentScreen === 'history') this.navigate('history');
    };
  },

  showModal(html) {
    document.getElementById('modal-content').innerHTML = html;
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById('modal-close').onclick = () => this.closeModal();
    document.getElementById('modal-overlay').onclick = (e) => {
      if (e.target === document.getElementById('modal-overlay')) this.closeModal();
    };
  },
  closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  },

  toast(msg, duration = 2000) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.add('hidden'), duration);
  },

  // Rest timer state
  _restTimer: null,
  startRestTimer(seconds) {
    if (this._restTimer) clearInterval(this._restTimer);
    if (!seconds || seconds <= 0) return;
    const bar = document.getElementById('rest-timer-bar');
    const display = document.getElementById('rest-timer-display');
    const progress = document.getElementById('rest-timer-progress');
    bar.classList.add('visible');
    let remaining = seconds;
    const total = seconds;
    const tick = () => {
      display.textContent = remaining + 's';
      progress.innerHTML = `<div class="progress-bar"><div class="progress-fill" style="width:${(remaining/total)*100}%"></div></div>`;
      if (remaining <= 0) {
        clearInterval(this._restTimer);
        this._restTimer = null;
        bar.classList.remove('visible');
        if (navigator.vibrate) navigator.vibrate([200,100,200]);
        this.beep();
        this.toast('Rest complete!');
      }
      remaining--;
    };
    tick();
    this._restTimer = setInterval(tick, 1000);
  },
  startRestTimerUI() {
    const bar = document.getElementById('rest-timer-bar');
    bar.innerHTML = `
      <span id="rest-timer-display">0s</span>
      <div id="rest-timer-progress" style="flex:1"></div>
      <button id="rest-timer-skip" class="btn btn-sm btn-secondary">Skip</button>
    `;
    document.getElementById('rest-timer-skip').onclick = () => {
      clearInterval(this._restTimer); this._restTimer = null;
      bar.classList.remove('visible');
    };
  },
  beep() {
    try {
      this._audio = this._audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = this._audio.createOscillator(), g = this._audio.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(this._audio.destination);
      g.gain.setValueAtTime(0.3, this._audio.currentTime);
      o.start(); o.stop(this._audio.currentTime + 0.4);
    } catch (e) {}
  },
  parseRestSeconds(restStr) {
    if (!restStr || restStr === 'none' || restStr === '—') return 0;
    const m = restStr.match(/(\d+)/);
    return m ? parseInt(m[1]) : 60;
  }
};
