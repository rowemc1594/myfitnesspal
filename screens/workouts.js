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

  function buildExerciseEl(ex) {
    const wrap = document.createElement('div');
    wrap.className = 'exercise-card';

    const pr = getPR(ex.id);
    const lastSets = getLastSession(ex.id, todayS);
    const lastStr = lastSets && lastSets.length
      ? lastSets.map(s => `${s.weight}×${s.reps}`).join(', ')
      : 'No previous data';

    wrap.innerHTML = `
      <div class="row-between">
        <div class="exercise-name">${ex.label}</div>
        ${pr ? `<span class="pr-badge">PR ${pr}kg</span>` : ''}
      </div>
      <div class="exercise-meta">
        ${ex.sets}×${ex.reps}
        ${ex.tempo ? ` · <strong>${ex.tempo}</strong>` : ''}
        ${ex.rest && ex.rest !== 'none' ? ` · rest ${ex.rest}` : ''}
      </div>
      ${ex.note ? `<div class="text-sm text-muted" style="margin-bottom:8px">${ex.note}</div>` : ''}
      <div class="last-session">Last: ${lastStr}</div>
      <div class="set-rows" id="sets-${ex.id}"></div>
    `;

    const setRows = wrap.querySelector(`#sets-${ex.id}`);
    const numSets = ex.sets || 1;
    for (let s = 0; s < numSets; s++) {
      const key = `${todayS}_${ex.id}_${s}`;
      const saved = Store.get().setLogs[key] || {};
      const row = document.createElement('div');
      row.className = 'set-row';
      row.innerHTML = `
        <span class="set-num">${s+1}</span>
        <input class="set-input" type="text" placeholder="weight" value="${saved.weight||''}" style="max-width:70px">
        <span class="text-muted">×</span>
        <input class="set-input" type="text" placeholder="reps" value="${saved.reps||''}">
        <button class="set-done-btn ${saved.done?'done':''}" title="Mark done">✓</button>
      `;
      const [wInput, rInput] = row.querySelectorAll('.set-input');
      const doneBtn = row.querySelector('.set-done-btn');

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
