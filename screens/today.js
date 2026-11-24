'use strict';
App.screens.today = function(container) {
  const today = new Date();
  const todayS = todayStr();
  const monday = mondayOfWeek(today);
  const days = weekDays(monday);
  const logs = Store.get().workoutLogs;

  // ── Week strip ──
  const stripEl = document.createElement('div');
  stripEl.className = 'card';
  const doneCount = completedCountThisWeek(monday);
  const nextW = nextWorkout(monday);

  stripEl.innerHTML = `
    <div class="card-title">This Week</div>
    <div class="week-strip" id="week-strip"></div>
    <div class="mt8 row-between">
      <span class="text-sm text-muted">Week progress</span>
      <span class="text-sm"><strong>${doneCount}</strong> of 5 done</span>
    </div>
    <div class="progress-bar mt8">
      <div class="progress-fill" style="width:${(doneCount/5)*100}%"></div>
    </div>
    ${nextW ? `<div class="mt8 text-sm">Up next: <span class="text-accent">${nextW}</span></div>` : '<div class="mt8 text-sm text-green">All workouts done this week!</div>'}
  `;
  container.appendChild(stripEl);

  const strip = document.getElementById('week-strip');
  days.forEach((d, i) => {
    const ds = fmtDate(d);
    const isToday = ds === todayS;
    const logged = logs[ds];
    const isDone = logged && logged !== 'Rest';
    const isRest = logged === 'Rest';
    const chip = document.createElement('div');
    chip.className = 'day-chip' + (isToday ? ' today' : '') + (isDone ? ' done' : '');
    chip.innerHTML = `
      <span class="dc-dow">${DOW[i]}</span>
      <span class="dc-date">${d.getDate()}</span>
      <span class="dc-label">${logged ? (logged === 'Rest' ? 'Rest' : logged) : '—'}</span>
    `;
    chip.addEventListener('click', () => openDayPicker(ds, i));
    strip.appendChild(chip);
  });

  // ── Today workout card ──
  const todayWorkout = logs[todayS];
  const wCard = document.createElement('div');
  wCard.className = 'card';
  wCard.id = 'today-workout-card';
  renderTodayWorkout(wCard, todayS, todayWorkout);
  container.appendChild(wCard);

  // ── Supplements/water quick summary ──
  const suppCard = document.createElement('div');
  suppCard.className = 'card';
  suppCard.id = 'today-supp-card';
  renderTodaySupps(suppCard, todayS);
  container.appendChild(suppCard);

  function renderTodayWorkout(el, ds, wo) {
    const training = isTrainingDay(ds);
    el.innerHTML = `<div class="card-title">Today's Plan</div>`;
    if (wo) {
      el.innerHTML += `<div class="row-between"><span class="badge badge-${wo==='Rest'?'green':'red'}">${wo}</span>
        <button class="btn btn-secondary btn-sm" id="change-today-btn">Change</button></div>
        <div class="mt8 text-sm text-muted">Meals: ${training ? 'Training Day' : 'Non-Training Day'}</div>
        ${wo !== 'Rest' ? `<button class="btn btn-primary btn-full mt12" id="go-workout-btn">Start Workout</button>` : ''}`;
    } else {
      el.innerHTML += `<div class="text-muted text-sm">No workout logged yet</div>
        <button class="btn btn-primary btn-full mt12" id="log-today-btn">${nextW ? 'Start: ' + nextW : 'Log Workout'}</button>`;
    }
    el.querySelectorAll('#log-today-btn').forEach(b => b.addEventListener('click', () => openDayPicker(ds, days.findIndex(d => fmtDate(d)===ds))));
    el.querySelectorAll('#change-today-btn').forEach(b => b.addEventListener('click', () => openDayPicker(ds, days.findIndex(d => fmtDate(d)===ds))));
    el.querySelectorAll('#go-workout-btn').forEach(b => b.addEventListener('click', () => {
      App.navigate('workouts');
    }));
  }

  function renderTodaySupps(el, ds) {
    const suppLogs = Store.get().supplementLogs[ds] || {};
    const waterGlasses = Store.get().waterLogs[ds] || 0;
    const waterGoal = PLAN.waterGoalLitres * 4; // 250ml glasses
    el.innerHTML = `<div class="card-title">Daily Checklist</div>`;

    // Supplements
    PLAN.dailySupplements.forEach(s => {
      const checked = suppLogs[s.id] || false;
      const item = document.createElement('div');
      item.className = 'checklist-item' + (checked ? ' checked' : '');
      item.innerHTML = `<div class="check-box"></div><span class="check-label">${s.label}</span>`;
      item.addEventListener('click', () => {
        Store.set(d => {
          if (!d.supplementLogs[ds]) d.supplementLogs[ds] = {};
          d.supplementLogs[ds][s.id] = !d.supplementLogs[ds][s.id];
        });
        item.classList.toggle('checked');
      });
      el.appendChild(item);
    });

    // Water
    const waterRow = document.createElement('div');
    waterRow.className = 'mt12';
    waterRow.innerHTML = `<div class="row-between text-sm mb4"><span>Water</span><span id="water-label">${(waterGlasses*0.25).toFixed(2)}L / ${PLAN.waterGoalLitres}L</span></div>`;
    const glassesEl = document.createElement('div');
    glassesEl.className = 'water-glasses';
    for (let i = 0; i < waterGoal; i++) {
      const g = document.createElement('div');
      g.className = 'water-glass' + (i < waterGlasses ? ' filled' : '');
      g.innerHTML = '<svg class="icon" viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>';
      g.addEventListener('click', () => {
        const newVal = i < waterGlasses ? i : i + 1;
        Store.set(d => d.waterLogs[ds] = newVal);
        waterRow.querySelector('#water-label').textContent = `${(newVal*0.25).toFixed(2)}L / ${PLAN.waterGoalLitres}L`;
        for (let j = 0; j < waterGoal; j++) {
          glassesEl.children[j].classList.toggle('filled', j < newVal);
        }
      });
      glassesEl.appendChild(g);
    }
    waterRow.appendChild(glassesEl);
    el.appendChild(waterRow);
  }

  function openDayPicker(ds, dayIdx) {
    const opts = [...PLAN.workoutOrder, 'Rest'];
    const current = logs[ds] || '';
    let html = `<h2 style="margin-bottom:14px">${DOW[dayIdx]}, ${ds}</h2>
      <div class="section-label">Select workout</div>`;
    opts.forEach(w => {
      html += `<div class="checklist-item ${current===w?'checked':''}" data-wo="${w}">
        <div class="check-box"></div><span class="check-label">${w}</span></div>`;
    });
    html += `${current ? `<button class="btn btn-secondary btn-full mt12" id="clear-day-btn">Clear day</button>` : ''}`;
    App.showModal(html);
    document.getElementById('modal-content').querySelectorAll('[data-wo]').forEach(el => {
      el.addEventListener('click', () => {
        const wo = el.dataset.wo;
        Store.set(d => d.workoutLogs[ds] = wo);
        App.closeModal();
        App.navigate('today');
      });
    });
    const clearBtn = document.getElementById('clear-day-btn');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      Store.set(d => delete d.workoutLogs[ds]);
      App.closeModal();
      App.navigate('today');
    });
  }
};
