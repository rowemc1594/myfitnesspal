'use strict';
App.screens.history = function(container) {
  const data = Store.get();

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
    if (!confirm('Replace current data with this backup? (Current data is saved to the restore slot.)')) return;
    try {
      Store.importJSON(await f.text());
      App.toast('Backup imported');
      App.navigate('history');
    } catch (e) { alert('Import failed: ' + e.message); }
  };

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
      if (!confirm('Remove this completed workout?')) return;
      setCompleted(ds, null);
      App.closeModal(); App.navigate('history');
    };
  }
};
