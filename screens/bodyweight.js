'use strict';
App.renderBodyweight = function(el) {
  const entries = Store.get().bodyweight.slice().sort((a, b) => a.date.localeCompare(b.date));
  el.innerHTML = `<div class="card-title">Bodyweight</div>
    <div class="row">
      <input type="number" step="0.1" inputmode="decimal" id="bw-input" placeholder="Today's weight" style="flex:1">
      <button class="btn btn-primary btn-sm" id="bw-save">Log</button>
    </div>
    ${entries.length ? `<div class="text-sm text-muted mt8">Latest: ${entries[entries.length-1].kg} (${entries[entries.length-1].date})</div>` : ''}
    <div class="chart-wrap mt12"><canvas class="chart" id="bw-chart"></canvas></div>`;

  el.querySelector('#bw-save').onclick = () => {
    const v = parseFloat(el.querySelector('#bw-input').value);
    if (isNaN(v)) return;
    const ds = todayStr();
    Store.set(d => {
      d.bodyweight = d.bodyweight.filter(e => e.date !== ds);
      d.bodyweight.push({ date: ds, kg: v });
    });
    App.renderBodyweight(el);
  };

  requestAnimationFrame(() => drawChart(el.querySelector('#bw-chart'), entries));

  function drawChart(canvas, pts) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#999'; ctx.font = '12px sans-serif';
    if (pts.length < 2) { ctx.fillText(pts.length ? 'Log more entries to see a trend' : 'No entries yet', 8, h / 2); return; }
    const vals = pts.map(p => p.kg);
    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max) { min -= 1; max += 1; }
    const pad = { l: 40, r: 10, t: 10, b: 20 };
    const x = i => pad.l + (i / (pts.length - 1)) * (w - pad.l - pad.r);
    const y = v => pad.t + (1 - (v - min) / (max - min)) * (h - pad.t - pad.b);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
    [min, (min + max) / 2, max].forEach(v => {
      ctx.beginPath(); ctx.moveTo(pad.l, y(v)); ctx.lineTo(w - pad.r, y(v)); ctx.stroke();
      ctx.fillText(v.toFixed(1), 2, y(v) + 4);
    });
    ctx.fillText(pts[0].date.slice(5), pad.l, h - 4);
    ctx.textAlign = 'right'; ctx.fillText(pts[pts.length-1].date.slice(5), w - pad.r, h - 4);
    ctx.strokeStyle = '#3498db'; ctx.lineWidth = 2; ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(x(i), y(p.kg)) : ctx.moveTo(x(i), y(p.kg)));
    ctx.stroke();
    ctx.fillStyle = '#3498db';
    pts.forEach((p, i) => { ctx.beginPath(); ctx.arc(x(i), y(p.kg), 3, 0, Math.PI * 2); ctx.fill(); });
  }
};
