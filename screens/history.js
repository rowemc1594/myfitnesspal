'use strict';
App.screens.history = function(container) {
  const data = Store.get();

  // ── This week: workouts and macros ──
  renderThisWeek();

  // Bodyweight
  const bwCard = document.createElement('div');
  bwCard.className = 'card';
  container.appendChild(bwCard);
  App.renderBodyweight(bwCard);

  // Weeks
  const dates = Object.keys(data.workoutLogs).sort();
  const thisMon = fmtDate(mondayOfWeek(new Date()));
  const weeks = new Set(dates.map(d => fmtDate(mondayOfWeek(parseDate(d)))));
  weeks.add(thisMon);
  [...weeks].sort().reverse().forEach(monS => {
    const mon = parseDate(monS);
    const card = document.createElement('div');
    card.className = 'card';
    const count = completedCountThisWeek(mon);
    card.innerHTML = `<div class="row-between"><div class="card-title" style="margin:0">Week of ${monS}${monS===thisMon?' (current)':''}</div>
      <span class="badge ${count>=5?'badge-green':'badge-red'}">${count}/5</span></div>`;
    weekDays(mon).forEach((d, i) => {
      const ds = fmtDate(d);
      const w = completedWorkout(ds);
      const row = document.createElement('div');
      row.className = 'row-between checklist-item';
      row.innerHTML = `<span class="text-sm">${DOW[i]} ${d.getDate()}</span><span class="text-sm ${w ? 'text-green' : 'text-muted'}">${w ? '✓ ' + w : '—'}</span>`;
      row.onclick = () => editDay(ds);
      card.appendChild(row);
    });
    container.appendChild(card);
  });

  // Backup (at the bottom: rarely needed)
  renderBackup();
  function renderBackup() {
    // Backup card
    const bk = document.createElement('div');
    bk.className = 'card';
    const last = data.lastBackup;
    const daysSince = last ? Math.floor((parseDate(todayStr()) - parseDate(last)) / 86400000) : null;
    const stale = daysSince === null || daysSince >= 14;
    bk.innerHTML = `<div class="card-title">Backup</div>
      <div class="text-sm">Last backup: <strong>${last || 'Never'}</strong></div>
      ${stale ? `<div class="text-sm mt8" style="color:var(--accent2)">It's been a while — consider exporting a backup.</div>` : ''}
      <div class="row mt12">
        <button class="btn btn-primary btn-sm" id="export-btn">Export</button>
        <button class="btn btn-secondary btn-sm" id="import-btn">Import</button>
        <input type="file" id="import-file" accept="application/json,.json" hidden>
      </div>`;
    container.appendChild(bk);

    bk.querySelector('#export-btn').onclick = () => {
      const json = Store.exportJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `tracker-backup-${todayStr()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      App.navigate('history');
    };
    const fileIn = bk.querySelector('#import-file');
    bk.querySelector('#import-btn').onclick = () => fileIn.click();
    fileIn.onchange = async () => {
      const f = fileIn.files[0];
      if (!f) return;
      // No confirm: current data is saved to the restore slot first
      try {
        Store.importJSON(await f.text());
        App.toast('Backup imported');
        App.navigate('history');
      } catch (e) { alert('Import failed: ' + e.message); }
    };
  }

  function renderThisWeek() {
    const mon = mondayOfWeek(new Date());
    const days = weekDays(mon).map(fmtDate);
    const todayS = todayStr();
    const todayIdx = days.indexOf(todayS);
    const wp = weekPlan(mon);
    const doneN = completedCountThisWeek(mon);
    const skippedDays = Store.get().skippedDays || {};
    const doneSet = new Set(days.map(completedWorkout).filter(Boolean));

    // Weekly macros: eaten so far vs the whole week's plan, with an "on pace" marker for today
    const eaten = [0, 0, 0], goal = [0, 0, 0], pace = [0, 0, 0];
    days.forEach((ds, i) => {
      const m = App.dayMacros(ds);
      for (let k = 0; k < 3; k++) {
        eaten[k] += m.eaten[k]; goal[k] += m.goal[k];
        if (i <= todayIdx) pace[k] += m.goal[k];
      }
    });
    const fmt = n => n.toLocaleString();

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div class="card-title">This week</div>
      <div class="row-between"><span style="font-weight:700">Workouts</span><span class="text-sm"><strong>${doneN}</strong> of 5 done</span></div>
      <div class="wk-days mt8">${days.map((ds, i) => {
        const w = completedWorkout(ds), planned = wp.plan[i];
        const past = i < todayIdx;
        const state = w ? 'done' : past && skippedDays[ds] ? 'skipped'
          : past && planned !== 'Rest' && !doneSet.has(planned) ? 'missed' : i === todayIdx ? 'today' : '';
        const label = w ? PLAN.shortNames[w] : state === 'skipped' ? 'Skip' : state === 'missed' ? 'Missed' : PLAN.shortNames[planned];
        return `<div class="wk-day ${state}"><span>${DOW[i]}</span><strong>${label}</strong></div>`;
      }).join('')}</div>
      <div class="progress-bar mt8"><div class="progress-fill" style="width:${doneN / 5 * 100}%"></div></div>

      <div class="row-between mt16"><span style="font-weight:700">Macros</span><span class="text-sm text-muted">eaten / week's plan</span></div>
      ${[['Calories', ''], ['Protein', 'g'], ['Fat', 'g']].map(([name, u], k) => `
        <div class="wk-macro">
          <div class="row-between text-sm"><span>${name}</span>
            <span><strong>${fmt(eaten[k])}</strong><span class="text-muted"> / ${fmt(goal[k])}${u}</span></span></div>
          <div class="wk-bar"><div class="progress-fill" style="width:${Math.min(100, goal[k] ? eaten[k] / goal[k] * 100 : 0)}%"></div>
            ${todayIdx >= 0 ? `<div class="wk-pace" style="left:${Math.min(100, pace[k] / goal[k] * 100)}%"></div>` : ''}</div>
          <div class="text-sm text-muted">Plan through today: ${fmt(pace[k])}${u || ' cal'} · ${eaten[k] >= pace[k] ? '<span class="text-green">on track</span>' : `${fmt(pace[k] - eaten[k])}${u || ' cal'} left`}</div>
        </div>`).join('')}
      <div class="text-sm text-muted mt8">Plan totals add up each day's meals (training or rest-day menu). Estimates.</div>`;
    container.appendChild(card);
  }

  function editDay(ds) {
    const cur = completedWorkout(ds);
    App.showModal(`<h2>${ds}</h2>
      <p class="text-sm text-muted" style="margin:4px 0 12px">Which workout did you complete this day?</p>
      ${workoutOptionsHTML(cur)}
      ${cur ? '<button class="btn btn-secondary btn-full mt12" id="del-day">Not completed — remove</button>' : ''}`);
    const mc = document.getElementById('modal-content');
    mc.querySelectorAll('[data-wo]').forEach(el => el.onclick = () => {
      const w = el.dataset.wo;
      if (w === 'Rest') { setCompleted(ds, null); setPlanned(ds, 'Rest'); } else setCompleted(ds, w);
      App.closeModal(); App.navigate('history');
    });
    const del = document.getElementById('del-day');
    if (del) del.onclick = () => {
      setCompleted(ds, null);
      App.closeModal(); App.navigate('history');
    };
  }
};
