'use strict';
App.screens.workouts = function(container) {
  const todayS = todayStr();
  const planned = plannedWorkout(todayS);
  const todayWorkout = completedWorkout(todayS) || (planned !== 'Rest' ? planned : '');

  // Workout selector
  const selCard = document.createElement('div');
  selCard.className = 'card';
  selCard.innerHTML = `<div class="card-title">Select Workout</div>
    <select id="workout-select">
      <option value="">-- Choose --</option>
      ${PLAN.workoutOrder.map(w => `<option value="${w}" ${todayWorkout===w?'selected':''}>${w} — ${PLAN.focus[w]}</option>`).join('')}
    </select>`;
  container.appendChild(selCard);

  const workoutContainer = document.createElement('div');
  workoutContainer.id = 'workout-exercise-list';
  container.appendChild(workoutContainer);

  const sel = document.getElementById('workout-select');
  sel.addEventListener('change', () => {
    if (sel.value) setPlanned(todayS, sel.value);
    show(sel.value);
  });
  if (todayWorkout && PLAN.workouts[todayWorkout]) show(todayWorkout);

  function show(name) {
    renderWorkout(name);
    if (name) renderFinish(name);
  }

  function renderFinish(name) {
    const done = completedWorkout(todayS) === name;
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = done
      ? `<div class="row" style="gap:10px"><span class="done-pill"><svg class="icon" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
           <div><div style="font-weight:700">${name} completed</div><div class="text-sm text-muted">Logged for today</div></div></div>
         <button class="link-btn mt8" id="undo-finish-btn">Not done? Undo</button>`
      : `<button class="btn btn-primary btn-full" id="finish-btn">Finish workout</button>
         <div class="text-sm text-muted mt8">Marks ${name} completed for today.</div>`;
    workoutContainer.appendChild(card);
    const fin = card.querySelector('#finish-btn');
    if (fin) fin.onclick = () => { setCompleted(todayS, name); App.toast(name + ' completed'); App.navigate('today'); };
    const undo = card.querySelector('#undo-finish-btn');
    if (undo) undo.onclick = () => { setCompleted(todayS, null); show(name); };
  }

  function renderWorkout(name) {
    workoutContainer.innerHTML = '';
    if (!name) return;
    const plan = PLAN.workouts[name];
    if (!plan) return;

    if (plan.dbComplex) {
      renderDBComplex(plan);
      return;
    }

    // Warmup card
    if (plan.warmup) {
      const wuCard = document.createElement('div');
      wuCard.className = 'card';
      wuCard.innerHTML = `<div class="card-title">Warm-Up</div>
        <ul style="padding-left:18px;line-height:1.9">
          ${PLAN.warmups[plan.warmup].map(w => `<li class="text-sm">${w}</li>`).join('')}
        </ul>
        <div class="mt8 text-sm text-muted">${PLAN.warmups.liftingNote}</div>`;
      workoutContainer.appendChild(wuCard);
    }

    // Tempo help
    const tempoCard = document.createElement('div');
    tempoCard.className = 'card';
    tempoCard.innerHTML = `<div class="row-between"><span class="card-title" style="margin:0">Tempo Guide</span>
      <button class="btn btn-secondary btn-sm" id="tempo-help-btn">?</button></div>`;
    tempoCard.querySelector('#tempo-help-btn').addEventListener('click', () => {
      App.showModal(`<h2>${PLAN.tempoHelp.title}</h2><div class="mt8">${PLAN.tempoHelp.body.map(b=>`<p class="text-sm mt8">${b}</p>`).join('')}</div>`);
    });
    workoutContainer.appendChild(tempoCard);

    // Group by superset
    const groups = [];
    let i = 0;
    while (i < plan.exercises.length) {
      const ex = plan.exercises[i];
      if (ex.supersetGroup) {
        const group = [ex];
        while (i+1 < plan.exercises.length && plan.exercises[i+1].supersetGroup === ex.supersetGroup) {
          i++; group.push(plan.exercises[i]);
        }
        groups.push({ type: 'superset', group });
      } else {
        groups.push({ type: 'single', ex });
      }
      i++;
    }

    groups.forEach(g => {
      if (g.type === 'superset') {
        const ssCard = document.createElement('div');
        ssCard.className = 'card';
        ssCard.innerHTML = `<div class="card-title">Superset ${g.group[0].supersetGroup}</div>`;
        g.group.forEach(ex => ssCard.appendChild(buildExerciseEl(ex)));
        workoutContainer.appendChild(ssCard);
      } else {
        const card = document.createElement('div');
        card.className = 'card';
        card.appendChild(buildExerciseEl(g.ex));
        workoutContainer.appendChild(card);
      }
    });
  }

  // Rep goal per set from the plan ("8", "10-12" -> top of range, "12/10/8/6+drops" -> per set); null if not a rep count
  function repTargets(ex) {
    const n = ex.sets || 1;
    if (ex.reps.includes('/')) {
      const parts = ex.reps.split('/').map(p => parseInt(p));
      return parts.length >= n && parts.every(p => p > 0) ? parts.slice(0, n) : null;
    }
    const m = ex.reps.match(/^(\d+)(?:-(\d+))?\b(?!\s*(s|min))/);
    return m ? Array(n).fill(parseInt(m[2] || m[1])) : null;
  }

  // Simple progression: every set hit its rep goal last time -> add 5; otherwise same weight, chase the reps.
  // Returns { text, sets: [{weight, reps}] } so the target can fill the set rows.
  function targetFor(ex, last) {
    const goals = repTargets(ex);
    if (!goals) return null;
    const repsText = goals.every(g => g === goals[0]) ? String(goals[0]) : goals.join('/');
    const repsOnly = goals.map(g => ({ weight: '', reps: String(g) }));
    if (!last) return { text: `First time: pick a weight you can do for ${repsText} with good form.`, sets: repsOnly };
    const prev = goals.map((_, i) => last.sets[i]);
    const num = s => { const w = s && parseFloat(s.weight); return !isNaN(w) && w > 0 ? w : null; };
    const weights = prev.map(num).filter(w => w !== null);
    const allHit = prev.every((s, i) => s && parseInt(s.reps) >= goals[i]);
    if (!weights.length) return { text: `Hit ${repsText} reps on every set.`, sets: repsOnly };
    // Straight sets aim at last time's heaviest weight; pyramids (per-set rep goals) keep each set's weight
    const straight = goals.every(g => g === goals[0]);
    const top = Math.max(...weights);
    const add = allHit ? 5 : 0;
    const sets = goals.map((g, i) => {
      const base = straight ? top : (num(prev[i]) ?? top);
      return { weight: String(base + add), reps: String(g) };
    });
    let text;
    if (allHit) {
      text = straight
        ? `<strong>${top + 5} × ${repsText}</strong> <span class="text-green">(+5)</span>. You hit every set last time.`
        : `<strong>+5 on each set</strong>, ${repsText} reps. You hit every set last time.`;
    } else {
      // Say why we're not adding weight yet: short sets, missing sets, and (straight sets) lighter sets
      const why = [];
      prev.forEach((p, i) => {
        if (!p) why.push(`set ${i + 1} wasn't logged`);
        else if (parseInt(p.reps) < goals[i]) why.push(`set ${i + 1} got ${parseInt(p.reps) || 0} of ${goals[i]}`);
        else if (straight && num(p) !== null && num(p) < top) why.push(`set ${i + 1} was at ${num(p)}`);
      });
      const reason = why.length ? ` <span class="text-muted">Last time ${why.join(', ')}.</span>` : '';
      text = straight
        ? `<strong>${top} × ${repsText}</strong> on all sets, then add 5.${reason}`
        : `Same weights as last time; hit <strong>${repsText}</strong> on every set, then add 5.${reason}`;
    }
    return { text, sets };
  }

  function buildExerciseEl(ex) {
    const wrap = document.createElement('div');
    wrap.className = 'exercise-card';

    const pr = getPR(ex.id);
    const last = lastSession(ex.id, todayS);
    const numSets = ex.sets || 1;
    const lastDate = last ? parseDate(last.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : null;
    const target = targetFor(ex, last);

    wrap.innerHTML = `
      <div class="row-between">
        <div class="exercise-name">${ex.label}</div>
        ${pr ? `<span class="pr-badge">PR ${pr}</span>` : ''}
      </div>
      <div class="exercise-meta">
        ${ex.sets}×${ex.reps}
        ${ex.tempo ? ` · <strong>${ex.tempo}</strong>` : ''}
        ${ex.rest && ex.rest !== 'none' ? ` · rest ${ex.rest}` : ''}
      </div>
      ${ex.note ? `<div class="text-sm text-muted" style="margin-bottom:8px">${ex.note}</div>` : ''}
      ${target ? `<button class="target-line" aria-label="Fill sets with target">
          <span><span class="target-tag">Target</span> ${target.text}</span>
          <span class="target-fill">Tap to fill sets</span>
        </button>` : ''}
      ${lastDate ? `<div class="text-sm text-muted">Last session: ${lastDate} · tap a "Last" value to copy it</div>` : ''}
      <div class="set-grid set-head">
        <span>Set</span><span>Last</span><span>This week</span><span></span>
      </div>
      <div class="set-rows" id="sets-${ex.id}"></div>
    `;

    const setRows = wrap.querySelector(`#sets-${ex.id}`);
    const fillers = [];
    const tBtn = wrap.querySelector('.target-line');
    if (tBtn) tBtn.onclick = () => {
      const filled = fillers.filter(f => f()).length;
      App.toast(filled ? `Filled ${filled} set${filled > 1 ? 's' : ''}. Tick ✓ when done, or edit first` : 'All sets already ticked');
    };
    for (let s = 0; s < numSets; s++) {
      const key = `${todayS}_${ex.id}_${s}`;
      const saved = Store.get().setLogs[key] || {};
      const prev = last && last.sets[s];
      const row = document.createElement('div');
      row.className = 'set-row set-grid' + (saved.done ? ' is-done' : '');
      row.innerHTML = `
        <span class="set-num">${s+1}</span>
        ${prev
          ? `<button class="last-cell" aria-label="Copy last time: ${prev.weight} × ${prev.reps}">${prev.weight || '–'} × ${prev.reps || '–'}</button>`
          : '<span class="last-cell empty">—</span>'}
        <span class="row" style="gap:4px">
          <input class="set-input" type="text" inputmode="decimal" placeholder="wt" aria-label="Weight" value="${saved.weight||''}">
          <span class="text-muted">×</span>
          <input class="set-input" type="text" inputmode="numeric" placeholder="reps" aria-label="Reps" value="${saved.reps||''}">
        </span>
        <button class="set-done-btn ${saved.done?'done':''}" title="Mark set done">✓</button>
      `;
      const [wInput, rInput] = row.querySelectorAll('.set-input');
      const doneBtn = row.querySelector('.set-done-btn');
      const copy = row.querySelector('button.last-cell');
      if (copy) copy.onclick = () => { wInput.value = prev.weight || ''; rInput.value = prev.reps || ''; saveSet(); };
      // Target fills only sets not yet ticked; returns whether it filled this one
      fillers.push(() => {
        if (doneBtn.classList.contains('done') || !target.sets[s]) return false;
        wInput.value = target.sets[s].weight || wInput.value;
        rInput.value = target.sets[s].reps;
        saveSet();
        return true;
      });

      function saveSet() {
        Store.set(d => {
          d.setLogs[key] = { weight: wInput.value, reps: rInput.value, done: doneBtn.classList.contains('done') };
        });
      }
      wInput.addEventListener('change', saveSet);
      rInput.addEventListener('change', saveSet);
      doneBtn.addEventListener('click', () => {
        const nowDone = !doneBtn.classList.contains('done');
        doneBtn.classList.toggle('done', nowDone);
        row.classList.toggle('is-done', nowDone);
        saveSet();
        if (nowDone && ex.rest && ex.rest !== 'none') {
          App.startRestTimer(App.parseRestSeconds(ex.rest));
        }
      });
      setRows.appendChild(row);
    }
    return wrap;
  }

  function renderDBComplex(plan) {
    const card = document.createElement('div');
    card.className = 'card';
    let roundRestSec = plan.restBetweenRounds;

    // Retrieve saved round rest for this week
    const weekKey = fmtDate(mondayOfWeek(new Date()));
    const savedRestKey = `dbcomplex_rest_${weekKey}`;
    const savedRest = parseInt(localStorage.getItem(savedRestKey) || roundRestSec);
    roundRestSec = savedRest;

    card.innerHTML = `
      <div class="card-title">Dumbbell Complex</div>
      <p class="text-sm text-muted mt8">${plan.note}</p>
      <div class="mt8">
        ${plan.exercises.map(e => `<div class="text-sm mt8">• ${e.label} — ${e.reps} reps each arm</div>`).join('')}
      </div>
      <div class="divider"></div>
      <div class="row-between mt8">
        <span class="text-sm">Rest between rounds</span>
        <span id="dc-rest-val" class="text-accent">${roundRestSec}s</span>
      </div>
      <div class="row mt8" style="gap:8px">
        <button class="btn btn-secondary btn-sm" id="dc-rest-minus">−15s</button>
        <button class="btn btn-secondary btn-sm" id="dc-rest-plus">+15s</button>
      </div>
      <div class="divider"></div>
      <div class="row-between">
        <span class="text-sm">Round <strong id="dc-round">1</strong> of ${plan.rounds}</span>
        <span id="dc-timer" class="text-muted text-sm">—</span>
      </div>
      <div class="progress-bar mt8">
        <div class="progress-fill" id="dc-progress" style="width:0%"></div>
      </div>
      <button class="btn btn-primary btn-full mt12" id="dc-next-btn">Start Round 1</button>
      <div class="mt8 text-sm text-muted" id="dc-status"></div>
      <div class="divider"></div>
      <div class="text-sm">After 6 rounds: <strong>${plan.cardioAfter}</strong></div>
    `;
    workoutContainer.appendChild(card);

    let currentRound = 0;
    let timerInterval = null;

    card.querySelector('#dc-rest-minus').addEventListener('click', () => {
      roundRestSec = Math.max(15, roundRestSec - 15);
      localStorage.setItem(savedRestKey, roundRestSec);
      card.querySelector('#dc-rest-val').textContent = roundRestSec + 's';
    });
    card.querySelector('#dc-rest-plus').addEventListener('click', () => {
      roundRestSec = Math.min(300, roundRestSec + 15);
      localStorage.setItem(savedRestKey, roundRestSec);
      card.querySelector('#dc-rest-val').textContent = roundRestSec + 's';
    });

    card.querySelector('#dc-next-btn').addEventListener('click', () => {
      currentRound++;
      card.querySelector('#dc-round').textContent = currentRound;
      card.querySelector('#dc-progress').style.width = `${(currentRound/plan.rounds)*100}%`;
      if (currentRound >= plan.rounds) {
        card.querySelector('#dc-next-btn').textContent = 'All rounds done!';
        card.querySelector('#dc-next-btn').disabled = true;
        card.querySelector('#dc-status').textContent = 'Now do ' + plan.cardioAfter;
        return;
      }
      card.querySelector('#dc-next-btn').disabled = true;
      let remaining = roundRestSec;
      const timerEl = card.querySelector('#dc-timer');
      clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        timerEl.textContent = remaining + 's';
        if (remaining <= 0) {
          clearInterval(timerInterval);
          card.querySelector('#dc-next-btn').disabled = false;
          card.querySelector('#dc-next-btn').textContent = `Start Round ${currentRound+1}`;
          timerEl.textContent = 'Go!';
          if (navigator.vibrate) navigator.vibrate([200,100,200]);
          App.beep();
        }
        remaining--;
      }, 1000);
    });
  }
};
