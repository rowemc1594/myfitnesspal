'use strict';
/* ── Storage ────────────────────────────────────────────────── */
const STORAGE_KEY = 'trackerData_v1';
const BACKUP_KEY  = 'trackerData_backup';
const SCHEMA_VERSION = 7;

function defaultStore() {
  return {
    schemaVersion: SCHEMA_VERSION,
    bodyweight: [],       // [{date, kg}]
    workoutLogs: {},      // completed: { 'YYYY-MM-DD': workoutName } ('Rest' entries from old data are ignored)
    workoutPlan: {},      // chosen for the day, overrides PLAN.schedule: { 'YYYY-MM-DD': workoutName | 'Rest' }
    setLogs: {},          // { 'YYYY-MM-DD_exerciseId_setIdx': {weight, reps, done} }
    mealLogs: {},         // { 'YYYY-MM-DD': { mealId: bool } }
    waterLogs: {},        // { 'YYYY-MM-DD': number (glasses of 250ml) }
    supplementLogs: {},   // { 'YYYY-MM-DD': { suppId: bool } }
    mealOrder: {},        // { 'YYYY-MM-DD': [mealId, ...] }
    extraFoods: {},       // off-plan food: { 'YYYY-MM-DD': [{name, amount, cal, p, f}] }
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
  d => { if (!(d.settings.waterGoalCups > 0)) d.settings.waterGoalCups = 16; return d; },
  // Picking a workout used to mean "completed"; keep those as completed and also record them as the day's plan
  d => { d.workoutPlan = Object.assign({}, d.workoutLogs, d.workoutPlan); return d; },
  // Off-plan food log
  d => { d.extraFoods = d.extraFoods || {}; return d; }
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
function completedWorkout(ds) {
  const w = Store.get().workoutLogs[ds];
  return w && w !== 'Rest' ? w : null;
}
// The week's plan, re-flowed around what actually happened:
// - completed days and days you picked a workout for keep it
// - past days with nothing done are "skipped": their workout is offered as a catch-up, not slid forward
// - workouts displaced by a swap (doing/picking something else) slide into the next open training days in program order
// Returns { plan: [7 workout names], skipped: [...], unscheduled: [...didn't fit this week] }
function weekPlan(monday) {
  const days = weekDays(monday).map(fmtDate);
  const today = todayStr();
  const ref = days.includes(today) ? days.indexOf(today) : (today > days[6] ? 7 : 0);
  const picks = Store.get().workoutPlan;
  const done = days.map(completedWorkout);
  const doneSet = new Set(done.filter(Boolean));
  const taken = new Set(doneSet);
  const skipped = [];
  const plan = days.map((ds, i) => {
    if (done[i]) return done[i];
    if (i >= ref) {
      if (picks[ds]) { taken.add(picks[ds]); return picks[ds]; }
      return null;
    }
    const w = picks[ds] || PLAN.schedule[i];
    if (w !== 'Rest' && !doneSet.has(w)) { skipped.push(w); taken.add(w); }
    return w;
  });
  const queue = PLAN.workoutOrder.filter(w => !taken.has(w));
  plan.forEach((w, i) => {
    if (w) return;
    plan[i] = PLAN.schedule[i] === 'Rest' ? 'Rest' : (queue.shift() || 'Rest');
  });
  return { plan, skipped: [...new Set(skipped)], unscheduled: queue };
}
function plannedWorkout(ds) {
  const d = parseDate(ds);
  return weekPlan(mondayOfWeek(d)).plan[(d.getDay() + 6) % 7];
}
function setPlanned(ds, w) {
  Store.set(d => d.workoutPlan[ds] = w);
}
function setCompleted(ds, w) {
  Store.set(d => { if (w) { d.workoutLogs[ds] = w; d.workoutPlan[ds] = w; } else delete d.workoutLogs[ds]; });
}
function workoutsThisWeek(monday) {
  return weekDays(monday).map(d => completedWorkout(fmtDate(d)));
}
function workoutOptionsHTML(current) {
  return [...PLAN.workoutOrder, 'Rest'].map(w => `
    <button class="wo-option ${current === w ? 'selected' : ''}" data-wo="${w}" aria-pressed="${current === w}">
      <span class="radio"></span>
      <span><span class="wo-name">${w}</span><span class="text-sm text-muted" style="display:block">${PLAN.focus[w]}</span></span>
    </button>`).join('');
}
function completedCountThisWeek(monday) {
  const entries = workoutsThisWeek(monday);
  return entries.filter(w => w && w !== 'Rest').length;
}
function isTrainingDay(dateStr) {
  const w = completedWorkout(dateStr) || plannedWorkout(dateStr);
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
// Most recent day before beforeDate with completed sets for this exercise: { date, sets: [{weight, reps} | null by set index] }
function lastSession(exerciseId, beforeDate) {
  const setLogs = Store.get().setLogs;
  let date = null;
  const byDate = {};
  for (const [key, v] of Object.entries(setLogs)) {
    const [d, id, idx] = key.split('_');
    if (id !== exerciseId || d >= beforeDate || !v.done || (!v.weight && !v.reps)) continue;
    (byDate[d] = byDate[d] || [])[parseInt(idx)] = { weight: v.weight, reps: v.reps };
    if (!date || d > date) date = d;
  }
  return date ? { date, sets: byDate[date] } : null;
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
    // Timer: refresh pill on scroll; re-acquire wake lock when returning to the app
    document.getElementById('screen-container').addEventListener('scroll', () => this.timer.state && this._renderTimerPill(), { passive: true });
    window.addEventListener('scroll', () => this.timer.state && this._renderTimerPill(), { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      this._wake = null;
      if (this.timer.state || this.currentScreen === 'workouts') this.keepAwake(true);
      this.timer._tick();
    });
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
    this.keepAwake(screen === 'workouts' || !!this.timer.state);
    this._renderTimerPill();
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

  // Tap-twice confirm (native confirm() can be suppressed in installed web apps).
  // First tap arms the button for 3 s and shows `label`; second tap runs `action`.
  confirmTap(btn, label, action) {
    if (btn.dataset.armed) { clearTimeout(btn._disarm); delete btn.dataset.armed; btn.innerHTML = btn._orig; btn.classList.remove('armed'); action(); return; }
    btn.dataset.armed = '1';
    btn._orig = btn.innerHTML;
    btn.innerHTML = label;
    btn.classList.add('armed');
    btn._disarm = setTimeout(() => { delete btn.dataset.armed; btn.innerHTML = btn._orig; btn.classList.remove('armed'); }, 3000);
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

  // ── Timer ──
  // One timer at a time. Counts from an end timestamp, so it stays right if the
  // phone sleeps or the app is backgrounded. Screens subscribe to redraw inline.
  //   start({ seconds, kind: 'rest'|'work', label, anchor, onDone })
  //   anchor: a string key the screen uses to show the countdown in place (e.g. 'set:exId:2')
  timer: {
    state: null,          // { endAt, total, kind, label, anchor, onDone, doneAt }
    _iv: null,
    _subs: new Set(),
    start(opts) {
      App.unlockAudio();
      const total = Math.max(1, Math.round(opts.seconds));
      this.state = { ...opts, total, endAt: Date.now() + total * 1000, doneAt: null };
      clearInterval(this._iv);
      this._iv = setInterval(() => this._tick(), 250);
      App.keepAwake(true);
      this._tick();
    },
    add(sec) {
      if (!this.state || this.state.doneAt) return;
      this.state.endAt += sec * 1000;
      this.state.lastCount = null;
      this.state.total = Math.max(this.state.total, this.remaining());
      this._tick();
    },
    stop() {
      clearInterval(this._iv); this._iv = null;
      this.state = null;
      this._emit();
      App.keepAwake(App.currentScreen === 'workouts');
    },
    remaining() { return this.state ? Math.max(0, Math.ceil((this.state.endAt - Date.now()) / 1000)) : 0; },
    _tick() {
      const st = this.state;
      if (!st) return;
      // Countdown: one short beep at 5, 4, 3, 2, 1 seconds left
      const rem = this.remaining();
      if (!st.doneAt && rem >= 1 && rem <= 5 && st.lastCount !== rem) {
        st.lastCount = rem;
        App.beep(1, 660, 0.12);
        if (navigator.vibrate) navigator.vibrate(60);
      }
      if (!st.doneAt && Date.now() >= st.endAt) {
        st.doneAt = Date.now();
        if (navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 300]);
        App.beep(3);
        if (st.onDone) try { st.onDone(); } catch (e) {}
      }
      // Leave the "Go" state up for 6 s, then clear
      if (st.doneAt && Date.now() - st.doneAt > 6000) { this.stop(); return; }
      this._emit();
    },
    on(fn) { this._subs.add(fn); return () => this._subs.delete(fn); },
    _emit() { App._renderTimerPill(); this._subs.forEach(fn => { try { fn(this.state); } catch (e) {} }); }
  },

  fmtClock(sec) { return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; },

  // Pinned pill under the header; tap to jump back to where the timer lives
  _renderTimerPill() {
    const pill = document.getElementById('rest-timer-bar');
    const st = this.timer.state;
    if (!st) { pill.classList.remove('visible', 'go'); return; }
    const rem = this.timer.remaining();
    const anchorEl = st.anchor && document.querySelector(`[data-timer-anchor="${st.anchor}"]`);
    // Hide the pill while the inline countdown is on screen
    let inView = false;
    if (anchorEl) { const r = anchorEl.getBoundingClientRect(); inView = r.bottom > 60 && r.top < window.innerHeight - 80; }
    pill.classList.toggle('visible', !inView);
    pill.classList.toggle('go', !!st.doneAt);
    pill.classList.toggle('work', st.kind === 'work');
    pill.innerHTML = `<button class="tp-main">${st.doneAt ? (st.kind === 'work' ? 'Time!' : 'Go!') : `${st.kind === 'work' ? 'Work' : 'Rest'} ${this.fmtClock(rem)}`}
        <span class="tp-label">${st.label || ''}</span></button>
      ${st.doneAt ? '' : '<button class="tp-btn" data-t="add">+15</button>'}
      <button class="tp-btn" data-t="stop" aria-label="Stop timer">✕</button>`;
    pill.querySelector('.tp-main').onclick = () => {
      const el = st.anchor && document.querySelector(`[data-timer-anchor="${st.anchor}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      else if (st.anchor && this.currentScreen !== 'workouts') { this.navigate('workouts'); setTimeout(() => this._renderTimerPill(), 50); }
    };
    const add = pill.querySelector('[data-t="add"]');
    if (add) add.onclick = () => this.timer.add(15);
    pill.querySelector('[data-t="stop"]').onclick = () => this.timer.stop();
  },

  // Keep the screen on during a workout (where supported) so the timer can be heard
  async keepAwake(on) {
    try {
      if (on && !this._wake && 'wakeLock' in navigator && document.visibilityState === 'visible') {
        this._wake = await navigator.wakeLock.request('screen');
        this._wake.addEventListener('release', () => { this._wake = null; });
      } else if (!on && this._wake) { await this._wake.release(); this._wake = null; }
    } catch (e) { this._wake = null; }
  },

  // Audio must be started from a tap on iOS; called when a timer starts
  unlockAudio() {
    try {
      this._audio = this._audio || new (window.AudioContext || window.webkitAudioContext)();
      if (this._audio.state === 'suspended') this._audio.resume();
    } catch (e) {}
  },
  beep(times = 1, freq = 880, len = 0.25) {
    try {
      this.unlockAudio();
      const ctx = this._audio, t0 = ctx.currentTime;
      for (let i = 0; i < times; i++) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = freq; o.connect(g); g.connect(ctx.destination);
        const t = t0 + i * 0.35;
        g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
        o.start(t); o.stop(t + len + 0.01);
      }
    } catch (e) {}
  },
  // Rest string -> seconds. Ranges use the low end ("60-90s" -> 60, "0-15s" -> 0); "2 min" -> 120
  parseRestSeconds(restStr) {
    if (!restStr || restStr === 'none' || restStr === '—') return 0;
    const m = restStr.match(/(\d+)/);
    if (!m) return 0;
    return parseInt(m[1]) * (/min/.test(restStr) ? 60 : 1);
  },
  // Work duration from reps like "30s each side" or "5 min"; null if not timed
  parseWorkSeconds(reps) {
    const m = String(reps || '').match(/(\d+)\s*(s|sec|min)\b/);
    return m ? parseInt(m[1]) * (m[2] === 'min' ? 60 : 1) : null;
  },
};
