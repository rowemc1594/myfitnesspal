'use strict';
// Macros for one day: eaten = ticked meal items + extras; goal = every non-optional item in that day's plan.
// Returns { eaten: [cal, protein, fat], goal: [cal, protein, fat] }. Used by Today/Meals and History.
App.dayMacros = function(ds) {
  const meals = mealsFor(ds);
  const logs = Store.get().mealLogs[ds] || {};
  const eaten = [0, 0, 0], goal = [0, 0, 0];
  meals.forEach(meal => (meal.macros || []).forEach((m, i) => {
    const t = logs[meal.id] || {};
    for (let k = 0; k < 3; k++) {
      if (!/^optional/i.test(meal.items[i])) goal[k] += m[k];
      if (t[i]) eaten[k] += m[k];
    }
  }));
  ((Store.get().extraFoods || {})[ds] || []).forEach(x => { eaten[0] += x.cal || 0; eaten[1] += x.p || 0; eaten[2] += x.f || 0; });
  return { eaten, goal };
};

// Meal checklist for one day; used by both Today and Meals screens
App.renderMealChecklist = function(el, ds, { allowReorder = false, collapsible = false } = {}) {
  const training = isTrainingDay(ds);
  const baseMeals = mealsFor(ds);
  const mealTimes = mealPlanFor(ds).mealTimes || [];
  const savedOrder = (Store.get().mealOrder || {})[ds] || [];
  const meals = baseMeals.slice().sort((a, b) => {
    const ia = savedOrder.indexOf(a.id), ib = savedOrder.indexOf(b.id);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || baseMeals.indexOf(a) - baseMeals.indexOf(b);
  });
  const isOptional = item => /^optional/i.test(item);
  const ticks = id => (Store.get().mealLogs[ds] || {})[id] || {};
  const allTicked = meal => meal.items.every((item, i) => isOptional(item) || ticks(meal.id)[i]);
  // A meal is done when every required item is ticked, or you closed it with some left out
  const isDone = meal => !!ticks(meal.id).closed || allTicked(meal);
  let reordering = false;

  function setTicks(mealId, fn) {
    Store.set(d => {
      d.mealLogs[ds] = d.mealLogs[ds] || {};
      d.mealLogs[ds][mealId] = d.mealLogs[ds][mealId] || {};
      fn(d.mealLogs[ds][mealId]);
    });
    render();
  }

  function move(idx, dir) {
    const j = idx + dir;
    if (j < 0 || j >= meals.length) return;
    [meals[idx], meals[j]] = [meals[j], meals[idx]];
    Store.set(d => { d.mealOrder = d.mealOrder || {}; d.mealOrder[ds] = meals.map(m => m.id); });
    render();
  }

  const CHECK = '<svg class="icon" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  function render() {
    el.innerHTML = '';
    const doneCount = meals.filter(isDone).length;
    const nextIdx = meals.findIndex(m => !isDone(m));

    const { eaten, goal } = App.dayMacros(ds);
    const extras = (Store.get().extraFoods || {})[ds] || [];
    const mac = document.createElement('div');
    mac.className = 'card macro-card';
    mac.innerHTML = `<div class="card-title">${ds === todayStr() ? "Today's macros" : 'Macros'} <span class="text-sm text-muted" style="text-transform:none;letter-spacing:0">· estimated</span></div>
      <div class="macro-grid">${[['Calories', ''], ['Protein', 'g'], ['Fat', 'g']].map(([name, u], k) => `
        <div class="macro">
          <div class="macro-name">${name}</div>
          <div class="macro-val"><strong>${eaten[k]}</strong><span class="text-muted"> / ${goal[k]}${u}</span></div>
          <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(100, goal[k] ? eaten[k] / goal[k] * 100 : 0)}%"></div></div>
        </div>`).join('')}</div>`;
    el.appendChild(mac);

    const open = !collapsible || !!App._mealsOpen;
    const hdr = document.createElement(collapsible ? 'button' : 'div');
    hdr.className = 'card' + (collapsible ? ' meal-summary' : '');
    if (collapsible) hdr.setAttribute('aria-expanded', open);
    hdr.innerHTML = `<div class="row-between">
        <div>
          <div class="card-title" style="margin-bottom:4px">${training ? 'Training day' : 'Non-training day'} meals</div>
          <div><strong>${doneCount}</strong> of ${meals.length} eaten${!open && nextIdx >= 0 ? ` <span class="text-sm text-muted">· Up next: ${meals[nextIdx].label.replace(/ \(Post-Workout\)/, '')}</span>` : ''}</div>
        </div>
        ${allowReorder ? `<button class="btn btn-secondary btn-sm" data-reorder>${reordering ? 'Done' : 'Reorder'}</button>` : ''}
        ${collapsible ? `<svg class="icon chevron" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>` : ''}
      </div>
      <div class="progress-bar mt8"><div class="progress-fill" style="width:${doneCount / meals.length * 100}%"></div></div>`;
    const rb = hdr.querySelector('[data-reorder]');
    if (rb) rb.onclick = () => { reordering = !reordering; render(); };
    if (collapsible) hdr.onclick = () => { App._mealsOpen = !open; render(); };
    el.appendChild(hdr);


    (open ? meals : []).forEach((meal, pos) => {
      const done = isDone(meal);
      const t = ticks(meal.id);
      const card = document.createElement('div');
      card.className = 'card meal-card' + (done ? ' done' : '') + (pos === nextIdx && !reordering ? ' next' : '');
      card.innerHTML = `
        <div class="meal-head">
          ${reordering
            ? `<div class="row" style="gap:6px">
                 <button class="btn-icon" data-move="-1" aria-label="Move up" ${pos === 0 ? 'disabled' : ''}>↑</button>
                 <button class="btn-icon" data-move="1" aria-label="Move down" ${pos === meals.length - 1 ? 'disabled' : ''}>↓</button>
               </div>`
            : `<button class="meal-check" aria-pressed="${done}" aria-label="${done ? 'Unmark' : 'Mark'} ${meal.label} eaten">${CHECK}</button>`}
          <div class="meal-title">
            <div>${meal.label.replace(/ \(Post-Workout\)/, '')}${meal.postWorkout ? ' <span class="badge badge-red">Post-workout</span>' : ''}</div>
            ${meal.macros ? (() => { const g = [0, 0, 0]; meal.macros.forEach((m, i) => { if (!isOptional(meal.items[i])) for (let k = 0; k < 3; k++) g[k] += m[k]; });
              return `<div class="meal-macros">${g[0]} cal · ${g[1]}g P · ${g[2]}g F</div>`; })() : ''}
            ${pos === nextIdx && !reordering ? '<div class="text-sm text-accent">Up next</div>' : ''}
          </div>
          ${meal.postWorkout ? '<div class="meal-time">After workout</div>' : mealTimes[pos] ? `<div class="meal-time">${mealTimes[pos]}</div>` : ''}
        </div>
        ${reordering ? '' : `<div class="meal-items">
          ${meal.items.map((item, i) => `
            <button class="meal-item ${t[i] ? 'checked' : ''} ${isOptional(item) ? 'optional' : ''} ${done && !t[i] && !isOptional(item) ? 'skipped' : ''}" data-idx="${i}">
              <span class="mini-check">${CHECK}</span><span>${item}</span>
            </button>`).join('')}
        </div>`}`;
      el.appendChild(card);

      card.querySelectorAll('[data-move]').forEach(b => b.onclick = () => move(pos, parseInt(b.dataset.move)));
      const big = card.querySelector('.meal-check');
      if (big) big.onclick = () => setTicks(meal.id, m => {
        if (done) {
          // Undo: clear the whole meal
          meal.items.forEach((item, i) => { m[i] = false; });
          delete m.closed;
        } else if (meal.items.some((item, i) => m[i])) {
          // Some items ticked: close the meal as eaten, leaving the rest marked skipped
          m.closed = true;
        } else {
          // Nothing ticked yet: you ate it all
          meal.items.forEach((item, i) => { m[i] = isOptional(item) ? !!m[i] : true; });
        }
      });
      card.querySelectorAll('.meal-item').forEach(b => b.onclick = () => {
        const i = parseInt(b.dataset.idx);
        setTicks(meal.id, m => { m[i] = !m[i]; });
      });
    });

    // Off-plan food
    const ex = document.createElement('div');
    ex.className = 'card';
    ex.innerHTML = `<div class="row-between">
        <div class="card-title" style="margin:0">Extras · off-plan</div>
        <button class="btn btn-secondary btn-sm" data-add-extra>+ Add food</button>
      </div>
      ${extras.length ? extras.map((x, i) => `
        <div class="extra-row">
          <div style="flex:1"><div>${esc(x.name)}</div>
            <div class="text-sm text-muted">${x.amount ? esc(x.amount) + ' · ' : ''}${x.cal} cal · ${x.p}g P · ${x.f}g F</div></div>
          <button class="btn-icon" data-del-extra="${i}" aria-label="Remove ${esc(x.name)}">✕</button>
        </div>`).join('')
      : '<div class="text-sm text-muted mt8">Ate something not on the plan? Add it here and it counts toward today\'s macros.</div>'}`;
    ex.querySelector('[data-add-extra]').onclick = openAddExtra;
    ex.querySelectorAll('[data-del-extra]').forEach(b => b.onclick = () => {
      Store.set(d => { d.extraFoods[ds].splice(parseInt(b.dataset.delExtra), 1); });
      render();
    });
    el.appendChild(ex);
  }

  function openAddExtra() {
    App.showModal(`<h2>Add food</h2>
      <p class="text-sm text-muted mt8">Pick a quick estimate or type your own.</p>
      <div class="preset-list mt8">${snackPresets().map((s, i) => `<button class="preset" data-preset="${i}">${s.name}</button>`).join('')}</div>
      <label class="field mt12">What<input id="xf-name" placeholder="e.g. Popcorn"></label>
      <label class="field">How much<input id="xf-amount" placeholder="e.g. 3 cups"></label>
      <div class="xf-grid">
        <label class="field">Calories<input id="xf-cal" type="number" inputmode="numeric"></label>
        <label class="field">Protein g<input id="xf-p" type="number" inputmode="numeric"></label>
        <label class="field">Fat g<input id="xf-f" type="number" inputmode="numeric"></label>
      </div>
      <p class="text-sm text-muted" id="xf-hint"></p>
      <button class="btn btn-primary mt12" id="xf-save" style="width:100%">Add</button>`);
    const $ = id => document.getElementById(id);
    let base = null; // preset picked, for scaling by servings
    document.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => {
      base = snackPresets()[parseInt(b.dataset.preset)];
      $('xf-name').value = base.name; $('xf-amount').value = base.amount;
      $('xf-cal').value = base.cal; $('xf-p').value = base.p; $('xf-f').value = base.f;
      $('xf-hint').textContent = `Numbers are for ${base.amount}. Ate more or less? Adjust them.`;
    });
    $('xf-save').onclick = () => {
      const name = $('xf-name').value.trim();
      const cal = Math.round(parseFloat($('xf-cal').value) || 0);
      if (!name || !cal) { App.toast('Add a name and calories'); return; }
      Store.set(d => {
        d.extraFoods = d.extraFoods || {};
        (d.extraFoods[ds] = d.extraFoods[ds] || []).push({
          name, amount: $('xf-amount').value.trim(), cal,
          p: Math.round(parseFloat($('xf-p').value) || 0), f: Math.round(parseFloat($('xf-f').value) || 0)
        });
      });
      App.closeModal();
      App.toast(`${name} added`);
      render();
    };
  }

  function esc(t) { return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

  render();
};

// ── Meals page: how you're doing on the plan, and the place to change it ──
App.screens.meals = function(container) {
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const isOpt = t => /^optional/i.test(t);
  const todayS = todayStr();
  const mealDone = (ds, meal) => {
    const t = (Store.get().mealLogs[ds] || {})[meal.id] || {};
    return !!t.closed || meal.items.every((it, i) => isOpt(it) || t[i]);
  };

  renderSummary();
  renderPlan();
  renderSnacks();
  renderNotes();

  // ── 1. This week on the plan ──
  function renderSummary() {
    const card = document.createElement('div');
    card.className = 'card';
    const days = weekDays(mondayOfWeek(new Date())).map(fmtDate);
    let eaten = 0, planned = 0, xN = 0, xCal = 0;
    const perDay = days.map(ds => {
      if (ds > todayS) return null;
      const meals = mealsFor(ds);
      const n = meals.filter(m => mealDone(ds, m)).length;
      eaten += n; planned += meals.length;
      const ex = (Store.get().extraFoods || {})[ds] || [];
      xN += ex.length; ex.forEach(x => xCal += x.cal || 0);
      return { ds, n, of: meals.length };
    });
    // Items left out of meals you closed, over the last 4 weeks
    const skipped = {};
    for (let i = 0; i < 28; i++) {
      const ds = fmtDate(new Date(Date.now() - i * 86400000));
      const logs = Store.get().mealLogs[ds] || {};
      mealsFor(ds).forEach(m => {
        const t = logs[m.id];
        if (!t || !t.closed) return;
        m.items.forEach((it, j) => { if (!isOpt(it) && !t[j]) { const k = it.replace(/\s*\(.*?\)\s*/g, ' ').trim(); skipped[k] = (skipped[k] || 0) + 1; } });
      });
    }
    const top = Object.entries(skipped).sort((a, b) => b[1] - a[1]).slice(0, 3);
    // Squares first (same pattern as Today and Workouts), numbers below
    const strip = document.createElement('div');
    strip.className = 'card';
    strip.innerHTML = `<div class="row-between" style="margin-bottom:8px">
        <span class="card-title" style="margin:0">This week</span>
        <span class="text-sm"><strong>${eaten}</strong> of ${planned} meals</span>
      </div>
      <div class="md-strip">${perDay.map((p, i) => {
        const dt = parseDate(days[i]);
        const st = p ? (p.n >= p.of ? 'done' : p.n ? 'some' : '') : 'future';
        return `<button class="xs-tile md-tile ${st}${days[i] === todayS ? ' cur' : ''}" ${p ? `data-day="${p.ds}"` : 'disabled'}>
          <span>${DOW[i]}</span><b>${dt.getDate()}${p && p.n >= p.of ? ' ✓' : ''}</b><em>${p ? `${p.n}/${p.of}` : '–'}</em></button>`;
      }).join('')}</div>
      <div class="text-sm text-muted mt8">Tap a day to open it on Today.</div>`;
    strip.querySelectorAll('[data-day]').forEach(b => b.onclick = () => {
      App.viewDate = b.dataset.day < todayS ? b.dataset.day : null;
      App.navigate('today');
    });
    container.appendChild(strip);

    card.innerHTML = `<div class="card-title">On the plan</div>
      <div class="stat-row">
        <div><strong>${eaten}<span>/${planned}</span></strong><em>meals eaten</em></div>
        <div><strong>${xN}</strong><em>off-plan extras</em></div>
        <div><strong>${xCal.toLocaleString()}</strong><em>extra calories</em></div>
      </div>
      ${top.length ? `<div class="text-sm"><span class="text-muted">Most skipped (4 weeks):</span> ${top.map(([k, n]) => `<strong>${esc(k)}</strong> ${n}×`).join(' · ')}</div>` : ''}`;
    container.appendChild(card);
  }

  // ── 2. Meal plan: view and edit (changes apply from today; past days keep their menu) ──
  function renderPlan() {
    const card = document.createElement('div');
    card.className = 'card';
    container.appendChild(card);
    let kind = isTrainingDay(todayS) ? 'training' : 'nonTraining';
    const edited = (Store.get().mealPlans || []).length > 0;

    const totals = meals => meals.reduce((t, m) => { (m.macros || []).forEach((x, i) => { if (!isOpt(m.items[i])) for (let k = 0; k < 3; k++) t[k] += x[k] || 0; }); return t; }, [0, 0, 0]);
    const tabs = () => `<span class="seg">${[['training', 'Training day'], ['nonTraining', 'Rest day']].map(([k, l]) => `<button data-kind="${k}" class="${k === kind ? 'on' : ''}">${l}</button>`).join('')}</span>`;

    function view() {
      const plan = mealPlanFor(todayS);
      const meals = plan[kind];
      const tot = totals(meals);
      card.innerHTML = `<div class="row-between"><span class="card-title" style="margin:0">Meal plan</span>${tabs()}</div>
        <div class="text-sm text-muted mt8">${edited ? 'Edited plan (from testing).' : "Your coach's plan."} ${tot[0].toLocaleString()} cal · ${tot[1]}g protein · ${tot[2]}g fat per day</div>
        ${meals.map((m, mi) => `<div class="mp-meal">
            <div class="row-between"><strong>${esc(m.label)}</strong><span class="text-sm text-muted">${m.postWorkout ? 'After workout' : esc((plan.mealTimes || [])[mi] || '')}</span></div>
            ${m.items.map((it, i) => `<div class="mp-item ${isOpt(it) ? 'optional' : ''}"><span>${esc(it)}</span>
              <span class="text-muted">${m.macros && m.macros[i] ? `${m.macros[i][0]} cal · ${m.macros[i][1]}P` : ''}</span></div>`).join('')}
          </div>`).join('')}
        <div class="text-sm text-muted mt12">Your coach sets this plan.</div>
        ${edited ? '<button class="link-btn mt8" id="mp-reset">Reset to coach\'s plan</button>' : ''}`;
      card.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { kind = b.dataset.kind; view(); });
      const rs = card.querySelector('#mp-reset');
      if (rs) rs.onclick = () => { saveMealPlan(coachPlan()); App.toast("Back to the coach's plan from today"); App.navigate('meals'); };
    }

    view();
  }

  // ── 3a. Snack quick picks (used by "+ Add food") ──
  function renderSnacks() {
    const card = document.createElement('div');
    card.className = 'card';
    container.appendChild(card);
    const draw = () => {
      const list = snackPresets();
      card.innerHTML = `<div class="card-title">Snack quick picks</div>
        <div class="text-sm text-muted">Shown when you tap "+ Add food". Values are for the amount listed.</div>
        ${list.map((x, i) => `<div class="extra-row"><div style="flex:1"><div>${esc(x.name)}</div>
            <div class="text-sm text-muted">${esc(x.amount || '')} · ${x.cal} cal · ${x.p}g P · ${x.f}g F</div></div>
            <button class="btn-icon" data-del="${i}" aria-label="Remove ${esc(x.name)}">✕</button></div>`).join('')}
        <div class="sn-add mt12">
          <input class="mp-in" id="sn-name" placeholder="Name (e.g. Greek yogurt)">
          <div class="row mt8" style="gap:4px">
            <input class="mp-in" id="sn-amt" placeholder="Amount" style="flex:1.4">
            <input class="mp-in mp-num" id="sn-cal" inputmode="numeric" placeholder="cal">
            <input class="mp-in mp-num" id="sn-p" inputmode="numeric" placeholder="P g">
            <input class="mp-in mp-num" id="sn-f" inputmode="numeric" placeholder="F g">
          </div>
          <button class="btn btn-secondary btn-full mt8" id="sn-add">+ Add quick pick</button>
        </div>
        ${Store.get().snackPresets ? '<button class="link-btn mt8" id="sn-reset">Reset to the default list</button>' : ''}`;
      const save = l => { Store.set(d => d.snackPresets = l); draw(); };
      card.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const l = clone(snackPresets()); l.splice(+b.dataset.del, 1); save(l); });
      card.querySelector('#sn-add').onclick = () => {
        const v = id => card.querySelector(id).value.trim();
        const n = id => Math.round(parseFloat(v(id)) || 0);
        if (!v('#sn-name') || !n('#sn-cal')) { App.toast('Add a name and calories'); return; }
        save([...clone(snackPresets()), { name: v('#sn-name'), amount: v('#sn-amt'), cal: n('#sn-cal'), p: n('#sn-p'), f: n('#sn-f') }]);
      };
      const rs = card.querySelector('#sn-reset');
      if (rs) rs.onclick = () => { Store.set(d => d.snackPresets = null); draw(); };
    };
    draw();
  }

  // ── 3b. Coach's notes (read-only: the coach writes these) ──
  function renderNotes() {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div class="card-title">Coach's notes</div>
      ${dietNotes().map(n => `<div class="text-sm mt8">• ${esc(n)}</div>`).join('')}`;
    container.appendChild(card);
  }
};
