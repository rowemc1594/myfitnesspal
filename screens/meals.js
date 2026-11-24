'use strict';
App.screens.meals = function(container) {
  const todayS = todayStr();
  const training = isTrainingDay(todayS);
  const baseMeals = training ? PLAN.meals.training : PLAN.meals.nonTraining;
  const savedOrder = (Store.get().mealOrder || {})[todayS] || [];
  const meals = baseMeals.slice().sort((a, b) => {
    const ia = savedOrder.indexOf(a.id), ib = savedOrder.indexOf(b.id);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || baseMeals.indexOf(a) - baseMeals.indexOf(b);
  });
  const isOptional = item => /^optional/i.test(item);
  const ticks = id => (Store.get().mealLogs[todayS] || {})[id] || {};
  const isDone = meal => meal.items.every((item, i) => isOptional(item) || ticks(meal.id)[i]);
  let reordering = false;

  function setTicks(mealId, fn) {
    Store.set(d => {
      d.mealLogs[todayS] = d.mealLogs[todayS] || {};
      d.mealLogs[todayS][mealId] = d.mealLogs[todayS][mealId] || {};
      fn(d.mealLogs[todayS][mealId]);
    });
    render();
  }

  function move(idx, dir) {
    const ids = meals.map(m => m.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    [meals[idx], meals[j]] = [meals[j], meals[idx]];
    Store.set(d => { d.mealOrder = d.mealOrder || {}; d.mealOrder[todayS] = ids; });
    render();
  }

  const CHECK = '<svg class="icon" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  function render() {
    container.innerHTML = '';
    const doneCount = meals.filter(isDone).length;
    const nextIdx = meals.findIndex(m => !isDone(m));

    const hdr = document.createElement('div');
    hdr.className = 'card';
    hdr.innerHTML = `<div class="row-between">
        <div>
          <div class="card-title" style="margin-bottom:4px">${training ? 'Training day' : 'Non-training day'} meals</div>
          <div><strong>${doneCount}</strong> of ${meals.length} eaten</div>
        </div>
        <button class="btn btn-secondary btn-sm" id="reorder-btn">${reordering ? 'Done' : 'Reorder'}</button>
      </div>
      <div class="progress-bar mt8"><div class="progress-fill" style="width:${doneCount / meals.length * 100}%"></div></div>`;
    hdr.querySelector('#reorder-btn').onclick = () => { reordering = !reordering; render(); };
    container.appendChild(hdr);

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
      container.appendChild(card);

      card.querySelectorAll('[data-move]').forEach(b => b.onclick = () => move(pos, parseInt(b.dataset.move)));
      const big = card.querySelector('.meal-check');
      if (big) big.onclick = () => setTicks(meal.id, m => {
        // Whole-meal tick: all items on, or all off if already done
        meal.items.forEach((item, i) => { m[i] = !done && !isOptional(item) ? true : (done ? false : !!m[i]); });
      });
      card.querySelectorAll('.meal-item').forEach(el => el.onclick = () => {
        const i = parseInt(el.dataset.idx);
        setTicks(meal.id, m => { m[i] = !m[i]; });
      });
    });

    const notes = document.createElement('div');
    notes.className = 'card';
    notes.innerHTML = `<div class="card-title">Diet Notes</div>
      ${PLAN.dietNotes.map(n => `<div class="text-sm mt8">• ${n}</div>`).join('')}`;
    container.appendChild(notes);
  }

  render();
};
