import { NextResponse } from "next/server";
import { getLatestCoverageSnapshot } from "@/lib/queries";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

// ── Trend chart injected before the KPI cards ─────────────────────────────────
// Chart.js 4.x is already loaded by the coverage dashboard HTML.
// Targets are stored in localStorage — no DB required.
// The JS is written as a plain string (no template literals) to avoid escaping hell.
function trendChartHtml(): string {
  const html = `
<style>
  #trendInputGrid input { padding:5px 8px; border:1.5px solid #E5E7EB; border-radius:6px; font-size:12px; font-family:inherit; width:100%; box-sizing:border-box; outline:none; color:#1F1F1F; }
  #trendInputGrid input:focus { border-color:#3632FF; }
  #trendInputGrid label { font-size:10px; color:#6B7280; font-weight:600; display:block; margin-bottom:4px; }
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
      onclick="window.__trend.toggleEdit()">Edit Targets</button>
  </div>
  <div class="panel-body" style="padding-bottom:14px">
    <canvas id="trendChart" style="max-height:210px"></canvas>
    <div id="trendEditor" style="display:none;margin-top:16px;border-top:1px solid #F4F4F6;padding-top:14px">
      <p style="font-size:11px;color:#6B7280;margin-bottom:10px">
        Set weekly coverage rate targets (%) for the next 12 weeks, then press <strong>Save</strong>.
      </p>
      <div id="trendInputGrid"
        style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:12px"></div>
      <div style="display:flex;gap:8px">
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
  var LS_KEY = 'coverage_targets_v1';
  var NUM_WEEKS = 12;
  var _chart = null;
  var _history = [];
  var _editOpen = false;

  function nextMondays(n) {
    var days = [];
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    var dow = d.getDay();
    var daysUntilMon = dow === 0 ? 1 : 8 - dow;
    d.setDate(d.getDate() + daysUntilMon);
    for (var i = 0; i < n; i++) {
      days.push(new Date(d));
      d.setDate(d.getDate() + 7);
    }
    return days;
  }

  function fmtShort(isoOrDate) {
    var d = (isoOrDate instanceof Date) ? isoOrDate : new Date(isoOrDate + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function loadTargets() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (e) { return []; }
  }

  function saveTargets(arr) {
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
  }

  function renderChart() {
    var ctx = document.getElementById('trendChart');
    if (!ctx) return;
    if (_chart) { _chart.destroy(); _chart = null; }

    var weeks = nextMondays(NUM_WEEKS);
    var saved = loadTargets();

    var histLabels = _history.map(function (h) { return fmtShort(h.date); });
    var histValues = _history.map(function (h) { return h.rate; });

    var tgtLabels = weeks.map(function (d) { return fmtShort(d); });
    var tgtValues = weeks.map(function (_, i) {
      var t = saved[i];
      return (t && t.value != null) ? t.value : null;
    });

    var allLabels = histLabels.concat(tgtLabels);

    // Historical dataset: actual values then nulls
    var histData = histValues.concat(new Array(tgtLabels.length).fill(null));

    // Target dataset: nulls for all hist except last point (bridge), then target values
    var bridgeNulls = new Array(Math.max(0, _history.length - 1)).fill(null);
    var bridgeVal = _history.length > 0 ? [_history[_history.length - 1].rate] : [];
    var tgtData = bridgeNulls.concat(bridgeVal).concat(tgtValues);

    var histLen = _history.length;

    _chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: allLabels,
        datasets: [
          {
            label: 'Actual',
            data: histData,
            borderColor: '#3632FF',
            backgroundColor: 'rgba(54,50,255,0.07)',
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: '#3632FF',
            pointHoverRadius: 6,
            borderWidth: 2.5,
            spanGaps: false
          },
          {
            label: 'Target',
            data: tgtData,
            borderColor: '#3632FF',
            backgroundColor: 'transparent',
            borderDash: [7, 4],
            tension: 0.35,
            pointRadius: function (c) { return c.dataIndex < histLen ? 0 : 4; },
            pointBackgroundColor: '#3632FF',
            pointHoverRadius: 6,
            borderWidth: 2,
            spanGaps: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            labels: { font: { family: 'Inter,sans-serif', size: 11 }, color: '#6B7280', boxWidth: 24 }
          },
          tooltip: {
            backgroundColor: '#fff',
            borderColor: '#E5E7EB',
            borderWidth: 1,
            titleColor: '#1F1F1F',
            bodyColor: '#6B7280',
            titleFont: { family: 'Inter,sans-serif', size: 12, weight: 'bold' },
            bodyFont: { family: 'Inter,sans-serif', size: 11 },
            callbacks: {
              label: function (c) {
                return c.raw != null ? (c.dataset.label + ': ' + Number(c.raw).toFixed(1) + '%') : null;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: '#F4F4F6' },
            ticks: { font: { family: 'Inter,sans-serif', size: 10 }, color: '#9CA3AF', maxRotation: 45 }
          },
          y: {
            min: 0,
            max: 100,
            grid: { color: '#F4F4F6' },
            ticks: {
              font: { family: 'Inter,sans-serif', size: 10 },
              color: '#9CA3AF',
              callback: function (v) { return v + '%'; }
            }
          }
        }
      }
    });

    var el = document.getElementById('trendSnapshotCount');
    if (el) el.textContent = _history.length + ' snapshot' + (_history.length === 1 ? '' : 's') + ' recorded';
  }

  function renderInputs() {
    var weeks = nextMondays(NUM_WEEKS);
    var saved = loadTargets();
    var grid = document.getElementById('trendInputGrid');
    if (!grid) return;
    var html = '';
    for (var i = 0; i < weeks.length; i++) {
      var v = (saved[i] && saved[i].value != null) ? saved[i].value : '';
      html += '<div>';
      html += '<label>' + fmtShort(weeks[i]) + '</label>';
      html += '<input type="number" min="0" max="100" step="0.1" id="tgt_' + i + '" value="' + v + '" placeholder="—">';
      html += '</div>';
    }
    grid.innerHTML = html;
  }

  window.__trend = {
    toggleEdit: function () {
      _editOpen = !_editOpen;
      var editor = document.getElementById('trendEditor');
      var btn = document.getElementById('trendEditBtn');
      if (_editOpen) {
        renderInputs();
        if (editor) editor.style.display = 'block';
        if (btn) { btn.textContent = 'Cancel'; btn.style.background = '#F4F4F6'; btn.style.color = '#1F1F1F'; }
      } else {
        if (editor) editor.style.display = 'none';
        if (btn) { btn.textContent = 'Edit Targets'; btn.style.background = '#3632FF'; btn.style.color = '#fff'; }
      }
    },
    save: function () {
      var weeks = nextMondays(NUM_WEEKS);
      var targets = [];
      for (var i = 0; i < weeks.length; i++) {
        var el = document.getElementById('tgt_' + i);
        var v = el ? parseFloat(el.value) : NaN;
        targets.push({ date: weeks[i].toISOString().split('T')[0], value: isNaN(v) ? null : Math.min(100, Math.max(0, v)) });
      }
      saveTargets(targets);
      window.__trend.toggleEdit();
      renderChart();
    }
  };

  fetch('/api/coverage-history')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      _history = Array.isArray(data) ? data : [];
      renderChart();
    })
    .catch(function () { renderChart(); });
})();
</script>`;
  return html;
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
