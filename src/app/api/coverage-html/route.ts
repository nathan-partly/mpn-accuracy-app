import { NextResponse } from "next/server";
import { getLatestCoverageSnapshot } from "@/lib/queries";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

// ── Trend chart injected before the KPI cards ─────────────────────────────────
// Chart.js 4.x is already loaded by the dashboard HTML.
// All user data stored in localStorage — no DB required.
// JS uses only single quotes and var/function to avoid escaping issues.
function trendChartHtml(): string {
  return `
<style>
  #trendInputGrid input, #offlineTgtGrid input { padding:5px 8px; border:1.5px solid #E5E7EB; border-radius:6px; font-size:12px; font-family:inherit; width:100%; box-sizing:border-box; outline:none; color:#1F1F1F; }
  #trendInputGrid input:focus, #offlineTgtGrid input:focus { border-color:#3632FF; }
  .trend-tab-btn { padding:6px 14px; border:1.5px solid #E5E7EB; background:#fff; border-radius:7px; font-size:12px; font-weight:600; cursor:pointer; font-family:inherit; color:#6B7280; transition:all .15s; }
  .trend-tab-btn.active { background:#3632FF; border-color:#3632FF; color:#fff; }
  .offline-hist-row { display:grid; grid-template-columns:1fr 1fr auto; gap:6px; align-items:center; margin-bottom:6px; }
  .offline-hist-row input { padding:5px 8px; border:1.5px solid #E5E7EB; border-radius:6px; font-size:12px; font-family:inherit; box-sizing:border-box; outline:none; color:#1F1F1F; }
  .offline-hist-row input:focus { border-color:#3632FF; }
  .offline-hist-row input[type=date] { color:#1F1F1F; }
</style>

<div class="panel" id="trendPanel" style="margin-bottom:20px;overflow:visible">
  <div class="panel-hdr" style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
    <div>
      <h2>COVERAGE RATE TREND</h2>
      <p>Historical actual <strong>(solid)</strong> vs. weekly targets <strong>(dashed)</strong>
        &nbsp;&middot;&nbsp; <span id="trendSnapshotCount" style="color:#6B7280"></span>
      </p>
    </div>
    <button id="trendEditBtn"
      style="flex-shrink:0;padding:6px 14px;background:#3632FF;color:#fff;border:none;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit"
      onclick="window.__trend.toggleEdit()">Edit Data</button>
  </div>
  <div class="panel-body" style="padding-bottom:14px">
    <canvas id="trendChart" style="max-height:230px"></canvas>

    <!-- ── editor ── -->
    <div id="trendEditor" style="display:none;margin-top:16px;border-top:1px solid #F4F4F6;padding-top:14px">

      <!-- tabs -->
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <button class="trend-tab-btn active" id="tabBtnCoverage" onclick="window.__trend.switchTab('coverage')">Coverage Rate Targets</button>
        <button class="trend-tab-btn" id="tabBtnOffline" onclick="window.__trend.switchTab('offline')">Offline Coverage</button>
      </div>

      <!-- tab: coverage rate targets -->
      <div id="tabCoverage">
        <p style="font-size:11px;color:#6B7280;margin-bottom:10px">
          Weekly overall coverage rate targets (%) for the next 12 weeks.
        </p>
        <div id="trendInputGrid"
          style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:12px"></div>
      </div>

      <!-- tab: offline coverage -->
      <div id="tabOffline" style="display:none">
        <p style="font-size:11px;color:#6B7280;margin-bottom:10px">
          Historical offline coverage data and weekly targets (%). Historical values appear as a solid line; targets as dashed.
        </p>

        <!-- historical rows -->
        <p style="font-size:10px;font-weight:700;color:#1F1F1F;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Historical Data</p>
        <div style="font-size:10px;color:#6B7280;margin-bottom:6px;display:grid;grid-template-columns:1fr 1fr auto;gap:6px">
          <span>Date</span><span>Offline %</span><span></span>
        </div>
        <div id="offlineHistRows"></div>
        <button onclick="window.__trend.addOfflineRow()"
          style="margin-top:6px;padding:5px 12px;background:#F4F4F6;color:#1F1F1F;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit">+ Add Data Point</button>

        <!-- targets -->
        <p style="font-size:10px;font-weight:700;color:#1F1F1F;text-transform:uppercase;letter-spacing:.05em;margin-top:14px;margin-bottom:6px">12-Week Targets</p>
        <div id="offlineTgtGrid"
          style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:12px"></div>
      </div>

      <!-- save / cancel -->
      <div style="display:flex;gap:8px;margin-top:4px">
        <button onclick="window.__trend.save()"
          style="padding:6px 16px;background:#3632FF;color:#fff;border:none;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">Save</button>
        <button onclick="window.__trend.toggleEdit()"
          style="padding:6px 14px;background:#F4F4F6;color:#1F1F1F;border:none;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">Cancel</button>
      </div>
    </div>
  </div>
</div>

<script>
(function () {
  var LS_TARGETS  = 'coverage_targets_v1';
  var LS_OFFLINE  = 'offline_data_v2';
  var NUM_WEEKS   = 12;
  var BLUE        = '#3632FF';
  var GREEN       = '#10B981';
  var _chart      = null;
  var _history    = [];   // [{date, rate}] from /api/coverage-history
  var _editOpen   = false;
  var _activeTab  = 'coverage';

  /* ── date helpers ─────────────────────────────────────────────────────── */
  function nextMondays(n) {
    var days = [], d = new Date();
    d.setHours(0,0,0,0);
    var dow = d.getDay();
    d.setDate(d.getDate() + (dow === 0 ? 1 : 8 - dow));
    for (var i = 0; i < n; i++) { days.push(new Date(d)); d.setDate(d.getDate()+7); }
    return days;
  }

  function fmtShort(iso) {
    var d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day:'numeric', month:'short' });
  }

  function isoToday() {
    return new Date().toISOString().split('T')[0];
  }

  /* ── localStorage helpers ─────────────────────────────────────────────── */
  function loadTargets() {
    try { return JSON.parse(localStorage.getItem(LS_TARGETS) || '[]'); } catch(e) { return []; }
  }

  function loadOffline() {
    try {
      var d = JSON.parse(localStorage.getItem(LS_OFFLINE) || 'null');
      if (d && d.historical && d.targets) return d;
    } catch(e) {}
    return { historical: [], targets: [] };
  }

  function saveOffline(obj) { localStorage.setItem(LS_OFFLINE, JSON.stringify(obj)); }
  function saveCoverageTargets(arr) { localStorage.setItem(LS_TARGETS, JSON.stringify(arr)); }

  /* ── chart rendering ──────────────────────────────────────────────────── */
  function buildLabels(weeks) {
    var seen = {}, labels = [];
    function add(iso) {
      if (iso && !seen[iso]) { seen[iso] = true; labels.push(iso); }
    }
    _history.forEach(function(h) { add(h.date); });
    var off = loadOffline();
    off.historical.forEach(function(p) { add(p.date); });
    weeks.forEach(function(d) { add(d.toISOString().split('T')[0]); });
    labels.sort();
    return labels;
  }

  function alignTo(labels, points) {
    var map = {};
    points.forEach(function(p) { if (p && p.date && p.value != null) map[p.date] = p.value; });
    return labels.map(function(l) { return map[l] != null ? map[l] : null; });
  }

  function renderChart() {
    var ctx = document.getElementById('trendChart');
    if (!ctx) return;
    if (_chart) { _chart.destroy(); _chart = null; }

    var weeks    = nextMondays(NUM_WEEKS);
    var weekISOs = weeks.map(function(d) { return d.toISOString().split('T')[0]; });
    var labels   = buildLabels(weeks);
    var dispLabels = labels.map(fmtShort);

    /* coverage actual */
    var covActual = alignTo(labels, _history.map(function(h){ return {date:h.date, value:h.rate}; }));

    /* coverage targets — bridge from last actual, then future */
    var covSaved   = loadTargets();
    var tgtPoints  = weekISOs.map(function(iso,i) { var t=covSaved[i]; return {date:iso, value:(t&&t.value!=null)?t.value:null}; });
    var lastActIdx = -1;
    covActual.forEach(function(v,i){ if(v!=null) lastActIdx=i; });
    var covTarget  = labels.map(function(iso, i) {
      if (i === lastActIdx) return covActual[lastActIdx]; // bridge
      var t = tgtPoints.filter(function(p){ return p.date===iso; })[0];
      return (t && t.value != null) ? t.value : null;
    });
    /* zero out bridge point in covActual so tooltip shows correctly */
    var covActualForTooltip = covActual.slice();

    /* offline actual */
    var off         = loadOffline();
    var offActual   = alignTo(labels, off.historical);

    /* offline targets — bridge + future */
    var offTgtPts   = weekISOs.map(function(iso,i){ var t=off.targets[i]; return {date:iso, value:(t&&t.value!=null)?t.value:null}; });
    var lastOffIdx  = -1;
    offActual.forEach(function(v,i){ if(v!=null) lastOffIdx=i; });
    var offTarget   = labels.map(function(iso,i) {
      if (i === lastOffIdx) return offActual[lastOffIdx];
      var t = offTgtPts.filter(function(p){ return p.date===iso; })[0];
      return (t && t.value!=null) ? t.value : null;
    });

    var histLen = labels.indexOf(weekISOs[0]); // index where future starts

    _chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dispLabels,
        datasets: [
          {
            label: 'Coverage Actual',
            data: covActual,
            borderColor: BLUE, backgroundColor: 'rgba(54,50,255,0.07)',
            fill: true, tension: 0.35,
            pointRadius: 4, pointBackgroundColor: BLUE, pointHoverRadius: 6,
            borderWidth: 2.5, spanGaps: false
          },
          {
            label: 'Coverage Target',
            data: covTarget,
            borderColor: BLUE, backgroundColor: 'transparent',
            borderDash: [7,4], tension: 0.35,
            pointRadius: function(c){ return c.dataIndex <= lastActIdx ? 0 : 4; },
            pointBackgroundColor: BLUE, pointHoverRadius: 6,
            borderWidth: 2, spanGaps: false
          },
          {
            label: 'Offline Actual',
            data: offActual,
            borderColor: GREEN, backgroundColor: 'rgba(16,185,129,0.07)',
            fill: true, tension: 0.35,
            pointRadius: 4, pointBackgroundColor: GREEN, pointHoverRadius: 6,
            borderWidth: 2.5, spanGaps: false
          },
          {
            label: 'Offline Target',
            data: offTarget,
            borderColor: GREEN, backgroundColor: 'transparent',
            borderDash: [7,4], tension: 0.35,
            pointRadius: function(c){ return c.dataIndex <= lastOffIdx ? 0 : 4; },
            pointBackgroundColor: GREEN, pointHoverRadius: 6,
            borderWidth: 2, spanGaps: false
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            labels: { font:{family:'Inter,sans-serif',size:11}, color:'#6B7280', boxWidth:20 }
          },
          tooltip: {
            backgroundColor:'#fff', borderColor:'#E5E7EB', borderWidth:1,
            titleColor:'#1F1F1F', bodyColor:'#6B7280',
            titleFont:{family:'Inter,sans-serif',size:12,weight:'bold'},
            bodyFont:{family:'Inter,sans-serif',size:11},
            callbacks: {
              label: function(c){ return c.raw!=null ? c.dataset.label+': '+Number(c.raw).toFixed(1)+'%' : null; }
            }
          }
        },
        scales: {
          x: { grid:{color:'#F4F4F6'}, ticks:{font:{family:'Inter,sans-serif',size:10},color:'#9CA3AF',maxRotation:45} },
          y: { min:0, max:100, grid:{color:'#F4F4F6'},
            ticks:{font:{family:'Inter,sans-serif',size:10},color:'#9CA3AF',callback:function(v){return v+'%';}} }
        }
      }
    });

    var el = document.getElementById('trendSnapshotCount');
    if (el) el.textContent = _history.length + ' snapshot'+(_history.length===1?'':' s')+' recorded';
  }

  /* ── editor helpers ───────────────────────────────────────────────────── */
  function renderCoverageInputs() {
    var weeks  = nextMondays(NUM_WEEKS);
    var saved  = loadTargets();
    var grid   = document.getElementById('trendInputGrid');
    if (!grid) return;
    var h = '';
    for (var i=0; i<weeks.length; i++) {
      var v = (saved[i] && saved[i].value!=null) ? saved[i].value : '';
      h += '<div><label style="font-size:10px;color:#6B7280;font-weight:600;display:block;margin-bottom:4px">'
        + fmtShort(weeks[i].toISOString().split('T')[0]) + '</label>'
        + '<input type="number" min="0" max="100" step="0.1" id="covTgt_'+i+'" value="'+v+'" placeholder="—"></div>';
    }
    grid.innerHTML = h;
  }

  function renderOfflineInputs() {
    var off   = loadOffline();
    var weeks = nextMondays(NUM_WEEKS);

    /* historical rows */
    var rows  = document.getElementById('offlineHistRows');
    if (rows) {
      var h = '';
      var hist = off.historical.length > 0 ? off.historical : [];
      for (var i=0; i<hist.length; i++) {
        h += '<div class="offline-hist-row">'
          + '<input type="date" id="offDate_'+i+'" value="'+(hist[i].date||'')+'">'
          + '<input type="number" min="0" max="100" step="0.1" id="offVal_'+i+'" value="'+(hist[i].value!=null?hist[i].value:'')+'" placeholder="—">'
          + '<button onclick="window.__trend.removeOfflineRow('+i+')" style="padding:3px 8px;background:#FEE2E2;color:#DC2626;border:none;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer">&#x2715;</button>'
          + '</div>';
      }
      rows.innerHTML = h;
    }

    /* target grid */
    var tgtGrid = document.getElementById('offlineTgtGrid');
    if (tgtGrid) {
      var h2 = '';
      for (var j=0; j<weeks.length; j++) {
        var t = off.targets[j];
        var tv = (t && t.value!=null) ? t.value : '';
        h2 += '<div><label style="font-size:10px;color:#6B7280;font-weight:600;display:block;margin-bottom:4px">'
          + fmtShort(weeks[j].toISOString().split('T')[0]) + '</label>'
          + '<input type="number" min="0" max="100" step="0.1" id="offTgt_'+j+'" value="'+tv+'" placeholder="—"></div>';
      }
      tgtGrid.innerHTML = h2;
    }
  }

  /* ── public API ───────────────────────────────────────────────────────── */
  window.__trend = {
    toggleEdit: function() {
      _editOpen = !_editOpen;
      var editor = document.getElementById('trendEditor');
      var btn    = document.getElementById('trendEditBtn');
      if (_editOpen) {
        _activeTab = 'coverage';
        renderCoverageInputs();
        if (editor) editor.style.display = 'block';
        if (btn) { btn.textContent='Cancel'; btn.style.background='#F4F4F6'; btn.style.color='#1F1F1F'; }
      } else {
        if (editor) editor.style.display = 'none';
        if (btn) { btn.textContent='Edit Data'; btn.style.background=BLUE; btn.style.color='#fff'; }
      }
    },

    switchTab: function(tab) {
      _activeTab = tab;
      document.getElementById('tabCoverage').style.display  = tab==='coverage' ? 'block' : 'none';
      document.getElementById('tabOffline').style.display   = tab==='offline'  ? 'block' : 'none';
      document.getElementById('tabBtnCoverage').className   = 'trend-tab-btn' + (tab==='coverage' ? ' active' : '');
      document.getElementById('tabBtnOffline').className    = 'trend-tab-btn' + (tab==='offline'  ? ' active' : '');
      if (tab==='offline') renderOfflineInputs();
    },

    addOfflineRow: function() {
      var off  = loadOffline();
      off.historical.push({ date: isoToday(), value: null });
      saveOffline(off);
      renderOfflineInputs();
    },

    removeOfflineRow: function(idx) {
      var off = loadOffline();
      off.historical.splice(idx, 1);
      saveOffline(off);
      renderOfflineInputs();
    },

    save: function() {
      /* coverage targets */
      var weeks = nextMondays(NUM_WEEKS);
      var covTargets = weeks.map(function(d,i) {
        var el = document.getElementById('covTgt_'+i);
        var v  = el ? parseFloat(el.value) : NaN;
        return { date: d.toISOString().split('T')[0], value: isNaN(v)?null:Math.min(100,Math.max(0,v)) };
      });
      saveCoverageTargets(covTargets);

      /* offline data */
      var off     = loadOffline();
      var newHist = off.historical.map(function(_, i) {
        var dateEl = document.getElementById('offDate_'+i);
        var valEl  = document.getElementById('offVal_'+i);
        var v      = valEl ? parseFloat(valEl.value) : NaN;
        return { date: dateEl ? dateEl.value : '', value: isNaN(v)?null:Math.min(100,Math.max(0,v)) };
      }).filter(function(p){ return p.date; });
      newHist.sort(function(a,b){ return a.date.localeCompare(b.date); });

      var newTgts = weeks.map(function(d,i) {
        var el = document.getElementById('offTgt_'+i);
        var v  = el ? parseFloat(el.value) : NaN;
        return { date: d.toISOString().split('T')[0], value: isNaN(v)?null:Math.min(100,Math.max(0,v)) };
      });

      saveOffline({ historical: newHist, targets: newTgts });
      window.__trend.toggleEdit();
      renderChart();
    }
  };

  /* ── bootstrap ────────────────────────────────────────────────────────── */
  fetch('/api/coverage-history')
    .then(function(r){ return r.json(); })
    .then(function(data){ _history = Array.isArray(data) ? data : []; renderChart(); })
    .catch(function(){ renderChart(); });
})();
</script>`;
}

// ── Inject the trend chart before the KPI cards ───────────────────────────────
function injectTrendChart(html: string): string {
  const MARKER = '<div class="kpis" id="kpis">';
  const idx = html.indexOf(MARKER);
  if (idx === -1) return html;
  return html.slice(0, idx) + trendChartHtml() + "\n" + html.slice(idx);
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET() {
  let html: string | null = null;

  try {
    const latest = await getLatestCoverageSnapshot();
    if (latest?.html_content) html = latest.html_content;
  } catch {
    // fall through to static file
  }

  if (!html) {
    try {
      html = readFileSync(
        join(process.cwd(), "public", "coverage-dashboard.html"),
        "utf-8"
      );
    } catch {
      return new NextResponse("Coverage dashboard not found", { status: 404 });
    }
  }

  return new NextResponse(injectTrendChart(html), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
