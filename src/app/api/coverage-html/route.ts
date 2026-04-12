import { NextResponse } from "next/server";
import { getLatestCoverageSnapshot } from "@/lib/queries";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

// ── Coverage Rate Trend chart ─────────────────────────────────────────────────
// Data is driven entirely by the /api/data-integrations table.
// Past integrations (date <= today) render as solid lines (actual).
// Future integrations (date > today) render as dashed lines (projected).
// Blue = overall coverage (cumulative incremental VIO from all integrations).
// Green = offline coverage (cumulative incremental VIO from offline integrations).
// No localStorage dependency — all data lives in the DB.
function trendChartHtml(): string {
  return `
<style>
  #trendManageBtn:hover { opacity:.85; }
</style>

<div class="panel" id="trendPanel" style="margin-bottom:20px">
  <div class="panel-hdr" style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
    <div>
      <h2>COVERAGE RATE TREND</h2>
      <p>Actual coverage <strong>(solid)</strong> vs. projected targets <strong>(dashed)</strong>
        &nbsp;&middot;&nbsp;
        <span id="trendSubtitle" style="color:#6B7280"></span>
      </p>
    </div>
    <a id="trendManageBtn" href="/coverage/integrations"
      style="flex-shrink:0;padding:6px 14px;background:#3632FF;color:#fff;border:none;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;text-decoration:none;display:inline-block;line-height:1.5"
      target="_parent">Manage Integrations</a>
  </div>
  <div class="panel-body" style="padding-bottom:14px">
    <div id="trendLoading" style="text-align:center;padding:40px 0;color:#9CA3AF;font-size:13px">Loading chart data…</div>
    <canvas id="trendChart" style="max-height:240px;display:none"></canvas>
    <div id="trendEmpty" style="display:none;text-align:center;padding:40px 0;color:#9CA3AF;font-size:13px">
      No data integrations found.
      <a href="/coverage/integrations" target="_parent"
        style="color:#3632FF;font-weight:600;text-decoration:none;margin-left:4px">Add the first one →</a>
    </div>
  </div>
</div>

<script>
(function () {
  var BLUE  = '#3632FF';
  var GREEN = '#10B981';
  var _chart = null;

  function fmtShort(iso) {
    var d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
  }

  function todayISO() {
    return new Date().toISOString().split('T')[0];
  }

  function buildChart(integrations) {
    var loading = document.getElementById('trendLoading');
    var canvas  = document.getElementById('trendChart');
    var empty   = document.getElementById('trendEmpty');
    var subtitle = document.getElementById('trendSubtitle');

    if (loading) loading.style.display = 'none';

    if (!integrations || integrations.length === 0) {
      if (empty) empty.style.display = 'block';
      return;
    }

    if (canvas) canvas.style.display = 'block';

    /* sort by date ascending */
    var sorted = integrations.slice().sort(function(a, b) {
      return a.integration_date.localeCompare(b.integration_date);
    });

    var today = todayISO();
    var past   = sorted.filter(function(i) { return i.integration_date <= today; });
    var future = sorted.filter(function(i) { return i.integration_date >  today; });

    /* build cumulative series */
    var covCum  = 0;
    var offCum  = 0;
    var actualPoints    = [];  /* {date, cov, off} */
    var projectedPoints = [];  /* {date, cov, off} */

    for (var i = 0; i < past.length; i++) {
      var p = past[i];
      covCum += (p.incremental_vio_pct != null ? Number(p.incremental_vio_pct) : 0);
      if (p.type === 'offline') {
        offCum += (p.incremental_vio_pct != null ? Number(p.incremental_vio_pct) : 0);
      }
      actualPoints.push({ date: p.integration_date, cov: covCum, off: offCum });
    }

    /* bridge point: last actual carries into projected */
    var bridgeCov = covCum;
    var bridgeOff = offCum;

    for (var j = 0; j < future.length; j++) {
      var f = future[j];
      bridgeCov += (f.incremental_vio_pct != null ? Number(f.incremental_vio_pct) : 0);
      if (f.type === 'offline') {
        bridgeOff += (f.incremental_vio_pct != null ? Number(f.incremental_vio_pct) : 0);
      }
      projectedPoints.push({ date: f.integration_date, cov: bridgeCov, off: bridgeOff });
    }

    /* combined label set */
    var dateSet = {};
    actualPoints.forEach(function(p)    { dateSet[p.date] = true; });
    projectedPoints.forEach(function(p) { dateSet[p.date] = true; });
    var labels = Object.keys(dateSet).sort();
    var dispLabels = labels.map(fmtShort);

    /* align series to labels */
    function toMap(pts, key) {
      var m = {};
      pts.forEach(function(p) { m[p.date] = p[key]; });
      return m;
    }
    var covActMap = toMap(actualPoints,    'cov');
    var offActMap = toMap(actualPoints,    'off');
    var covPrjMap = toMap(projectedPoints, 'cov');
    var offPrjMap = toMap(projectedPoints, 'off');

    var covActual   = labels.map(function(l) { return covActMap[l] != null ? covActMap[l] : null; });
    var offActual   = labels.map(function(l) { return offActMap[l] != null ? offActMap[l] : null; });
    var covProjected = labels.map(function(l) { return covPrjMap[l] != null ? covPrjMap[l] : null; });
    var offProjected = labels.map(function(l) { return offPrjMap[l] != null ? offPrjMap[l] : null; });

    /* find last actual index to bridge to projected */
    var lastActIdx = -1;
    for (var k = 0; k < covActual.length; k++) {
      if (covActual[k] != null) lastActIdx = k;
    }
    /* inject bridge point into projected at lastActIdx */
    if (lastActIdx >= 0 && future.length > 0) {
      covProjected[lastActIdx] = covActual[lastActIdx];
      offProjected[lastActIdx] = offActual[lastActIdx] != null ? offActual[lastActIdx] : 0;
    }

    /* subtitle */
    if (subtitle) {
      var liveCount = past.length;
      subtitle.textContent = liveCount + ' live integration' + (liveCount === 1 ? '' : 's')
        + (future.length > 0 ? ' \u00b7 ' + future.length + ' projected' : '');
    }

    if (_chart) { _chart.destroy(); _chart = null; }
    var ctx = document.getElementById('trendChart');
    if (!ctx) return;

    _chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dispLabels,
        datasets: [
          {
            label: 'Coverage Actual',
            data: covActual,
            borderColor: BLUE,
            backgroundColor: 'rgba(54,50,255,0.07)',
            fill: true,
            tension: 0.3,
            pointRadius: 5,
            pointBackgroundColor: BLUE,
            pointHoverRadius: 7,
            borderWidth: 2.5,
            spanGaps: false
          },
          {
            label: 'Coverage Projected',
            data: covProjected,
            borderColor: BLUE,
            backgroundColor: 'transparent',
            borderDash: [7, 4],
            tension: 0.3,
            pointRadius: function(c) { return c.dataIndex === lastActIdx ? 0 : 5; },
            pointBackgroundColor: BLUE,
            pointHoverRadius: 7,
            borderWidth: 2,
            spanGaps: false
          },
          {
            label: 'Offline Actual',
            data: offActual,
            borderColor: GREEN,
            backgroundColor: 'rgba(16,185,129,0.07)',
            fill: true,
            tension: 0.3,
            pointRadius: 5,
            pointBackgroundColor: GREEN,
            pointHoverRadius: 7,
            borderWidth: 2.5,
            spanGaps: false
          },
          {
            label: 'Offline Projected',
            data: offProjected,
            borderColor: GREEN,
            backgroundColor: 'transparent',
            borderDash: [7, 4],
            tension: 0.3,
            pointRadius: function(c) { return c.dataIndex === lastActIdx ? 0 : 5; },
            pointBackgroundColor: GREEN,
            pointHoverRadius: 7,
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
            labels: {
              font: { family: 'Inter,sans-serif', size: 11 },
              color: '#6B7280',
              boxWidth: 20
            }
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
              label: function(c) {
                if (c.raw == null) return null;
                return c.dataset.label + ': ' + Number(c.raw).toFixed(1) + '%';
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: '#F4F4F6' },
            ticks: {
              font: { family: 'Inter,sans-serif', size: 10 },
              color: '#9CA3AF',
              maxRotation: 45
            }
          },
          y: {
            min: 0,
            max: 100,
            grid: { color: '#F4F4F6' },
            ticks: {
              font: { family: 'Inter,sans-serif', size: 10 },
              color: '#9CA3AF',
              callback: function(v) { return v + '%'; }
            }
          }
        }
      }
    });
  }

  /* fetch and render */
  fetch('/api/data-integrations')
    .then(function(r) { return r.json(); })
    .then(function(data) { buildChart(Array.isArray(data) ? data : []); })
    .catch(function() {
      var loading = document.getElementById('trendLoading');
      if (loading) loading.textContent = 'Failed to load chart data.';
    });
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
