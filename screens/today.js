'use strict';
App.screens.today = function(container) {
  const today = new Date();
  const todayS = todayStr();
  const monday = mondayOfWeek(today);
  const days = weekDays(monday);
  const CHECK_SVG = '<svg class="icon" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const fullName = w => w === 'Rest' ? 'Rest day' : PLAN.workouts[w].label;

  // ── Week strip ──
  const stripEl = document.createElement('div');
  stripEl.className = 'card';
  const doneCount = completedCountThisWeek(monday);
  const todayIdx = days.findIndex(d => fmtDate(d) === todayS);
  const doneThisWeek = new Set(workoutsThisWeek(monday).filter(Boolean));
  const wp = weekPlan(monday);

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
    const done = completedWorkout(ds);
    const planned = wp.plan[i];
    // Missed: a past day not completed whose planned workout wasn't made up later this week
    const skippedDay = !done && i < todayIdx && !!(Store.get().skippedDays || {})[ds];
    const missed = !done && !skippedDay && i < todayIdx && planned !== 'Rest' && !doneThisWeek.has(planned);
    const upcoming = !done && i >= todayIdx;
    const moved = upcoming && planned !== PLAN.schedule[i];
    const label = done ? PLAN.shortNames[done]
      : upcoming || planned === 'Rest' ? PLAN.shortNames[planned]
      : skippedDay ? 'Skipped' : missed ? 'Missed' : '—';
    const chip = document.createElement('div');
    chip.className = 'day-chip' + (isToday ? ' today' : '') + (done ? ' done' : '') + (missed ? ' missed' : '') + (skippedDay ? ' skipped' : '');
    chip.setAttribute('aria-label', `${DOW[i]} ${d.getDate()}: ${done ? done + ', completed' : missed ? planned + ', missed' : planned + ', planned'}`);
    chip.innerHTML = `
      <span class="dc-dow">${DOW[i]}</span>
      <span class="dc-date">${d.getDate()}</span>
      <span class="dc-label${upcoming ? ' planned' : ''}${moved ? ' moved' : ''}">${label}</span>
      <span class="dc-mark">${done ? CHECK_SVG : ''}</span>
    `;
    // Past days open the workout to log what you did; today and future days pick a workout
    chip.addEventListener('click', () => {
      if (i < todayIdx) { App._workoutDate = ds; App.navigate('workouts'); }
      else openDayPicker(ds, i);
    });
    strip.appendChild(chip);
  });

  // ── Today workout card ──
  const wCard = document.createElement('div');
  wCard.className = 'card';
  wCard.id = 'today-workout-card';
  renderTodayWorkout(wCard, todayS);
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

  function renderTodayWorkout(el, ds) {
    const dayName = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][todayIdx];
    el.innerHTML = `<div class="card-title">Today's Plan · ${dayName}</div>`;
    const done = completedWorkout(ds);
    const chosen = Store.get().workoutPlan[ds];

    if (done) {
      el.innerHTML += `
        <div class="row" style="gap:10px"><span class="done-pill">${CHECK_SVG}</span>
          <div><div style="font-weight:700">${fullName(done)}</div><div class="text-sm text-green">Completed</div></div></div>
        <button class="btn btn-secondary btn-full mt12" id="go-workout-btn">View workout</button>
        <button class="link-btn mt8" id="undo-done-btn">Not done? Undo</button>`;
    } else {
      // Default comes from the re-flowed week plan. Skipped workouts, and any that no longer fit this week, are offered as catch-ups.
      const primary = wp.plan[todayIdx];
      const scheduled = PLAN.schedule[todayIdx];
      const catchUps = [...(chosen ? [] : wp.skipped), ...wp.unscheduled].filter(w => w !== primary);
      const note = !chosen && primary !== scheduled
        ? (doneThisWeek.has(scheduled) ? `${scheduled} is already done this week, so the plan moved up.` : `Your week was re-ordered after a swap.`)
        : '';

      el.innerHTML += `
        ${note ? `<div class="text-sm text-muted" style="margin-bottom:8px">${note}</div>` : ''}
        ${primary === 'Rest'
          ? `<div style="font-weight:700">Rest day</div><div class="text-sm text-muted">${PLAN.focus.Rest}</div>`
          : `<button class="btn btn-primary btn-full" id="start-btn">Start ${fullName(primary)}</button>`}
        ${catchUps.length ? `<div class="catchup mt12">
            <div class="text-sm">${catchUps.every(w => wp.unscheduled.includes(w)) ? "Doesn't fit in this week's training days" : 'Missed this week'}: <strong>${catchUps.map(fullName).join(', ')}</strong></div>
            <div class="row mt8" style="flex-wrap:wrap">
              ${catchUps.map(w => `<button class="btn btn-secondary btn-sm" data-switch="${w}">Do ${w} instead</button>`).join('')}
            </div>
          </div>` : ''}
        <button class="link-btn mt8" id="pick-other-btn">${primary === 'Rest' ? 'Train today instead ›' : 'Pick a different workout ›'}</button>`;

      el.querySelectorAll('#start-btn').forEach(b => b.onclick = () => { setPlanned(ds, primary); App.navigate('workouts'); });
      el.querySelectorAll('[data-switch]').forEach(b => b.onclick = () => { setPlanned(ds, b.dataset.switch); App.navigate('today'); });
    }
    el.querySelectorAll('#pick-other-btn').forEach(b => b.onclick = () => openDayPicker(ds, todayIdx));
    el.querySelectorAll('#go-workout-btn').forEach(b => b.onclick = () => App.navigate('workouts'));
    el.querySelectorAll('#undo-done-btn').forEach(b => b.onclick = () => { setCompleted(ds, null); App.navigate('today'); });
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

  // Choosing a workout only sets the plan; completion is a separate toggle (today and past days only)
  function openDayPicker(ds, dayIdx) {
    const planned = plannedWorkout(ds);
    const done = completedWorkout(ds);
    // Completing is done inside the workout for today; past days can't be opened, so they keep a link here
    const isPast = ds < todayS;
    const custom = !!Store.get().workoutPlan[ds] && Store.get().workoutPlan[ds] !== PLAN.schedule[dayIdx];
    let choice = planned;
    App.showModal(`<h2>${DOW[dayIdx]}, ${ds}</h2>
      <p class="text-sm text-muted" style="margin:4px 0 12px">Pick the workout for this day.</p>
      ${workoutOptionsHTML(planned)}
      <button class="btn btn-primary btn-full mt12" id="change-wo-btn"></button>
      ${isPast && planned !== 'Rest' ? `<button class="link-btn mt8" id="toggle-done-btn">${done ? `${done} completed · undo` : `Mark ${planned} completed`}</button>` : ''}
      ${custom || done ? `<button class="link-btn mt8" id="reset-day-btn">Reset to schedule (${PLAN.schedule[dayIdx]})</button>` : ''}`);
    const btn = document.getElementById('change-wo-btn');
    const sync = () => {
      document.querySelectorAll('#modal-content [data-wo]').forEach(el => {
        const on = el.dataset.wo === choice;
        el.classList.toggle('selected', on);
        el.setAttribute('aria-pressed', on);
      });
      btn.textContent = choice === planned ? 'Keep ' + planned : `Change to ${choice}`;
    };
    document.querySelectorAll('#modal-content [data-wo]').forEach(el => el.onclick = () => { choice = el.dataset.wo; sync(); });
    btn.onclick = () => {
      if (choice !== planned) {
        setPlanned(ds, choice);
        // A completed (past) day keeps matching what was picked
        if (completedWorkout(ds)) setCompleted(ds, choice === 'Rest' ? null : choice);
        App.toast(`${DOW[dayIdx]}: ${choice}`);
      }
      App.closeModal();
      App.navigate('today');
    };
    sync();
    const tog = document.getElementById('toggle-done-btn');
    if (tog) tog.onclick = () => { setCompleted(ds, done ? null : planned); App.closeModal(); App.navigate('today'); };
    const reset = document.getElementById('reset-day-btn');
    if (reset) reset.onclick = () => {
      Store.set(d => { delete d.workoutPlan[ds]; delete d.workoutLogs[ds]; });
      App.closeModal(); App.navigate('today');
    };
  }
};
