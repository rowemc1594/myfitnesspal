'use strict';
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
  const isDone = meal => meal.items.every((item, i) => isOptional(item) || ticks(meal.id)[i]);
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
    if (!open) return;

    meals.forEach((meal, pos) => {
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
            ${pos === nextIdx && !reordering ? '<div class="text-sm text-accent">Up next</div>' : ''}
          </div>
        </div>
        ${reordering ? '' : `<div class="meal-items">
          ${meal.items.map((item, i) => `
            <button class="meal-item ${t[i] ? 'checked' : ''} ${isOptional(item) ? 'optional' : ''}" data-idx="${i}">
              <span class="mini-check">${CHECK}</span><span>${item}</span>
            </button>`).join('')}
        </div>`}`;
      el.appendChild(card);

      card.querySelectorAll('[data-move]').forEach(b => b.onclick = () => move(pos, parseInt(b.dataset.move)));
      const big = card.querySelector('.meal-check');
      if (big) big.onclick = () => setTicks(meal.id, m => {
        // Whole-meal tick: required items on, or everything off if already done
        meal.items.forEach((item, i) => { m[i] = done ? false : (isOptional(item) ? !!m[i] : true); });
      });
      card.querySelectorAll('.meal-item').forEach(b => b.onclick = () => {
        const i = parseInt(b.dataset.idx);
        setTicks(meal.id, m => { m[i] = !m[i]; });
      });
    });
  }

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
