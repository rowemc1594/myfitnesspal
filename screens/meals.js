'use strict';
// Macros for one day: eaten = ticked meal items + extras; goal = every non-optional item in that day's plan.
// Returns { eaten: [cal, protein, fat], goal: [cal, protein, fat] }. Used by Today/Meals and History.
App.dayMacros = function(ds) {
  const meals = isTrainingDay(ds) ? PLAN.meals.training : PLAN.meals.nonTraining;
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
  const baseMeals = training ? PLAN.meals.training : PLAN.meals.nonTraining;
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
          ${(PLAN.mealTimes || [])[pos] ? `<div class="meal-time">${PLAN.mealTimes[pos]}</div>` : ''}
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
      <div class="preset-list mt8">${PLAN.snackPresets.map((s, i) => `<button class="preset" data-preset="${i}">${s.name}</button>`).join('')}</div>
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
      base = PLAN.snackPresets[parseInt(b.dataset.preset)];
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

App.screens.meals = function(container) {
  const list = document.createElement('div');
  container.appendChild(list);
  App.renderMealChecklist(list, todayStr(), { allowReorder: true });

  const notes = document.createElement('div');
  notes.className = 'card';
  notes.innerHTML = `<div class="card-title">Diet Notes</div>
    ${PLAN.dietNotes.map(n => `<div class="text-sm mt8">• ${n}</div>`).join('')}`;
  container.appendChild(notes);
};
