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
  const todayIdx = days.findIndex(d => fmtDate(d) === todayS);
  const doneThisWeek = new Set(workoutsThisWeek(monday).filter(w => w && w !== 'Rest'));

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
    ${doneCount >= 5 ? '<div class="mt8 text-sm text-green">All workouts done this week!</div>' : ''}
  `;
  container.appendChild(stripEl);

  const strip = document.getElementById('week-strip');
  days.forEach((d, i) => {
    const ds = fmtDate(d);
    const isToday = ds === todayS;
    const logged = logs[ds];
    const isDone = logged && logged !== 'Rest';
    const planned = !logged && i >= todayIdx ? PLAN.schedule[i] : null;
    // Missed: a past day with nothing logged whose scheduled workout wasn't made up later this week
    const missed = !logged && i < todayIdx && PLAN.schedule[i] !== 'Rest' && !doneThisWeek.has(PLAN.schedule[i]);
    const chip = document.createElement('div');
    chip.className = 'day-chip' + (isToday ? ' today' : '') + (isDone ? ' done' : '') + (missed ? ' missed' : '');
    chip.setAttribute('aria-label', `${DOW[i]} ${d.getDate()}: ${isDone ? logged + ', completed' : missed ? PLAN.schedule[i] + ', missed' : logged || planned || 'nothing logged'}`);
    chip.innerHTML = `
      <span class="dc-dow">${DOW[i]}</span>
      <span class="dc-date">${d.getDate()}</span>
      <span class="dc-label${planned ? ' planned' : ''}">${logged ? PLAN.shortNames[logged] : planned ? PLAN.shortNames[planned] : missed ? 'Missed' : '—'}</span>
      <span class="dc-mark">${isDone ? '<svg class="icon" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : ''}</span>
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

  // ── Meals ──
  const mealsEl = document.createElement('div');
  container.appendChild(mealsEl);
  App.renderMealChecklist(mealsEl, todayS, { collapsible: true });

  // ── Supplements/water quick summary ──
  const suppCard = document.createElement('div');
  suppCard.className = 'card';
  suppCard.id = 'today-supp-card';
  renderTodaySupps(suppCard, todayS);
  container.appendChild(suppCard);

  function renderTodayWorkout(el, ds, wo) {
    const dayName = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][todayIdx];
    const fullName = w => w === 'Rest' ? 'Rest day' : PLAN.workouts[w].label;
    el.innerHTML = `<div class="card-title">Today's Plan · ${dayName}</div>`;

    if (wo) {
      el.innerHTML += `<div class="row-between"><span class="badge badge-${wo==='Rest'?'green':'red'}">${fullName(wo)}</span>
        <button class="btn btn-secondary btn-sm" id="change-today-btn">Change</button></div>
        ${wo !== 'Rest' ? `<button class="btn btn-primary btn-full mt12" id="go-workout-btn">Open Workout</button>` : ''}`;
    } else {
      // Scheduled workout is the default; earlier scheduled workouts not done this week are offered as catch-ups
      const scheduled = PLAN.schedule[todayIdx];
      const missed = PLAN.schedule.slice(0, todayIdx)
        .filter((w, i, arr) => w !== 'Rest' && !doneThisWeek.has(w) && arr.indexOf(w) === i);
      let primary = scheduled;
      let note = '';
      if (scheduled !== 'Rest' && doneThisWeek.has(scheduled)) {
        note = `${scheduled} is already done this week.`;
        primary = missed[0] || PLAN.workoutOrder.find(w => !doneThisWeek.has(w)) || 'Rest';
      }
      const catchUps = missed.filter(w => w !== primary);

      el.innerHTML += `
        ${note ? `<div class="text-sm text-muted" style="margin-bottom:8px">${note}</div>` : ''}
        <button class="btn btn-primary btn-full" data-start="${primary}">${primary === 'Rest' ? 'Log rest day' : 'Start ' + fullName(primary)}</button>
        ${catchUps.length ? `<div class="catchup mt12">
            <div class="text-sm">Missed this week: <strong>${catchUps.map(fullName).join(', ')}</strong></div>
            <div class="row mt8" style="flex-wrap:wrap">
              ${catchUps.map(w => `<button class="btn btn-secondary btn-sm" data-start="${w}">Do ${w} instead</button>`).join('')}
            </div>
          </div>` : ''}
        <button class="link-btn mt8" id="pick-other-btn">Pick a different workout ›</button>`;

      el.querySelectorAll('[data-start]').forEach(b => b.addEventListener('click', () => {
        const w = b.dataset.start;
        Store.set(d => d.workoutLogs[ds] = w);
        App.navigate(w === 'Rest' ? 'today' : 'workouts');
      }));
    }
    el.querySelectorAll('#pick-other-btn, #change-today-btn').forEach(b => b.addEventListener('click', () => openDayPicker(ds, todayIdx)));
    el.querySelectorAll('#go-workout-btn').forEach(b => b.addEventListener('click', () => {
      App.navigate('workouts');
    }));
  }

  function renderTodaySupps(el, ds) {
    const suppLogs = Store.get().supplementLogs[ds] || {};
    el.innerHTML = `<div class="card-title">Daily Checklist</div>`;

    // Supplements
    PLAN.dailySupplements.forEach(s => {
      const checked = suppLogs[s.id] || false;
      const item = document.createElement('div');
      item.className = 'checklist-item' + (checked ? ' checked' : '');
      const amount = s.amount[isTrainingDay(ds) ? 'training' : 'nonTraining'];
      item.innerHTML = `<div class="check-box"></div>
        <div><div class="check-label">${s.label}</div><div class="text-sm text-muted">${amount}</div></div>`;
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
    // Stored as cup counts (1 drop = 1 cup = 8 oz); unit only changes labels
    const waterRow = document.createElement('div');
    waterRow.className = 'mt12';
    el.appendChild(waterRow);
    renderWater();

    function renderWater() {
      const { waterUnit: unit, waterGoalCups: goal } = Store.get().settings;
      const count = Store.get().waterLogs[ds] || 0;
      const amt = n => unit === 'oz' ? `${n * 8}` : `${n}`;
      const unitLbl = unit === 'oz' ? 'oz' : 'cups';
      waterRow.innerHTML = `<div class="row-between text-sm" style="margin-bottom:8px">
          <div class="row" style="gap:8px"><span>Water</span>
            <select id="water-unit" class="select-sm" aria-label="Water unit">
              <option value="cups" ${unit === 'cups' ? 'selected' : ''}>Cups</option>
              <option value="oz" ${unit === 'oz' ? 'selected' : ''}>Ounces</option>
            </select></div>
          <span><span id="water-label">${amt(count)}</span> /
            <button id="water-goal-btn" class="link-btn" aria-label="Edit water goal">${amt(goal)} ${unitLbl}
              <svg class="icon" style="width:13px;height:13px" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg></button></span>
        </div>
        ${count >= goal ? '<div class="text-sm text-green" style="margin-bottom:8px">Goal reached</div>' : ''}`;
      waterRow.querySelector('#water-unit').onchange = e => {
        Store.set(d => d.settings.waterUnit = e.target.value);
        renderWater();
      };
      waterRow.querySelector('#water-goal-btn').onclick = editGoal;

      const drops = document.createElement('div');
      drops.className = 'water-glasses';
      for (let i = 0; i < Math.max(goal, count); i++) {
        const g = document.createElement('button');
        g.className = 'water-glass' + (i < count ? ' filled' : '') + (i >= goal ? ' extra' : '');
        g.setAttribute('aria-label', `Cup ${i + 1}`);
        g.innerHTML = '<svg class="icon" viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>';
        g.onclick = () => {
          const cur = Store.get().waterLogs[ds] || 0;
          Store.set(d => d.waterLogs[ds] = i < cur ? i : i + 1);
          renderWater();
        };
        drops.appendChild(g);
      }
      if (count >= goal) {
        const plus = document.createElement('button');
        plus.className = 'water-glass water-plus';
        plus.setAttribute('aria-label', 'Add a cup');
        plus.innerHTML = '<svg class="icon" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
        plus.onclick = () => {
          Store.set(d => d.waterLogs[ds] = (d.waterLogs[ds] || 0) + 1);
          renderWater();
        };
        drops.appendChild(plus);
      }
      waterRow.appendChild(drops);
    }

    function editGoal() {
      const { waterUnit: unit, waterGoalCups: goal } = Store.get().settings;
      const oz = unit === 'oz';
      App.showModal(`<h2>Daily water goal</h2>
        <p class="text-sm text-muted mt8">${oz ? 'In ounces. Rounded to the nearest cup (8 oz); each drop is one cup.' : 'In cups. Each drop is one cup (8 oz).'}</p>
        <div class="row mt12">
          <input type="number" inputmode="numeric" min="1" step="${oz ? 8 : 1}" id="water-goal-input" style="flex:1" value="${oz ? goal * 8 : goal}">
          <span class="text-muted">${oz ? 'oz' : 'cups'}</span>
          <button class="btn btn-primary btn-sm" id="water-goal-save">Save</button>
        </div>`);
      document.getElementById('water-goal-save').onclick = () => {
        const v = parseFloat(document.getElementById('water-goal-input').value);
        if (!(v > 0)) return;
        const cups = Math.min(40, Math.max(1, Math.round(oz ? v / 8 : v)));
        Store.set(d => d.settings.waterGoalCups = cups);
        App.closeModal();
        renderWater();
      };
    }
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
