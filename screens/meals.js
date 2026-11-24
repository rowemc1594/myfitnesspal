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
  function move(idx, dir) {
    const ids = meals.map(m => m.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    Store.set(d => { d.mealOrder = d.mealOrder || {}; d.mealOrder[todayS] = ids; });
    App.navigate('meals');
  }
  const mealType = training ? 'Training Day' : 'Non-Training Day';
  const mealLogs = Store.get().mealLogs[todayS] || {};

  // Header
  const hdr = document.createElement('div');
  hdr.className = 'card';
  hdr.innerHTML = `<div class="row-between">
    <div>
      <div class="card-title">Today's Meals</div>
      <div class="text-sm">${mealType}</div>
    </div>
    <span class="badge ${training?'badge-red':'badge-green'}">${training?'Training':'Rest'}</span>
  </div>
  <div class="mt8 text-sm text-muted">Tap a meal to expand. Tap items to mark eaten.</div>`;
  container.appendChild(hdr);

  meals.forEach((meal, pos) => {
    const card = document.createElement('div');
    card.className = 'card';
    const checkedItems = mealLogs[meal.id] || {};
    const allChecked = meal.items.every((_,i) => checkedItems[i]);
    card.innerHTML = `
      <div class="row-between" style="cursor:pointer" data-toggle="meal-${meal.id}">
        <div>
          <div style="font-weight:700">${meal.label}${meal.postWorkout ? ' <span class="badge badge-red" style="font-size:.6rem">Post-Workout</span>' : ''}</div>
        </div>
        <div class="row" style="gap:6px">
          <span class="${allChecked?'text-green':'text-muted'}">${allChecked?'✓':'▾'}</span>
          <button class="btn btn-secondary btn-sm" data-move="-1" aria-label="Move up">↑</button>
          <button class="btn btn-secondary btn-sm" data-move="1" aria-label="Move down">↓</button>
        </div>
      </div>
      <div id="meal-body-${meal.id}" style="display:none;margin-top:10px">
        ${meal.items.map((item, i) => `
          <div class="checklist-item ${checkedItems[i]?'checked':''}" data-meal="${meal.id}" data-idx="${i}">
            <div class="check-box"></div>
            <span class="check-label">${item}</span>
          </div>`).join('')}
      </div>
    `;
    container.appendChild(card);

    card.querySelectorAll('[data-move]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      move(pos, parseInt(b.dataset.move));
    }));
    card.querySelector('[data-toggle]').addEventListener('click', () => {
      const body = card.querySelector(`#meal-body-${meal.id}`);
      body.style.display = body.style.display === 'none' ? 'block' : 'none';
    });

    card.querySelectorAll('[data-meal]').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.idx);
        Store.set(d => {
          if (!d.mealLogs[todayS]) d.mealLogs[todayS] = {};
          if (!d.mealLogs[todayS][meal.id]) d.mealLogs[todayS][meal.id] = {};
          d.mealLogs[todayS][meal.id][idx] = !d.mealLogs[todayS][meal.id][idx];
        });
        item.classList.toggle('checked');
      });
    });
  });

  // Diet notes
  const notesCard = document.createElement('div');
  notesCard.className = 'card';
  notesCard.innerHTML = `<div class="card-title">Diet Notes</div>
    ${PLAN.dietNotes.map(n => `<div class="text-sm mt8">• ${n}</div>`).join('')}`;
  container.appendChild(notesCard);
};
