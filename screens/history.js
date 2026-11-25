'use strict';
App.screens.history = function(container) {
  const data = Store.get();

  // ── Long view: consistency, weekly macros, strength (this week lives on Today) ──
  const WEEKS = 8;
  const todayS = todayStr();
  const thisMon = mondayOfWeek(new Date());
  // Weeks shown: up to the last 8, starting from the first week that has any data
  const allDates = [...Object.keys(data.workoutLogs), ...Object.keys(data.mealLogs), ...Object.keys(data.setLogs).map(k => k.split('_')[0])].sort();
  const firstMon = allDates.length ? mondayOfWeek(parseDate(allDates[0])) : thisMon;
  const weeks = [];
  for (let i = 0; i < WEEKS; i++) {
    const m = new Date(thisMon.getTime() - i * 7 * 86400000);
    if (m < firstMon) break;
    weeks.push(m);
  }
  renderConsistency();
  renderWeeklyMacros();
  renderStrength();

  // Bodyweight
  const bwCard = document.createElement('div');
  bwCard.className = 'card';
  container.appendChild(bwCard);
  App.renderBodyweight(bwCard);

  // Text size
  const ts = document.createElement('div');
  ts.className = 'card';
  const cur = (data.settings || {}).textScale || 1.15;
  ts.innerHTML = `<div class="row-between"><span class="card-title" style="margin:0">Text size</span>
    <span class="seg">${App.TEXT_SIZES.map(([n, z]) => `<button data-z="${z}" class="${z === cur ? 'on' : ''}">${n}</button>`).join('')}</span></div>`;
  ts.querySelectorAll('[data-z]').forEach(b => b.onclick = () => {
    Store.set(d => d.settings.textScale = +b.dataset.z);
    App.applyTextSize(); App.navigate('history');
  });
  container.appendChild(ts);

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

  // Day state for the grid: done | partial | missed | skipped | rest | upcoming
  function dayState(ds, i, wp, doneSet) {
    const w = completedWorkout(ds);
    if (w && w !== 'Rest') { const st = workoutExerciseStats(ds, w); return st.done < st.total ? 'partial' : 'done'; }
    if (ds >= todayS) return 'upcoming';
    if ((data.skippedDays || {})[ds]) return 'skipped';
    const planned = wp.plan[i];
    return planned !== 'Rest' && !doneSet.has(planned) ? 'missed' : 'rest';
  }

  function renderConsistency() {
    const card = document.createElement('div');
    card.className = 'card';
    let doneN = 0, target = 0, exDone = 0, exTotal = 0;
    const rows = weeks.map(mon => {
      const days = weekDays(mon).map(fmtDate);
      const wp = weekPlan(mon);
      const doneSet = new Set(days.map(completedWorkout).filter(Boolean));
      const states = days.map((ds, i) => dayState(ds, i, wp, doneSet));
      let n = 0;
      days.forEach((ds, i) => {
        const w = completedWorkout(ds);
        if (w && w !== 'Rest') { n++; const st = workoutExerciseStats(ds, w); exDone += st.done; exTotal += st.total; }
        if (wp.plan[i] !== 'Rest' && (ds < todayS || completedWorkout(ds))) target++;
      });
      doneN += n;
      return { mon, states, n };
    });
    // Full weeks in a row (finished weeks only, newest first)
    let streak = 0;
    for (const r of rows) { if (fmtDate(r.mon) === fmtDate(thisMon)) continue; if (r.n >= 5) streak++; else break; }
    const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
    const md = d => `${d.getMonth() + 1}/${d.getDate()}`;
    card.innerHTML = `<div class="card-title">Consistency</div>
      ${rows.length && doneN ? `<div class="stat-row">
          <div><strong>${doneN}<span>/${target}</span></strong><em>workouts (${pct(doneN, target)}%)</em></div>
          <div><strong>${pct(exDone, exTotal)}%</strong><em>exercises finished</em></div>
          <div><strong>${streak}</strong><em>full week${streak === 1 ? '' : 's'} in a row</em></div>
        </div>` : '<div class="text-sm text-muted">Log a few workouts to see your consistency over time.</div>'}
      <div class="cg">
        <div class="cg-row cg-head"><span></span>${DOW.map(d => `<span>${d[0]}</span>`).join('')}<span></span></div>
        ${rows.map(r => `<div class="cg-row"><span class="cg-wk">${md(r.mon)}</span>
          ${r.states.map(st => `<span class="cg-cell ${st}"></span>`).join('')}
          <span class="cg-n">${r.n}/5</span></div>`).join('')}
      </div>
      <div class="cg-key text-sm text-muted">
        <span><i class="cg-cell done"></i>done</span><span><i class="cg-cell partial"></i>partial</span>
        <span><i class="cg-cell missed"></i>missed</span><span><i class="cg-cell skipped"></i>skipped</span><span><i class="cg-cell rest"></i>rest</span>
      </div>`;
    container.appendChild(card);
  }

  function renderWeeklyMacros() {
    const card = document.createElement('div');
    card.className = 'card';
    const METRICS = [['Protein', 1, 'g'], ['Calories', 0, ''], ['Fat', 2, 'g']];
    let metric = 0;
    // Per week: averages per LOGGED day (unlogged days would drag averages down)
    const stats = weeks.slice().reverse().map(mon => {
      const days = weekDays(mon).map(fmtDate).filter(ds => ds <= todayS);
      const logged = days.filter(ds => {
        const ml = data.mealLogs[ds] || {};
        return Object.values(ml).some(t => Object.values(t).some(Boolean)) || ((data.extraFoods || {})[ds] || []).length;
      });
      const eaten = [0, 0, 0], goal = [0, 0, 0];
      logged.forEach(ds => { const m = App.dayMacros(ds); for (let k = 0; k < 3; k++) { eaten[k] += m.eaten[k]; goal[k] += m.goal[k]; } });
      const n = logged.length || 1;
      return { mon, days: days.length, logged: logged.length, avg: eaten.map(v => Math.round(v / n)), goal: goal.map(v => Math.round(v / n)) };
    });
    const draw = () => {
      const [name, k, u] = METRICS[metric];
      const max = Math.max(1, ...stats.map(s => Math.max(s.avg[k], s.goal[k]))) * 1.1;
      const withData = stats.filter(s => s.logged);
      const overall = withData.length ? Math.round(withData.reduce((a, s) => a + s.avg[k] / (s.goal[k] || 1), 0) / withData.length * 100) : 0;
      card.innerHTML = `<div class="row-between"><span class="card-title" style="margin:0">Macros by week</span>
          <span class="seg">${METRICS.map((m, i) => `<button data-m="${i}" class="${i === metric ? 'on' : ''}">${m[0]}</button>`).join('')}</span></div>
        <div class="text-sm text-muted mt8">Average per logged day vs plan${withData.length ? ` · overall <strong style="color:var(--text)">${overall}%</strong> of plan` : ''}</div>
        <div class="mb">${stats.map(s => `<div class="mb-col">
            <div class="mb-val">${s.logged ? s.avg[k].toLocaleString() : ''}</div>
            <div class="mb-track">
              ${s.logged ? `<div class="mb-bar ${s.avg[k] >= s.goal[k] * 0.9 ? 'ok' : ''}" style="height:${s.avg[k] / max * 100}%"></div>
              <div class="mb-goal" style="bottom:${s.goal[k] / max * 100}%"></div>` : ''}
            </div>
            <div class="mb-wk">${s.mon.getMonth() + 1}/${s.mon.getDate()}</div>
            <div class="mb-days ${s.logged < s.days ? 'gap' : ''}">${s.logged}/${s.days}d</div>
          </div>`).join('')}</div>
        <div class="cg-key text-sm text-muted"><span><i class="mb-key-goal"></i>plan</span><span><i class="mb-key-bar ok"></i>within 10% of plan</span><span><i class="mb-key-bar"></i>under</span><span>· n/7d = days logged</span></div>`;
      card.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { metric = +b.dataset.m; draw(); });
    };
    draw();
    container.appendChild(card);
  }

  function renderStrength() {
    const card = document.createElement('div');
    card.className = 'card';
    // Top weight per session for each exercise
    const series = {};
    Object.entries(data.setLogs).forEach(([key, v]) => {
      const [d, id] = key.split('_');
      const w = parseFloat(v.weight);
      if (!v.done || !(w > 0)) return;
      (series[id] = series[id] || {})[d] = Math.max((series[id] || {})[d] || 0, w);
    });
    const options = [];
    PLAN.workoutOrder.forEach(wn => (PLAN.workouts[wn].exercises || []).forEach(ex => {
      if (series[ex.id]) options.push({ id: ex.id, label: ex.label.replace(/^[A-Z]\d?\s+/, ''), group: wn, n: Object.keys(series[ex.id]).length });
    }));
    if (!options.length) {
      card.innerHTML = '<div class="card-title">Strength</div><div class="text-sm text-muted">Tick some sets with weights to see your progress here.</div>';
      container.appendChild(card); return;
    }
    let sel = App._strengthEx && series[App._strengthEx] ? App._strengthEx : options.slice().sort((a, b) => b.n - a.n)[0].id;
    const draw = () => {
      const pts = Object.entries(series[sel]).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, v }));
      let best = 0; pts.forEach(p => { p.pr = p.v > best; best = Math.max(best, p.v); });
      const first = pts[0].v, gain = best - first;
      card.innerHTML = `<div class="card-title">Strength</div>
        <select id="str-sel">${PLAN.workoutOrder.filter(wn => options.some(o => o.group === wn)).map(wn => `<optgroup label="${wn}">
            ${options.filter(o => o.group === wn).map(o => `<option value="${o.id}" ${o.id === sel ? 'selected' : ''}>${o.label}</option>`).join('')}</optgroup>`).join('')}</select>
        <div class="stat-row mt8">
          <div><strong>${best}</strong><em>best</em></div>
          <div><strong>${gain > 0 ? '+' : ''}${gain}</strong><em>since first</em></div>
          <div><strong>${pts.length}</strong><em>session${pts.length === 1 ? '' : 's'}</em></div>
        </div>
        <div class="chart-wrap mt8"><canvas class="chart" id="str-chart"></canvas></div>
        <div class="text-sm text-muted">Top weight each session · <span style="color:var(--green)">●</span> new best</div>`;
      card.querySelector('#str-sel').onchange = e => { sel = App._strengthEx = e.target.value; draw(); };
      requestAnimationFrame(() => App.drawLineChart(card.querySelector('#str-chart'), pts.map(p => ({ x: p.date, y: p.v, mark: p.pr }))));
    };
    container.appendChild(card);
    draw();
  }


};
