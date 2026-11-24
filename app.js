'use strict';
// Build number shown in the header. Bump together with CACHE_NAME in sw.js (tracker-v<BUILD>).
const BUILD = 72;
/* ── Storage ────────────────────────────────────────────────── */
const STORAGE_KEY = 'trackerData_v1';
const BACKUP_KEY  = 'trackerData_backup';
const SCHEMA_VERSION = 11;

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
    skippedDays: {},      // past days marked "skipped, no workout": { 'YYYY-MM-DD': true }
    mealPlans: [],        // your edited meal plans, dated: [{ from: 'YYYY-MM-DD', training, nonTraining, mealTimes }]
                          // each day uses the newest version on or before it; none = the coach's plan in plan.js
    snackPresets: null,   // your quick picks for "+ Add food" (null = plan.js list)
    dietNotes: null,      // your coach's notes (null = plan.js list)
    settings: { waterUnit: 'oz', waterGoalCups: 17 }, // unit is display only; goal stored in cups
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
  d => { d.extraFoods = d.extraFoods || {}; return d; },
  // Past days you mark as skipped (dropped from catch-ups, not shown as missed)
  d => { d.skippedDays = d.skippedDays || {}; return d; },
  // Water shown in ounces by default (goal unchanged: 16 cups = 128 oz, from the coach's plan)
  d => { d.settings.waterUnit = 'oz'; return d; },
  // Editable meal plan (dated versions so past days keep their menu), snack picks and notes
  d => { d.mealPlans = d.mealPlans || []; if (d.snackPresets === undefined) d.snackPresets = null; if (d.dietNotes === undefined) d.dietNotes = null; return d; },
  // Coach's PDF says ~4 liters: the old 16-cup default becomes 17 cups (136 oz). A goal you set yourself is kept.
  d => { if (d.settings.waterGoalCups === 16) d.settings.waterGoalCups = 17; return d; }
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
    if (w !== 'Rest' && !doneSet.has(w)) {
      taken.add(w);
      if (!(Store.get().skippedDays || {})[ds]) skipped.push(w); // marked skipped: no catch-up offered
    }
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
  Store.set(d => {
    if (w) { d.workoutLogs[ds] = w; d.workoutPlan[ds] = w; if (d.skippedDays) delete d.skippedDays[ds]; }
    else delete d.workoutLogs[ds];
  });
}
function setSkipped(ds, on) {
  Store.set(d => { d.skippedDays = d.skippedDays || {}; if (on) d.skippedDays[ds] = true; else delete d.skippedDays[ds]; });
}
// How much of a workout was done that day: an exercise counts once all its sets are ticked.
// Returns { done, total }; DB Complex (round-based, no sets) counts as fully done when completed.
function workoutExerciseStats(ds, w) {
  const plan = PLAN.workouts[w];
  if (!plan || !plan.exercises || plan.dbComplex) return { done: 1, total: 1 };
  const logs = Store.get().setLogs;
  const done = plan.exercises.filter(ex => {
    for (let s = 0; s < (ex.sets || 1); s++) if (!(logs[`${ds}_${ex.id}_${s}`] || {}).done) return false;
    return true;
  }).length;
  return { done, total: plan.exercises.length };
}
/* ── Meal plan (dated versions) ──────────────────────────────── */
const clone = o => JSON.parse(JSON.stringify(o));
function coachPlan() { return { training: clone(PLAN.meals.training), nonTraining: clone(PLAN.meals.nonTraining), mealTimes: clone(PLAN.mealTimes) }; }
// The plan in effect on a date: newest saved version on or before it, else the coach's plan
function mealPlanFor(ds) {
  const v = (Store.get().mealPlans || []).filter(p => p.from <= ds).sort((a, b) => b.from.localeCompare(a.from))[0];
  return v || coachPlan();
}
function mealsFor(ds) { const p = mealPlanFor(ds); return isTrainingDay(ds) ? p.training : p.nonTraining; }
// Save a plan from today on. Today's ticks follow their items by text so edits don't shift them.
function saveMealPlan(plan) {
  const ds = todayStr();
  const before = mealPlanFor(ds);
  Store.set(d => {
    d.mealPlans = (d.mealPlans || []).filter(p => p.from !== ds);
    d.mealPlans.push({ from: ds, training: plan.training, nonTraining: plan.nonTraining, mealTimes: plan.mealTimes });
    const logs = d.mealLogs[ds];
    if (logs) ['training', 'nonTraining'].forEach(kind => before[kind].forEach(oldMeal => {
      const t = logs[oldMeal.id];
      const newMeal = plan[kind].find(m => m.id === oldMeal.id);
      if (!t || !newMeal) return;
      const moved = {};
      oldMeal.items.forEach((txt, i) => { const j = newMeal.items.indexOf(txt); if (t[i] && j >= 0) moved[j] = true; });
      if (t.closed) moved.closed = true;
      logs[oldMeal.id] = moved;
    }));
  });
}
function snackPresets() { return Store.get().snackPresets || PLAN.snackPresets; }
function dietNotes() { return Store.get().dietNotes || PLAN.dietNotes; }

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
      navigator.serviceWorker.register('./sw.js').then(reg => {
        // Check for a new version on every open / return to the app
        reg.update().catch(() => {});
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {});
        });
      }).catch(() => {});
      // When a new version takes over, reload once so it's what you see (not mid-timer)
      let reloaded = false;
      const hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloaded) return;
        const go = () => { if (!reloaded) { reloaded = true; location.reload(); } };
        if (this.timer.state) { const iv = setInterval(() => { if (!this.timer.state) { clearInterval(iv); go(); } }, 1000); }
        else go();
      });
    }

    // First run: ask for bodyweight
    const data = Store.get();
    if (data.firstRun) {
      Store.set(d => d.firstRun = false);
      if (!data.bodyweight.length) setTimeout(() => this.openWeightEntry(true), 0);
    }
    document.getElementById('weight-btn').addEventListener('click', () => this.openWeightEntry(false));
    // TEMPORARY (testing): wipe all data and start fresh. The wiped data is kept in the
    // restore slot (BACKUP_KEY) so a mis-tap can be recovered. Remove before real use.
    // TEMPORARY (testing): replace all data with a sample week. Current data goes to the restore slot.
    document.getElementById('demo-btn').addEventListener('click', () => this.loadDemo());
    document.getElementById('reset-btn').addEventListener('click', () => {
      const cur = localStorage.getItem(STORAGE_KEY);
      if (cur) localStorage.setItem(BACKUP_KEY, cur);
      localStorage.removeItem(STORAGE_KEY);
      Object.keys(localStorage).filter(k => k.startsWith('dbcomplex_rest_')).forEach(k => localStorage.removeItem(k));
      this.timer.stop();
      location.reload();
    });

    // Nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
      // Tapping a tab always goes to today (leaves any past day being caught up on)
      btn.addEventListener('click', () => { this.viewDate = null; this.navigate(btn.dataset.screen); });
    });

    const bt = document.createElement('span');
    bt.id = 'build-tag';
    bt.textContent = 'b' + BUILD;
    document.getElementById('screen-title').after(bt);
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

  // TEMPORARY (testing): 8 weeks of sample data ending today, with realistic gaps:
  // most workouts done (some partial, a few missed or skipped), weights going up over time,
  // most days' meals logged (a few days unlogged), snacks, water, daily weigh-ins.
  // Same result every time (seeded). Today: 3 meals, a snack, some water. Remove with the Demo button.
  loadDemo() {
    const cur = localStorage.getItem(STORAGE_KEY);
    if (cur) localStorage.setItem(BACKUP_KEY, cur);
    const d = defaultStore();
    d.firstRun = false;
    let seed = 13;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const today = todayStr();
    const start = new Date(mondayOfWeek(new Date()).getTime() - 7 * 7 * 86400000);
    const isTrain = w => ['Day 1', 'Day 2', 'Day 3', 'Day 4'].includes(w);
    const eat = (ds, w, mealsToEat, skipItems) => {
      const meals = isTrain(w) ? PLAN.meals.training : PLAN.meals.nonTraining;
      d.mealLogs[ds] = {};
      meals.slice(0, mealsToEat).forEach(m => {
        const t = {};
        m.items.forEach((it, i) => { if (!/^optional/i.test(it)) t[i] = true; });
        if (skipItems && rnd() < 0.25) { delete t[m.items.length - 1]; t.closed = true; }
        d.mealLogs[ds][m.id] = t;
      });
    };
    const SNACKS = PLAN.snackPresets;
    for (let day = 0; ; day++) {
      const dt = new Date(start.getTime() + day * 86400000);
      const ds = fmtDate(dt);
      if (ds > today) break;
      const week = Math.floor(day / 7), dow = day % 7;
      const w = PLAN.schedule[dow];
      const isToday = ds === today;
      // Workouts
      if (w !== 'Rest' && !isToday) {
        const r = rnd();
        if (r < 0.08) { /* missed */ }
        else if (r < 0.12) d.skippedDays[ds] = true;
        else {
          d.workoutLogs[ds] = w; d.workoutPlan[ds] = w;
          const exs = PLAN.workouts[w].exercises || [];
          const n = PLAN.workouts[w].dbComplex ? 0 : (rnd() < 0.2 ? exs.length - 1 - Math.floor(rnd() * 2) : exs.length);
          exs.slice(0, n).forEach((ex, ei) => {
            const reps = (String(ex.reps).match(/\d+/) || ['10'])[0];
            const wt = 40 + ei * 10 + 5 * Math.floor(week * 0.75);    // goes up most weeks
            for (let s = 0; s < (ex.sets || 1); s++) d.setLogs[`${ds}_${ex.id}_${s}`] = { weight: String(wt), reps, done: true };
          });
        }
      }
      // Meals, snacks, water, pickles, weight
      if (isToday) eat(ds, w, 3, false);
      else if (rnd() < 0.85) eat(ds, w, rnd() < 0.8 ? 5 : 4, true);   // ~15% of days not logged
      if (isToday || rnd() < 0.15) { const sn = SNACKS[Math.floor(rnd() * SNACKS.length)]; d.extraFoods[ds] = [{ name: sn.name, amount: sn.amount, cal: sn.cal, p: sn.p, f: sn.f }]; }
      d.waterLogs[ds] = isToday ? 6 : 9 + Math.floor(rnd() * 8);
      if (!isToday && rnd() < 0.9) d.supplementLogs[ds] = { pickles: true };
      if (rnd() < 0.85 || isToday) d.bodyweight.push({ date: ds, kg: +(192 - day * 0.12 + (rnd() - 0.5) * 1.2).toFixed(1) });
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    this.timer.stop();
    location.reload();
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
      this._iv = setInterval(() => this._tick(), 100);
      App.keepAwake(true);
      this._tick();
    },
    add(sec) {
      if (!this.state || this.state.doneAt) return;
      if (this.state.paused) { this.state.pausedLeft += sec * 1000; this.state.total = Math.max(this.state.total, this.remaining()); this._emit(); return; }
      this.state.endAt += sec * 1000;
      this.state.lastCount = null;
      if (this.state.countStarted) { App.stopCountdownSound(); this.state.countStarted = false; }
      this.state.total = Math.max(this.state.total, this.remaining());
      this._tick();
    },
    stop() {
      clearInterval(this._iv); this._iv = null;
      if (this.state && !this.state.doneAt) App.stopCountdownSound();
      this.state = null;
      this._emit();
      App.keepAwake(App.currentScreen === 'workouts');
    },
    // Time left in ms (frozen while paused)
    msLeft() { const st = this.state; return !st ? 0 : st.paused ? st.pausedLeft : Math.max(0, st.endAt - Date.now()); },
    remaining() { return Math.ceil(this.msLeft() / 1000); },
    pause() {
      const st = this.state;
      if (!st || st.doneAt || st.paused) return;
      st.pausedLeft = Math.max(0, st.endAt - Date.now());
      st.paused = true;
      if (st.countStarted) { App.stopCountdownSound(); st.countStarted = false; st.lastCount = null; }
      this._emit();
    },
    resume() {
      const st = this.state;
      if (!st || !st.paused) return;
      App.unlockAudio();
      st.endAt = Date.now() + st.pausedLeft;
      st.paused = false;
      this._tick();
    },
    _tick() {
      const st = this.state;
      if (!st) return;
      if (st.paused) { this._emit(); return; }
      // Last 5 s: one continuous clip (silence, then beeps at 5,4,3,2,1 and Go at 0), started
      // at 0:06. Once it's actually playing, the clock follows the clip so numbers match beeps.
      const LEAD = 6;
      const msLeft = st.endAt - Date.now();
      if (!st.doneAt && !st.countStarted && msLeft <= LEAD * 1000 && msLeft > 4500) {
        st.countStarted = true;
        App.playCountdownSound(Math.max(0, LEAD - msLeft / 1000));
      }
      const clip = App._clips && App._clips.count;
      if (!st.doneAt && st.countStarted && clip && !clip.paused && clip.currentTime > 0.05) {
        st.endAt = Date.now() + (LEAD - clip.currentTime) * 1000;
      }
      const rem = this.remaining();
      if (!st.doneAt && rem >= 1 && rem <= 5 && st.lastCount !== rem) {
        st.lastCount = rem;
        if (navigator.vibrate) navigator.vibrate(60);
      }
      if (!st.doneAt && Date.now() >= st.endAt) {
        st.doneAt = Date.now();
        if (navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 300]);
        if (!st.countStarted) App.beep('go'); // countdown clip already includes Go
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
    pill.classList.toggle('soon', !st.doneAt && !st.paused && rem <= 5);
    pill.classList.toggle('paused', !!st.paused);
    pill.innerHTML = `<button class="tp-main">${st.doneAt ? (st.kind === 'work' ? 'Time!' : 'Go!') : `${st.kind === 'work' ? 'Work' : 'Rest'} ${this.fmtClock(rem)}`}
        <span class="tp-label">${st.label || ''}</span></button>
      ${st.doneAt ? '' : `<button class="tp-btn" data-t="add">+15</button>
        <button class="tp-btn" data-t="pause">${st.paused ? 'Resume' : 'Pause'}</button>`}
      <button class="tp-btn tp-x" data-t="stop" aria-label="${st.doneAt ? 'Dismiss' : 'Skip rest'}">✕</button>`;
    pill.querySelector('.tp-main').onclick = () => {
      const el = st.anchor && document.querySelector(`[data-timer-anchor="${st.anchor}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      else if (st.anchor && this.currentScreen !== 'workouts') { this.navigate('workouts'); setTimeout(() => this._renderTimerPill(), 50); }
    };
    const add = pill.querySelector('[data-t="add"]');
    if (add) add.onclick = () => this.timer.add(15);
    const pz = pill.querySelector('[data-t="pause"]');
    if (pz) pz.onclick = () => st.paused ? this.timer.resume() : this.timer.pause();
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

  // ── Sound ──
  // Beeps are real audio clips (generated WAVs) played through <audio> elements.
  // iPhones mute Web Audio when the silent switch is on but still play media audio,
  // and only allow sound after a tap: unlockAudio() runs on the ✓ tap and primes the clips.
  _clips: null,
  _makeWav(tones) {
    // tones: [{freq, len, gap}] -> data: URL of a 16-bit mono WAV
    const rate = 22050, parts = [];
    tones.forEach(t => {
      const n = Math.round(rate * t.len);
      for (let i = 0; i < n; i++) {
        const env = Math.min(1, i / 200) * Math.min(1, (n - i) / 400); // soft edges, no clicks
        parts.push(Math.sin(2 * Math.PI * t.freq * i / rate) * 0.6 * env);
      }
      for (let i = 0; i < Math.round(rate * (t.gap || 0)); i++) parts.push(0);
    });
    const buf = new ArrayBuffer(44 + parts.length * 2), v = new DataView(buf);
    const str = (o, x) => [...x].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF'); v.setUint32(4, 36 + parts.length * 2, true); str(8, 'WAVEfmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, parts.length * 2, true);
    parts.forEach((x, i) => v.setInt16(44 + i * 2, x * 32767, true));
    let bin = ''; new Uint8Array(buf).forEach(b => bin += String.fromCharCode(b));
    return 'data:audio/wav;base64,' + btoa(bin);
  },
  unlockAudio() {
    try {
      // Safari 17+: treat our sound as media playback so the silent switch doesn't mute it
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
      if (!this._clips) {
        this._clips = {
          tick: new Audio(this._makeWav([{ freq: 660, len: 0.12 }])),
          go: new Audio(this._makeWav([{ freq: 880, len: 0.25, gap: 0.1 }, { freq: 880, len: 0.25, gap: 0.1 }, { freq: 1100, len: 0.45 }])),
          // 1 s of silence (absorbs the phone's start-up delay), then 5 ticks exactly
          // 1 s apart, then Go at 6.0 s. Started at 0:06 left.
          count: new Audio(this._makeWav([
            { freq: 0, len: 0, gap: 1 },
            ...[0, 1, 2, 3, 4].map(() => ({ freq: 660, len: 0.12, gap: 0.88 })),
            { freq: 880, len: 0.25, gap: 0.1 }, { freq: 880, len: 0.25, gap: 0.1 }, { freq: 1100, len: 0.45 }
          ]))
        };
      }
      // Prime each clip inside the tap (muted play + pause) so later plays are allowed
      if (!this._primed) {
        Object.values(this._clips).forEach(a => {
          a.muted = true;
          const p = a.play();
          // Only undo the priming if a real beep hasn't taken over this clip meanwhile
          const done = () => { if (a.muted) { a.pause(); a.currentTime = 0; a.muted = false; } };
          if (p && p.then) p.then(done, () => { a.muted = false; }); else done();
        });
        this._primed = true;
      }
    } catch (e) {}
  },
  // kind: 'tick' (countdown) or 'go' (timer done)
  beep(kind = 'tick') {
    try {
      this.unlockAudio();
      const a = this._clips[kind];
      a.muted = false; a.currentTime = 0;
      const p = a.play();
      if (p && p.catch) p.catch(() => this._webBeep(kind));
    } catch (e) { this._webBeep(kind); }
  },
  playCountdownSound(offset) {
    try {
      this.unlockAudio();
      const a = this._clips.count;
      a.muted = false; a.currentTime = Math.max(0, offset);
      const p = a.play();
      if (p && p.catch) p.catch(() => this._webBeep('tick'));
    } catch (e) {}
  },
  stopCountdownSound() {
    try { const a = this._clips && this._clips.count; if (a) { a.pause(); a.currentTime = 0; } } catch (e) {}
  },
  // Fallback if media playback is refused
  _webBeep(kind) {
    try {
      this._ctx = this._ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (this._ctx.state !== 'running') this._ctx.resume();
      const ctx = this._ctx, t0 = ctx.currentTime, n = kind === 'go' ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const o = ctx.createOscillator(), g = ctx.createGain(), len = kind === 'go' ? 0.25 : 0.12;
        o.frequency.value = kind === 'go' ? 880 : 660; o.connect(g); g.connect(ctx.destination);
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
