'use strict';
App.screens.workouts = function(container) {
  // Normally today; tapping a past day on Today's week strip opens that date to log it
  const dayS = App._workoutDate || todayStr();
  App._workoutDate = null;
  const isPast = dayS < todayStr();
  const dayIdx = (parseDate(dayS).getDay() + 6) % 7;
  const dayLabel = parseDate(dayS).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const planned = plannedWorkout(dayS);
  const todayWorkout = completedWorkout(dayS) || (planned !== 'Rest' ? planned : '');

  // Past day: say which day is being logged, and offer "skipped" instead of logging
  if (isPast) {
    const done = completedWorkout(dayS);
    const skippedDay = !!(Store.get().skippedDays || {})[dayS];
    const pb = document.createElement('div');
    pb.className = 'card past-banner';
    pb.innerHTML = `<div class="card-title" style="margin-bottom:4px">Logging ${dayLabel}</div>
      <div class="text-sm text-muted">${done ? `${done} is logged as completed. Edit your numbers below.`
        : skippedDay ? 'Marked as skipped: no workout that day.'
        : 'This day has passed. Record what you did below, or pick the workout you did instead.'}</div>
      <div class="row mt8" style="gap:8px;flex-wrap:wrap">
        ${done ? '' : skippedDay
          ? '<button class="btn btn-secondary btn-sm" id="unskip-btn">Undo skip</button>'
          : '<button class="btn btn-secondary btn-sm" id="skip-btn">Skipped · no workout</button>'}
        <button class="btn btn-secondary btn-sm" id="back-today-btn">Back to ${parseDate(dayS).toLocaleDateString(undefined, { weekday: 'long' })}</button>
      </div>`;
    container.appendChild(pb);
    const back = () => { App.viewDate = dayS; App.navigate('today'); };
    pb.querySelector('#back-today-btn').onclick = back;
    const sk = pb.querySelector('#skip-btn');
    if (sk) sk.onclick = () => { setSkipped(dayS, true); App.toast(`${dayLabel}: skipped`); back(); };
    const us = pb.querySelector('#unskip-btn');
    if (us) us.onclick = () => { setSkipped(dayS, false); App._workoutDate = dayS; App.navigate('workouts'); };
  }

  // Workout selector
  const selCard = document.createElement('div');
  selCard.className = 'card';
  selCard.innerHTML = `<div class="row-between" style="margin-bottom:8px">
      <span class="card-title" style="margin:0">${isPast ? 'Workout you did' : 'Select Workout'}</span>
      <span class="row" style="gap:6px">
        <button class="btn btn-secondary btn-sm" id="sound-test-btn" style="min-height:30px" aria-label="Test timer sound">Sound ▶</button>
        <button class="btn btn-secondary btn-sm" id="tempo-help-btn" style="min-height:30px">Tempo ?</button>
      </span>
    </div>
    <select id="workout-select">
      <option value="">-- Choose --</option>
      ${PLAN.workoutOrder.map(w => `<option value="${w}" ${todayWorkout===w?'selected':''}>${w} — ${PLAN.focus[w]}</option>`).join('')}
    </select>`;
  container.appendChild(selCard);
  selCard.querySelector('#sound-test-btn').onclick = () => {
    App.unlockAudio();
    App.playCountdownSound(0); // the same 5-4-3-2-1-Go clip the timer uses
    App.toast("Hear it? If not: turn up volume. On iPhone, check the silent switch too.", 4000);
  };
  selCard.querySelector('#tempo-help-btn').onclick = () =>
    App.showModal(`<h2>${PLAN.tempoHelp.title}</h2><div class="mt8">${PLAN.tempoHelp.body.map(b => `<p class="text-sm mt8">${b}</p>`).join('')}</div>
      <p class="text-sm text-muted mt12">Tip: tap any exercise's tempo (like 3-0-1) for its own breakdown.</p>`);

  const workoutContainer = document.createElement('div');
  workoutContainer.id = 'workout-exercise-list';
  container.appendChild(workoutContainer);

  const sel = document.getElementById('workout-select');
  sel.addEventListener('change', () => {
    if (sel.value) setPlanned(dayS, sel.value);
    show(sel.value);
  });

  function show(name) {
    renderWorkout(name);
    if (name) { renderStrip(name); renderFinish(name); initFocus(); }
  }

  // ── Exercise strip + focus mode ──
  // A "unit" is one exercise, or a superset pair (opened and closed together).
  let units = [];
  let completers = [];   // per set: tick it, filling empty boxes from target or last time
  let pendingAdvance = null;   // unit index waiting for the rest timer before moving on
  let stripEl = null;
  const setsDone = ex => { const logs = Store.get().setLogs; let n = 0; for (let i = 0; i < (ex.sets || 1); i++) if ((logs[`${dayS}_${ex.id}_${i}`] || {}).done) n++; return n; };
  const exComplete = ex => setsDone(ex) >= (ex.sets || 1);
  const unitComplete = u => u.every(exComplete);
  const cardOf = ex => document.getElementById('ex-' + ex.id);
  const setUnitOpen = (u, open) => u.forEach(ex => { const c = cardOf(ex); if (c) c.classList.toggle('collapsed', !open); });
  const firstIncomplete = (after = -1) => { for (let i = after + 1; i < units.length; i++) if (!unitComplete(units[i])) return i; for (let i = 0; i <= after && i < units.length; i++) if (!unitComplete(units[i])) return i; return -1; };

  function renderStrip(name) {
    const plan = PLAN.workouts[name];
    if (!plan || plan.dbComplex || !units.length) return;
    stripEl = document.createElement('div');
    stripEl.className = 'card ex-strip';
    workoutContainer.prepend(stripEl);
    refreshStrip();
  }
  function refreshStrip() {
    if (!stripEl) return;
    // Blue = the exercise you're on: the open, unfinished one; otherwise the first unfinished
    const openIdx = units.findIndex(u => !unitComplete(u) && cardOf(u[0]) && !cardOf(u[0]).classList.contains('collapsed'));
    const next = openIdx >= 0 ? openIdx : firstIncomplete();
    stripEl.innerHTML = `<div class="xs-row">
      ${units.map((u, ui) => `<div class="xs-group ${u.length > 1 ? 'ss' : ''}">${u.map(ex => {
        const n = setsDone(ex), of = ex.sets || 1;
        const st = n >= of ? 'done' : n ? 'some' : ui === next ? 'next' : '';
        const [letter, ...rest] = ex.label.split(' ');
        return `<button class="xs-tile ${st}${ui === next && n < of ? ' cur' : ''}" data-unit="${ui}" aria-label="${ex.label}: ${n} of ${of} sets">
          <b>${letter}${n >= of ? ' ✓' : ''}</b><span>${rest.join(' ')}</span><em>${n}/${of}</em></button>`;
      }).join('')}</div>`).join('')}
    </div>`;
    // Keep the current exercise's square in view (the strip scrolls sideways)
    const cur = stripEl.querySelector(`.xs-tile[data-unit="${next}"]`);
    const row = stripEl.querySelector('.xs-row');
    if (cur) row.scrollLeft = Math.max(0, cur.offsetLeft - row.offsetLeft - 70);
    stripEl.querySelectorAll('[data-unit]').forEach(b => b.onclick = () => focusUnit(+b.dataset.unit, true));
    // Header progress on each exercise card
    units.flat().forEach(ex => {
      const c = cardOf(ex); if (!c) return;
      const n = setsDone(ex), of = ex.sets || 1;
      const p = c.querySelector('.ex-prog');
      p.textContent = n >= of ? `${of}/${of} ✓` : `${n}/${of}`;
      p.className = 'ex-prog' + (n >= of ? ' done' : n ? ' some' : '');
    });
  }
  function focusUnit(i, scroll) {
    units.forEach((u, ui) => setUnitOpen(u, ui === i));
    refreshStrip();
    if (scroll && units[i]) {
      const c = cardOf(units[i][0]);
      (c.closest('.card') || c).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  function initFocus() {
    if (!units.length) return;
    pendingAdvance = null;
    const i = firstIncomplete();
    units.forEach((u, ui) => setUnitOpen(u, ui === i));
    refreshStrip();
  }
  // Called after a set is ticked/unticked/cleared
  function onSetChange(ex) {
    refreshStrip();
    const ui = units.findIndex(u => u.includes(ex));
    if (ui < 0 || !unitComplete(units[ui]) || cardOf(ex).classList.contains('collapsed')) return;
    const st = App.timer.state;
    if (st && !st.doneAt && !st.paused) pendingAdvance = ui;          // wait for the rest to end
    else setTimeout(() => advanceFrom(ui), 700);                       // no rest: move on after a beat
  }
  function advanceFrom(ui) {
    if (!stripEl || !document.body.contains(stripEl)) return;
    const next = firstIncomplete(ui);
    setUnitOpen(units[ui], false);
    if (next >= 0) focusUnit(next, true);
    refreshStrip();
  }
  // The rest timer ending (Go) or being skipped moves focus on
  App._onTimerChange = st => {
    if (pendingAdvance === null || (st && !st.doneAt)) return;
    const ui = pendingAdvance; pendingAdvance = null;
    advanceFrom(ui);
  };

  // Small "Mark all done" at the top of the workout (same as Finish workout at the bottom)
  // How many ticked sets on screen are missing a number (for the finish toast)
  function missingSets() {
    return new Set([...workoutContainer.querySelectorAll('.set-input.missing')].map(i => i.closest('.set-row'))).size;
  }
  const finishToast = name => {
    const n = missingSets();
    App.toast(n ? `${name} completed · ${n} set${n > 1 ? 's are' : ' is'} missing numbers (red boxes)` : name + ' completed', n ? 4000 : 2000);
  };

  function doFinish(name) {
    finishToast(name);
    setCompleted(dayS, name);
    App.timer.stop();
    App.viewDate = isPast ? dayS : null;
    App.navigate('today');
  }

  function renderFinish(name) {
    const done = completedWorkout(dayS) === name;
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = done
      ? `<div class="row" style="gap:10px"><span class="done-pill"><svg class="icon" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
           <div><div style="font-weight:700">${name} completed</div><div class="text-sm text-muted">Logged for ${isPast ? dayLabel : 'today'}</div></div></div>
         <button class="link-btn mt8" id="undo-finish-btn">Not done? Undo</button>`
      : `<button class="btn btn-primary btn-full" id="finish-btn">Finish workout</button>
         <div class="text-sm text-muted mt8">Marks ${name} completed for ${isPast ? dayLabel : 'today'}.</div>`;
    workoutContainer.appendChild(card);
    const fin = card.querySelector('#finish-btn');
    if (fin) fin.onclick = () => {
      // Anything left? Ask first (in-app pop-up); otherwise finish straight away
      const left = units.flat().filter(ex => !exComplete(ex));
      const setsLeft = left.reduce((n, ex) => n + (ex.sets || 1) - setsDone(ex), 0);
      const missing = missingSets();
      if (!left.length && !missing) return doFinish(name);
      const letters = left.map(ex => ex.label.split(' ')[0]);
      const list = letters.length > 1 ? letters.slice(0, -1).join(', ') + ' and ' + letters.slice(-1) : letters[0];
      App.showModal(`<h2>Not everything is done</h2>
        <div class="text-sm mt8">${left.length ? `<strong>${list}</strong> ${left.length > 1 ? "aren't" : "isn't"} finished (${setsLeft} set${setsLeft > 1 ? 's' : ''} left).` : ''}
          ${missing ? `${left.length ? '<br>' : ''}${missing} ticked set${missing > 1 ? 's are' : ' is'} missing numbers.` : ''}</div>
        <button class="btn btn-secondary btn-full mt12" id="fin-keep">Keep going</button>
        <button class="btn btn-secondary btn-full mt8" id="fin-asis">Finish as is${left.length ? ' (partial)' : ''}</button>
        ${left.length ? `<button class="btn btn-primary btn-full mt8" id="fin-all">Mark everything done</button>
          <div class="text-sm text-muted mt8">Ticks the remaining sets and fills empty ones from your targets or last time.</div>` : ''}`);
      document.getElementById('fin-keep').onclick = () => App.closeModal();
      document.getElementById('fin-asis').onclick = () => { App.closeModal(); doFinish(name); };
      const all = document.getElementById('fin-all');
      if (all) all.onclick = () => { completers.forEach(c => c()); App.closeModal(); doFinish(name); };
    };

    const undo = card.querySelector('#undo-finish-btn');
    if (undo) undo.onclick = () => { setCompleted(dayS, null); show(name); };
  }

  function renderWorkout(name) {
    workoutContainer.innerHTML = '';
    units = [];
    completers = [];
    if (!name) return;
    const plan = PLAN.workouts[name];
    if (!plan) return;

    if (plan.dbComplex) {
      renderDBComplex(plan);
      return;
    }

    // Warmup card
    if (plan.warmup && !isPast) { // no warm-up when logging a past day
      const wuCard = document.createElement('div');
      wuCard.className = 'card warmup-card';
      const moves = PLAN.warmups[plan.warmup];
      const open = !Store.get().settings.warmupCollapsed;
      wuCard.innerHTML = `<button class="section-toggle" aria-expanded="${open}">
          <span class="card-title" style="margin:0">Warm-Up <span style="text-transform:none;letter-spacing:0">· ${open ? 'tap any for how-to' : `${moves.length} movements`}</span></span>
          <svg class="icon chevron" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        ${open ? `<div class="mt8">${moves.map((w, i) => {
          const info = PLAN.warmupInfo[w];
          return `<button class="warmup-item" data-wu="${i}">
            <span><span class="wu-name">${w.split(' — ')[0]}</span>
              ${info ? `<span class="text-sm text-muted" style="display:block">${info.dose}</span>` : ''}</span>
            <svg class="icon" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
          </button>`;
        }).join('')}
        <div class="mt8 text-sm text-muted">${PLAN.warmups.liftingNote}</div></div>` : ''}`;
      wuCard.querySelectorAll('[data-wu]').forEach(b => b.onclick = () => showWarmup(moves[b.dataset.wu]));
      wuCard.querySelector('.section-toggle').onclick = () => {
        Store.set(d => d.settings.warmupCollapsed = open);
        show(name);
      };
      workoutContainer.appendChild(wuCard);
    }

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

    units = groups.map(g => g.type === 'superset' ? g.group : [g.ex]);
    stripEl = null;
    groups.forEach(g => {
      if (g.type === 'superset') {
        const ssCard = document.createElement('div');
        ssCard.className = 'card';
        ssCard.innerHTML = `<div class="card-title">Superset ${g.group[0].supersetGroup}</div>`;
        g.group.forEach((ex, gi) => ssCard.appendChild(buildExerciseEl(ex, gi < g.group.length - 1 ? g.group[gi + 1] : null)));
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

  function showWarmup(name) {
    const info = PLAN.warmupInfo[name];
    const title = name.split(' — ')[0];
    if (!info) return;
    const search = encodeURIComponent(title.replace(/\(.*?\)/g, '') + ' warm up exercise');
    const img = PLAN.warmupImages[name];
    App.showModal(`<h2>${title}</h2>
      <div class="text-sm text-muted" style="margin:4px 0 12px">${info.why}</div>
      ${img ? `<figure class="wu-figure">
          <img src="./images/warmups/${img}" alt="${title}: start and end position" onerror="this.closest('figure').remove()">
          <figcaption><span>Start</span><span>End</span></figcaption>
        </figure>` : ''}
      <div class="badge badge-green">${info.dose}</div>
      <ol class="wu-steps">${info.steps.map(s => `<li>${s}</li>`).join('')}</ol>
      <div class="card" style="margin-bottom:0"><div class="card-title" style="margin-bottom:4px">Key cue</div><div class="text-sm">${info.cue}</div></div>
      <a class="btn btn-secondary btn-full mt12" href="https://www.youtube.com/results?search_query=${search}" target="_blank" rel="noopener">Watch a demo (YouTube)</a>`);
  }

  function showTempo(ex) {
    const [down, pause, up] = ex.tempo.split('-').map(Number);
    const secs = n => n === 1 ? '1 second' : `${n} seconds`;
    const perRep = down + pause + up;
    const dur = t => t < 90 ? `${t} seconds` : `${Math.floor(t / 60)} min ${t % 60} s`;
    const reps = (repTargets(ex) || [])[0];
    const phase = (n, name, what) => `
      <div class="tempo-phase">
        <div class="tempo-num">${n}</div>
        <div><div style="font-weight:700">${name}</div><div class="text-sm text-muted">${what}</div></div>
      </div>`;
    App.showModal(`<h2>Tempo ${ex.tempo}</h2>
      <div class="text-sm text-muted" style="margin:4px 0 12px">${ex.label.replace(/^[A-Z]\d?\s+/, '')}</div>
      ${phase(down, 'Lower', `${secs(down)} on the way down (the stretch). Control it; don't drop.`)}
      ${phase(pause, 'Pause at the bottom', pause ? `Hold ${secs(pause)} in the stretched position.` : 'No pause. Turn around smoothly without bouncing.')}
      ${phase(up, 'Lift', `${secs(up)} on the way up. Drive it hard with good form.`)}
      <div class="card mt12" style="margin-bottom:0">
        <div class="text-sm">One rep takes about <strong>${perRep} seconds</strong>${reps ? `, so a set of ${reps} is about <strong>${dur(perRep * reps)}</strong> under tension` : ''}.</div>
      </div>
      <p class="text-sm text-muted mt12">Tempo is always three numbers: lower, pause at the bottom, lift.</p>`);
  }

  // nextInSuperset: the exercise you go to straight after this one (no rest), or null
  function buildExerciseEl(ex, nextInSuperset) {
    const wrap = document.createElement('div');
    wrap.className = 'exercise-card';

    const pr = getPR(ex.id);
    const last = lastSession(ex.id, dayS);
    const numSets = ex.sets || 1;
    const lastDate = last ? parseDate(last.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : null;
    const target = targetFor(ex, last);
    const workSec = App.parseWorkSeconds(ex.reps);
    // Which numbers a ticked set needs: timed holds need none; bodyweight moves need reps only
    const needReps = !workSec;
    const needWeight = !workSec && !/push ups|hyperextension/i.test(ex.label);
    const restSec = App.parseRestSeconds(ex.rest);
    // Supersets with 0 rest go straight to the next exercise; grouped items with real rest (Rack Pulls phase 1) keep it
    if (restSec > 0) nextInSuperset = null;
    const anchor = `ex:${ex.id}`;

    wrap.innerHTML = `
      <div class="row-between">
        <div class="exercise-name">${ex.label}</div>
        ${pr ? `<span class="pr-badge">PR ${pr}</span>` : ''}
      </div>
      <div class="exercise-meta">
        ${ex.sets}×${ex.reps}
        ${ex.tempo ? ` · <button class="tempo-chip" aria-label="Explain tempo ${ex.tempo}">${ex.tempo}</button>` : ''}
        ${nextInSuperset ? ` · then straight to ${nextInSuperset.label.split(' ')[0]}`
          : ex.rest && ex.rest !== 'none' ? ` · rest ${ex.rest}` : ''}
        ${workSec ? ` <button class="work-btn" aria-label="Start ${workSec} second timer">▶ ${App.fmtClock(workSec)}</button>` : ''}
      </div>
      ${ex.note ? `<div class="text-sm text-muted" style="margin-bottom:8px">${ex.note}</div>` : ''}
      ${target ? `<button class="target-line" aria-label="Fill sets with target">
          <span><span class="target-tag">Target</span> ${target.text}</span>
          <span class="target-fill">Tap to fill sets</span>
        </button>` : ''}
      ${lastDate ? `<div class="text-sm text-muted">Last session: ${lastDate} · tap a "Last" value to copy it</div>` : ''}
      <div class="set-grid set-head">
        <span>Set</span><span>Last</span><span>This week</span><button class="clear-sets" aria-label="Clear this exercise's entries">Clear</button>
      </div>
      <div class="set-rows" id="sets-${ex.id}"></div>
    `;
    // One timer slot per exercise; it moves to sit under whichever set started it
    const slot = document.createElement('div');
    slot.className = 'timer-slot';
    slot.dataset.timerAnchor = anchor;
    const rowsList = [];
    const placeSlot = idx => {
      const after = idx == null ? wrap.querySelector('.set-head') : rowsList[idx];
      after.after(slot);
    };
    const wb = wrap.querySelector('.work-btn');
    if (wb) wb.onclick = () => {
      placeSlot(null);
      App.timer.start({ seconds: workSec, kind: 'work', label: ex.label.replace(/^[A-Z]\d?\s+/, ''), anchor, rowIdx: null });
    };

    // Collapsible: header (name, PR, sets done, chevron) + body
    wrap.id = 'ex-' + ex.id;
    const head = wrap.firstElementChild;
    head.classList.add('ex-head');
    head.insertAdjacentHTML('beforeend', `<span class="ex-prog"></span><svg class="icon chevron" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>`);
    const body = document.createElement('div');
    body.className = 'ex-body';
    while (head.nextSibling) body.appendChild(head.nextSibling);
    wrap.appendChild(body);
    head.onclick = () => { wrap.classList.toggle('collapsed'); refreshStrip(); };

    const tempoBtn = wrap.querySelector('.tempo-chip');
    if (tempoBtn) tempoBtn.onclick = () => showTempo(ex);

    const setRows = wrap.querySelector(`#sets-${ex.id}`);
    const fillers = [];
    const clearers = [];
    wrap.querySelector('.clear-sets').onclick = () => { clearers.forEach(c => c()); onSetChange(ex); };
    const tBtn = wrap.querySelector('.target-line');
    if (tBtn) tBtn.onclick = () => {
      const filled = fillers.filter(f => f()).length;
      App.toast(filled ? `Filled ${filled} set${filled > 1 ? 's' : ''}. Tick ✓ when done, or edit first` : 'All sets already ticked');
    };
    for (let s = 0; s < numSets; s++) {
      const key = `${dayS}_${ex.id}_${s}`;
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
      // Red outline on an empty box once the set is ticked
      const flag = () => {
        const done = doneBtn.classList.contains('done');
        wInput.classList.toggle('missing', done && needWeight && !wInput.value.trim());
        rInput.classList.toggle('missing', done && needReps && !rInput.value.trim());
      };
      wInput.addEventListener('input', flag);
      rInput.addEventListener('input', flag);
      const copy = row.querySelector('button.last-cell');
      if (copy) copy.onclick = () => { wInput.value = prev.weight || ''; rInput.value = prev.reps || ''; saveSet(); };
      // Target fills only sets not yet ticked; returns whether it filled this one
      clearers.push(() => {
        wInput.value = ''; rInput.value = '';
        doneBtn.classList.remove('done'); row.classList.remove('is-done');
        Store.set(d => { delete d.setLogs[key]; });
        flag();
      });
      completers.push(() => {
        // Fill only the numbers this exercise needs (no weight for bodyweight, nothing for timed holds)
        const t = target && target.sets[s];
        if (needWeight && !wInput.value.trim()) wInput.value = (t && t.weight) || (prev && prev.weight) || '';
        if (needReps && !rInput.value.trim()) rInput.value = (t && t.reps) || (prev && prev.reps) || '';
        doneBtn.classList.add('done'); row.classList.add('is-done');
        saveSet();
      });
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
        flag();
      }
      wInput.addEventListener('change', saveSet);
      rInput.addEventListener('change', saveSet);
      doneBtn.addEventListener('click', () => {
        const nowDone = !doneBtn.classList.contains('done');
        doneBtn.classList.toggle('done', nowDone);
        row.classList.toggle('is-done', nowDone);
        saveSet();
        if (!nowDone || isPast) { onSetChange(ex); return; }
        if (nextInSuperset) { App.toast(`Now ${nextInSuperset.label}, no rest`); onSetChange(ex); return; }
        if (restSec > 0) {
          placeSlot(s);
          const nextSet = s + 1 < numSets ? `set ${s + 2}` : 'next exercise';
          App.timer.start({ seconds: restSec, kind: 'rest', label: `${ex.label.replace(/^[A-Z]\d?\s+/, '')} · ${nextSet}`, anchor, rowIdx: s, range: /\d+\s*-\s*\d+/.test(ex.rest) ? ex.rest : null });
        }
        onSetChange(ex);
      });
      rowsList.push(row);
      setRows.appendChild(row);
      flag();
    }
    // Re-attach a running timer after the screen re-renders
    const st = App.timer.state;
    if (st && st.anchor === anchor) placeSlot(st.rowIdx);
    renderInlineTimer(App.timer.state);
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
    const slot = document.createElement('div');
    slot.className = 'timer-slot';
    slot.dataset.timerAnchor = 'dbc';
    card.querySelector('.progress-bar').after(slot);
    card.querySelector('#dc-timer').remove();

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
      const btn = card.querySelector('#dc-next-btn');
      btn.disabled = true;
      btn.textContent = `Resting before round ${currentRound + 1}…`;
      App.timer.start({ seconds: roundRestSec, kind: 'rest', label: `DB Complex · round ${currentRound + 1}`, anchor: 'dbc', onDone: () => {
        btn.disabled = false;
        btn.textContent = `Start Round ${currentRound + 1}`;
      } });
    });
  }

  // First render last, once everything above is defined
  if (todayWorkout && PLAN.workouts[todayWorkout]) show(todayWorkout);
};

// Draws the running timer inside its exercise (or DB Complex) card. One listener for the app.
function renderInlineTimer(st) {
  document.querySelectorAll('.timer-slot').forEach(slot => {
    if (!st || slot.dataset.timerAnchor !== st.anchor) {
      // Clear fully, including the drawn-shape marker, so the next timer here redraws
      slot.innerHTML = ''; slot.className = 'timer-slot'; delete slot.dataset.shape;
      return;
    }
    const rem = App.timer.remaining();
    // Bar uses exact time left (not whole seconds) so it drains smoothly
    const pct = st.doneAt ? 0 : Math.max(0, Math.min(100, App.timer.msLeft() / (st.total * 1000) * 100));
    slot.className = 'timer-slot active' + (st.doneAt ? ' go' : '') + (st.kind === 'work' ? ' work' : '') + (!st.doneAt && !st.paused && rem <= 5 ? ' soon' : '') + (st.paused ? ' paused' : '');
    const big = st.doneAt ? (st.kind === 'work' ? 'Time!' : 'Go!') : App.fmtClock(rem);
    const sub = st.doneAt ? (st.kind === 'work' ? 'Done' : `Start ${st.label.split(' · ')[1] || 'next round'}`)
      : st.paused ? 'Paused'
      : st.kind === 'work' ? 'Working'
      : rem <= 5 ? 'Get ready…'
      : restTip(st);
    // Only rebuild buttons when the state shape changes, so taps aren't lost mid-tick
    const shape = `${st.kind}|${!!st.doneAt}|${!!st.paused}`;
    if (slot.dataset.shape !== shape) {
      slot.dataset.shape = shape;
      slot.innerHTML = `<div class="ti-row">
          <div class="ti-clock"><div class="ti-time"></div>${st.range && !st.doneAt ? `<div class="ti-range">plan ${st.range}</div>` : ''}</div>
          <div class="ti-sub text-sm"><span class="ti-tip"></span></div>
          ${st.doneAt ? '<button class="tp-btn" data-t="stop">OK</button>' : `<button class="tp-btn" data-t="add">+15</button>
          <button class="tp-btn tp-pause" data-t="pause">${st.paused ? 'Resume' : 'Pause'}</button>
          <button class="tp-btn tp-x" data-t="stop" aria-label="Skip rest">✕</button>`}
        </div>
        <div class="ti-bar"><div class="ti-fill"></div></div>`;
      const add = slot.querySelector('[data-t="add"]');
      if (add) add.onclick = () => App.timer.add(15);
      const pz = slot.querySelector('[data-t="pause"]');
      if (pz) pz.onclick = () => App.timer.state && (App.timer.state.paused ? App.timer.resume() : App.timer.pause());
      slot.querySelector('[data-t="stop"]').onclick = () => App.timer.stop();
    }
    slot.querySelector('.ti-time').textContent = big;
    // Animate in only when the message changes
    const tip = slot.querySelector('.ti-tip');
    if (tip.textContent !== sub) {
      tip.textContent = sub;
      tip.classList.remove('in'); void tip.offsetWidth; tip.classList.add('in');
    }
    slot.querySelector('.ti-fill').style.width = pct + '%';
  });
}
if (!App._inlineTimerSub) App._inlineTimerSub = App.timer.on(st => { renderInlineTimer(st); if (App._onTimerChange) App._onTimerChange(st); });

// Rest-row banner: rotates every 5 s. Starts with what's next, then tips; one tip mentions today's water.
function restTip(st) {
  const elapsed = Math.floor((Date.now() - (st.endAt - st.total * 1000)) / 1000);
  const next = st.label && st.label.split(' · ')[1];
  const cups = (Store.get().waterLogs || {})[todayStr()] || 0;
  const goal = Store.get().settings.waterGoalCups || 16;
  const msgs = [];
  if (next) msgs.push(`Up next: ${next}`);
  PLAN.restTips.forEach(t => msgs.push(t === 'Take a sip of water' ? `Sip some water · ${cups} of ${goal} cups today` : t));
  if (!st.tipStart) st.tipStart = Math.floor(Math.random() * PLAN.restTips.length); // vary tips between rests
  const i = Math.floor(elapsed / 5);
  if (i === 0 || !next) return msgs[next ? 0 : (st.tipStart + i) % msgs.length];
  return msgs[1 + (st.tipStart + i - 1) % (msgs.length - 1)];
}
