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

    var today = todayISO();

    /* exclude undated (TBD) integrations — they have no date to plot */
    var dated  = integrations.filter(function(i) { return !!i.integration_date; });

    /* sort by date ascending */
    var sorted = dated.slice().sort(function(a, b) {
      return a.integration_date.localeCompare(b.integration_date);
    });

    var past   = sorted.filter(function(i) { return i.integration_date <  today; });
    var future = sorted.filter(function(i) { return i.integration_date >= today; });

    /* build cumulative series */
    var covCum  = 0;
    var offCum  = 0;
    var actualPoints    = [];  /* {date, cov, off} */
    var projectedPoints = [];  /* {date, cov, off} */

    for (var i = 0; i < past.length; i++) {
      var p = past[i];
      covCum += (p.incremental_vio_pct != null ? Number(p.incremental_vio_pct) : 0);
      if (p.type === 'offline') {
        offCum += (p.total_vio_pct != null ? Number(p.total_vio_pct) : 0);
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
        bridgeOff += (f.total_vio_pct != null ? Number(f.total_vio_pct) : 0);
      }
      projectedPoints.push({ date: f.integration_date, cov: bridgeCov, off: bridgeOff });
    }

    /* combined label set */
    var dateSet = {};
    actualPoints.forEach(function(p)    { dateSet[p.date] = true; });
    projectedPoints.forEach(function(p) { dateSet[p.date] = true; });
    var labels = Object.keys(dateSet).sort();
    var dispLabels = labels.map(fmtShort);

    /* date → integration name(s) lookup for tooltip */
    var dateToNames = {};
    sorted.forEach(function(integ) {
      var d = integ.integration_date;
      if (!dateToNames[d]) dateToNames[d] = [];
      dateToNames[d].push(integ.name);
    });
    /* dispLabel → ISO date (needed inside Chart.js callback which only sees dispLabel) */
    var dispToISO = {};
    labels.forEach(function(iso, i) { dispToISO[dispLabels[i]] = iso; });

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
            footerColor: '#3632FF',
            titleFont: { family: 'Inter,sans-serif', size: 12, weight: 'bold' },
            bodyFont: { family: 'Inter,sans-serif', size: 11 },
            footerFont: { family: 'Inter,sans-serif', size: 11, weight: '600' },
            footerMarginTop: 6,
            callbacks: {
              label: function(c) {
                if (c.raw == null) return null;
                return c.dataset.label + ': ' + Number(c.raw).toFixed(1) + '%';
              },
              footer: function(items) {
                if (!items.length) return '';
                var iso = dispToISO[items[0].label];
                var names = iso && dateToNames[iso];
                if (!names || !names.length) return '';
                return (names.length === 1 ? '\u2192 ' : '\u2192 ') + names.join(', ');
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

// ── Integration counts column + drill drawer details ─────────────────────────
// Wraps the existing renderTable() so counts and drawer content re-inject after
// every re-render (tab change, sort, filter). Only counts live integrations.
// Matches brands by normalising to uppercase alphanumeric (same as DB).
function integrationCountsHtml(): string {
  return `
<style>
  .brand-table colgroup col.c-integ { width: 110px }
  td.integ-cell  { text-align: right; padding-right: 12px !important }
  th.th-integ    { text-align: right; padding-right: 12px !important }
  .drill-integ-section {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid #F0F0F5;
  }
  .drill-integ-hdr {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .07em; color: #6B7280; margin-bottom: 10px;
    display: flex; align-items: center; gap: 6px;
  }
  .drill-integ-cards {
    display: flex; flex-wrap: wrap; gap: 8px;
  }
  .drill-integ-card {
    display: flex; flex-direction: column; gap: 4px;
    background: #F8F9FF; border: 1px solid #E8EAFF;
    border-radius: 8px; padding: 10px 14px; min-width: 180px;
  }
  .dic-name {
    font-size: 12px; font-weight: 700; color: #0A0A0A;
  }
  .dic-badges {
    display: flex; gap: 5px; flex-wrap: wrap;
  }
  .dic-badge {
    display: inline-flex; align-items: center;
    border-radius: 10px; padding: 1px 7px;
    font-size: 10px; font-weight: 700; letter-spacing: .03em;
  }
  .dic-badge.online   { background: #DBEAFE; color: #1D4ED8; }
  .dic-badge.offline  { background: #D1FAE5; color: #065F46; }
  .dic-badge.direct   { background: #EDE9FE; color: #6D28D9; }
  .dic-badge.tparty   { background: #F3F4F6; color: #4B5563; }
  .dic-date {
    font-size: 10px; color: #9CA3AF;
  }
  .drill-integ-none {
    font-size: 12px; color: #9CA3AF; font-style: italic;
  }
</style>
<script>
(function () {
  var _intMap     = {};  /* norm(brand) → count */
  var _intDetails = {};  /* norm(brand) → [{name,type,relationship,integration_date}] */
  var _ready      = false;

  function norm(s) {
    return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function fmtDate(iso) {
    var d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  }

  /* ── patch static table structure (colgroup + thead) once ── */
  function patchStructure() {
    var cg = document.querySelector('.brand-table colgroup');
    if (cg && !cg.querySelector('.c-integ')) {
      var col = document.createElement('col');
      col.className = 'c-integ';
      var expCol = cg.querySelector('.c-exp');
      if (expCol) cg.insertBefore(col, expCol);
    }
    var headRow = document.querySelector('.brand-table thead tr');
    if (headRow && !headRow.querySelector('.th-integ')) {
      var th = document.createElement('th');
      th.className = 'th-integ r-right';
      th.textContent = 'Integrations';
      var ths = headRow.querySelectorAll('th');
      if (ths.length) headRow.insertBefore(th, ths[ths.length - 1]);
    }
  }

  /* ── build the integration cards HTML for a brand ── */
  function integCardsHtml(key) {
    var list = _intDetails[key] || [];
    if (list.length === 0) {
      return '<span class="drill-integ-none">No data integrations for this brand</span>';
    }
    return list.map(function (integ) {
      var typeBadge = integ.type === 'online'
        ? '<span class="dic-badge online">Online</span>'
        : '<span class="dic-badge offline">Offline</span>';
      var relBadge  = integ.relationship === 'direct'
        ? '<span class="dic-badge direct">Direct</span>'
        : '<span class="dic-badge tparty">Third-party</span>';
      return '<div class="drill-integ-card">'
        + '<span class="dic-name">' + integ.name + '</span>'
        + '<div class="dic-badges">' + typeBadge + relBadge + '</div>'
        + '<span class="dic-date">' + fmtDate(integ.integration_date) + '</span>'
        + '</div>';
    }).join('');
  }

  /* ── inject count cells + drill section into rendered rows ── */
  function injectCells() {
    /* fix colspan 7 → 8 for drill-rows and no-data rows */
    document.querySelectorAll('.brand-table td[colspan="7"]').forEach(function (td) {
      td.setAttribute('colspan', '8');
    });

    document.querySelectorAll('.brand-row').forEach(function (row) {
      var nameCell = row.querySelector('.name-cell');
      if (!nameCell) return;
      var key = norm(nameCell.textContent);

      /* ── count cell ── */
      if (!row.querySelector('.integ-cell')) {
        var count = _intMap[key] || 0;
        var td    = document.createElement('td');
        td.className = 'data-cell integ-cell';
        td.innerHTML = count > 0
          ? '<span style="display:inline-flex;align-items:center;justify-content:center;'
            + 'background:#EEF2FF;color:#3632FF;border-radius:12px;padding:2px 10px;'
            + 'font-size:11px;font-weight:700;letter-spacing:.02em">' + count + '</span>'
          : '<span style="color:#D1D5DB;font-size:11px">—</span>';
        var expCell = row.querySelector('.exp-cell');
        if (expCell) row.insertBefore(td, expCell);
      }

      /* ── drill drawer integrations section ── */
      var rowId  = row.id;                          /* brow_uid */
      var uid    = rowId ? rowId.replace('brow_', '') : null;
      if (!uid) return;
      var drillRow = document.getElementById('drill_' + uid);
      if (!drillRow) return;
      var inner = drillRow.querySelector('.drill-inner');
      if (!inner || inner.querySelector('.drill-integ-section')) return;

      var section = document.createElement('div');
      section.className = 'drill-integ-section';
      section.innerHTML = '<div class="drill-integ-hdr">'
        + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2.5">'
        + '<path d="M4 6h16M4 10h16M4 14h10"/></svg>'
        + 'Data Integrations</div>'
        + '<div class="drill-integ-cards">' + integCardsHtml(key) + '</div>';
      inner.appendChild(section);
    });
  }

  /* ── wrap renderTable so we re-inject after every render ── */
  function hookRenderTable() {
    if (typeof renderTable === 'undefined') { setTimeout(hookRenderTable, 80); return; }
    var _orig = renderTable;
    renderTable = function (brands) {
      _orig(brands);
      injectCells();
    };
    patchStructure();
    if (_ready) injectCells();
  }

  /* ── fetch integrations, build maps, inject ── */
  fetch('/api/data-integrations')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!Array.isArray(data)) return;
      var today   = new Date().toISOString().split('T')[0];
      var countMap  = {};
      var detailMap = {};
      data.forEach(function (integ) {
        if (!integ.integration_date || integ.integration_date >= today) return;
        (integ.brands || []).forEach(function (brand) {
          var key = norm(brand);
          if (!key) return;
          countMap[key]  = (countMap[key]  || 0) + 1;
          if (!detailMap[key]) detailMap[key] = [];
          detailMap[key].push({
            name:             integ.name,
            type:             integ.type,
            relationship:     integ.relationship || 'third-party',
            integration_date: integ.integration_date
          });
        });
      });
      _intMap     = countMap;
      _intDetails = detailMap;
      _ready      = true;
      injectCells();
    })
    .catch(function () { /* silently ignore */ });

  hookRenderTable();
})();
<\/script>`;
}

// ── Block rules injection ─────────────────────────────────────────────────────
// Fetches per-brand per-region rule impact from /api/coverage-vin/brand-rules
// and injects:
//   1. An amber blocked segment appended to the right of each coverage bar
//   2. A "Block Rules" section in each brand's drill-down drawer
function blockRulesHtml(): string {
  return `
<style>
  .block-rule-badge {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 10px; font-weight: 600; color: #B45309;
    background: #FFFBEB; border: 1px solid #FDE68A;
    border-radius: 5px; padding: 1px 6px; margin-left: 6px;
    vertical-align: middle; white-space: nowrap;
  }
  .drill-block-section {
    margin-top: 14px; padding-top: 14px;
    border-top: 1px solid #F0F0F5;
  }
  .drill-block-hdr {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .07em; color: #B45309; margin-bottom: 10px;
    display: flex; align-items: center; gap: 6px;
  }
  .drill-block-rule {
    display: flex; align-items: center; justify-content: space-between;
    padding: 4px 8px; border-radius: 6px; background: #FFFBEB;
    border: 1px solid #FDE68A; margin-bottom: 4px;
    font-size: 11px; gap: 8px;
  }
  .drill-block-rule-name { color: #374151; flex: 1; min-width: 0; font-weight: 600; }
  .drill-block-rule-pct  { font-weight: 700; color: #B45309; white-space: nowrap; }
  .drill-block-rule-bar  {
    width: 48px; height: 4px; background: #FDE68A;
    border-radius: 2px; overflow: hidden; flex-shrink: 0;
  }
  .drill-block-rule-bar-fill { height: 100%; background: #F59E0B; border-radius: 2px; }
</style>
<script>
(function () {
  /* Hardcoded block-rule impact data from VIN sample analysis (2026-04-29).
     brand (normalised UPPERCASE) → { ALL, UK, NZ } percentage of VINs blocked. */
  var RULE_DATA = {
    TOYOTA:   { ALL: 4.78,  UK: 2.87,  NZ: 6.68  },
    RENAULT:  { ALL: 1.50,  UK: 2.99,  NZ: 0.00  },
    VAUXHALL: { ALL: 10.93, UK: 21.86, NZ: 0.00  },
    FORD:     { ALL: 9.18,  UK: 10.58, NZ: 7.78  },
    NISSAN:   { ALL: 0.46,  UK: 0.00,  NZ: 0.92  },
    SUZUKI:   { ALL: 24.89, UK: 9.09,  NZ: 40.68 },
    LEXUS:    { ALL: 5.56,  UK: 5.56,  NZ: 5.56  },
    PEUGEOT:  { ALL: 24.33, UK: 24.76, NZ: 23.90 },
    CITROEN:  { ALL: 20.34, UK: 16.78, NZ: 23.90 },
    DS:       { ALL: 20.01, UK: 10.00, NZ: 30.02 },
    TESLA:    { ALL: 43.49, UK: 40.30, NZ: 46.68 },
    JEEP:     { ALL: 2.71,  UK: 5.41,  NZ: 0.00  },
  };

  function norm(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

  function activeRegion() {
    var t = document.querySelector('.tab.active');
    return t ? (t.dataset.r || 'ALL') : 'ALL';
  }

  function getImpact(key, region) {
    var entry = RULE_DATA[key];
    if (!entry) return 0;
    var r = region.toUpperCase();
    return (r === 'ALL' || entry[r] == null) ? (entry['ALL'] || 0) : entry[r];
  }

  /* ── Remove our injected elements (badges + drill sections) ── */
  function clearInjected() {
    document.querySelectorAll('.block-rule-badge').forEach(function (el) { el.remove(); });
    document.querySelectorAll('.drill-block-section').forEach(function (el) { el.remove(); });
  }

  /* ── Adjust the coverage bar and label in-place ── */
  function injectBars() {
    var region = activeRegion();
    document.querySelectorAll('.brand-row').forEach(function (row) {
      /* Skip if we've already adjusted this row in this render cycle */
      if (row.dataset.ruleInjected) return;
      row.dataset.ruleInjected = '1';

      var nameCell = row.querySelector('.name-cell');
      if (!nameCell) return;
      var key    = norm(nameCell.textContent);
      var impact = getImpact(key, region);
      if (impact <= 0) return;

      /* Shrink the blue fill bar by the impact amount */
      var fill = row.querySelector('.rate-fill');
      if (fill) {
        var origW  = parseFloat(fill.style.width) || 0;
        var adjW   = Math.max(0, origW - impact);
        fill.style.width = adjW + '%';
      }

      /* Rewrite the coverage % label to the adjusted value */
      var lbl = row.querySelector('.rate-lbl');
      if (lbl) {
        var origPct = parseFloat(lbl.textContent) || 0;
        var adjPct  = Math.max(0, origPct - impact);
        lbl.textContent = adjPct.toFixed(1) + '%';

        /* Small badge showing the deduction so users know why it's lower */
        var badge = document.createElement('span');
        badge.className = 'block-rule-badge';
        badge.title = 'Adjusted for block rules (-' + impact.toFixed(1) + '% of VINs blocked in sample)';
        badge.innerHTML = '&#9888; -' + impact.toFixed(1) + '%';
        lbl.parentNode.insertBefore(badge, lbl.nextSibling);
      }
    });
  }

  /* ── Block rule impact section in drill-down ── */
  function injectDrillSections() {
    document.querySelectorAll('.drill-row').forEach(function (drillRow) {
      var inner = drillRow.querySelector('.drill-inner');
      if (!inner || inner.querySelector('.drill-block-section')) return;

      var uid      = drillRow.id.replace('drill_', '');
      var brandRow = document.getElementById('brow_' + uid);
      if (!brandRow) return;
      var nameCell = brandRow.querySelector('.name-cell');
      if (!nameCell) return;
      var key   = norm(nameCell.textContent);
      var entry = RULE_DATA[key];
      if (!entry) return;

      var section = document.createElement('div');
      section.className = 'drill-block-section';

      var hdrHtml = '<div class="drill-block-hdr">'
        + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B45309" stroke-width="2.5">'
        + '<path d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>'
        + '</svg>Block Rule Impact'
        + '<span style="font-size:9px;font-weight:400;color:#9CA3AF;margin-left:4px">VIN sample analysis</span>'
        + '</div>';

      var regionsHtml = '';
      ['UK', 'NZ', 'US', 'AU'].forEach(function (r) {
        var pct = entry[r];
        if (pct == null || pct === 0) return;
        var barW = Math.min(100, pct * 2); /* 50% impact = full bar */
        regionsHtml += '<div class="drill-block-rule">'
          + '<span class="drill-block-rule-name">' + r + '</span>'
          + '<div class="drill-block-rule-bar"><div class="drill-block-rule-bar-fill" style="width:' + barW + '%"></div></div>'
          + '<span class="drill-block-rule-pct">-' + pct.toFixed(1) + '%</span>'
          + '</div>';
      });

      if (!regionsHtml) return;
      section.innerHTML = hdrHtml + regionsHtml;
      inner.appendChild(section);
    });
  }

  /* ── Adjust the hero banner (overall rate + Supported/Unsupported counts) ── */
  function adjustHero(brands) {
    var region = activeRegion();
    var totalBlocked = 0;
    brands.forEach(function (b) {
      var impact = getImpact(norm(b.make), region);
      if (impact > 0) totalBlocked += Math.round(b.total * impact / 100);
    });
    if (totalBlocked === 0) return;

    var total      = brands.reduce(function (s, b) { return s + b.total; }, 0);
    var covered    = brands.reduce(function (s, b) { return s + b.y; }, 0);
    var adjCovered = Math.max(0, covered - totalBlocked);
    var adjRate    = total ? (adjCovered / total * 100).toFixed(2) : '0.00';

    var heroRate = document.getElementById('heroRate');
    if (heroRate) heroRate.textContent = adjRate + '%';

    var heroStats = document.getElementById('heroStats');
    if (heroStats) {
      var fmtN = typeof fmt === 'function' ? fmt : function (n) { return n.toLocaleString(); };
      var minN = parseInt(((document.getElementById('minN') || {}).value) || '10');
      var filteredCount = brands.filter(function (b) { return b.total >= minN; }).length;
      heroStats.innerHTML = [
        ['Supported',   fmtN(adjCovered)],
        ['Unsupported', fmtN(total - adjCovered)],
        ['Brands',      filteredCount],
      ].map(function (r) {
        return '<div class="hstat"><div class="hv">' + r[1] + '</div><div class="hl">' + r[0] + '</div></div>';
      }).join('');
    }
  }

  function injectAll() {
    clearInjected();
    /* Clear the per-row injection guard so injectBars runs fresh */
    document.querySelectorAll('.brand-row[data-rule-injected]').forEach(function (r) {
      delete r.dataset.ruleInjected;
    });
    injectBars();
    injectDrillSections();
  }

  /* ── Hook renderHero to adjust the headline numbers ── */
  function hookRenderHero() {
    if (typeof renderHero === 'undefined') { setTimeout(hookRenderHero, 80); return; }
    var _origHero = renderHero;
    renderHero = function (brands) {
      _origHero(brands);
      adjustHero(brands);
    };
    /* renderHero already ran before we got here — adjust the DOM immediately */
    var currentBrands = (typeof DATA !== 'undefined' && typeof region !== 'undefined')
      ? (DATA[region] || []) : [];
    if (currentBrands.length > 0) adjustHero(currentBrands);
  }

  /* ── Hook into renderTable so we re-inject on every tab/sort change ── */
  function hookRenderTable() {
    if (typeof renderTable === 'undefined') { setTimeout(hookRenderTable, 80); return; }
    var _orig = renderTable;
    renderTable = function (brands) {
      _orig(brands);
      setTimeout(injectAll, 30);
    };
    injectAll();
  }

  hookRenderHero();
  hookRenderTable();
})();
<\/script>`;
}

// ── Inject the trend chart before the KPI cards ───────────────────────────────
function injectTrendChart(html: string): string {
  const MARKER = '<div class="kpis" id="kpis">';
  const idx = html.indexOf(MARKER);
  if (idx === -1) return html;
  return html.slice(0, idx) + trendChartHtml() + "\n" + html.slice(idx);
}

// ── VIN insights injection ────────────────────────────────────────────────────
// Fetches /api/coverage-vin/insights and renders three clean tables per brand:
//   1. Year coverage sparkline (decoded from VIN position 10)
//   2. Model coverage table
//   3. WMI / assembly plant coverage table
function vinInsightsHtml(): string {
  return `
<style>
  .drill-insights-section {
    margin-top: 14px; padding-top: 14px;
    border-top: 1px solid #F0F0F5;
  }
  .vi-hdr {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .07em; color: #3632FF; margin-bottom: 12px;
    display: flex; align-items: center; gap: 6px;
  }
  .vi-sub {
    font-size: 9px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .06em; color: #9CA3AF; margin-bottom: 6px;
  }
  .vi-divider { margin-top: 14px; padding-top: 12px; border-top: 1px solid #F0F0F5; }

  /* Year sparkline */
  .vi-year-wrap { display: flex; align-items: flex-end; gap: 3px; height: 32px; margin-bottom: 4px; overflow: visible; }
  .vi-year-bar  {
    flex: 1; border-radius: 2px 2px 0 0; min-width: 6px; cursor: default;
    transition: opacity .1s; position: relative;
  }
  .vi-year-bar:hover { opacity: .75; }
  /* Instant CSS tooltip — no browser title delay */
  .vi-year-bar::after {
    content: attr(data-tip);
    position: absolute; bottom: calc(100% + 5px); left: 50%;
    transform: translateX(-50%);
    background: #1F2937; color: #fff;
    font-size: 11px; font-family: Inter, sans-serif; font-weight: 500;
    white-space: nowrap; padding: 4px 8px; border-radius: 5px;
    pointer-events: none; opacity: 0; z-index: 99;
  }
  .vi-year-bar:hover::after { opacity: 1; }
  .vi-year-legend { display: flex; gap: 10px; align-items: center; margin-top: 4px; }
  .vi-year-leg-dot { width: 8px; height: 8px; border-radius: 2px; display: inline-block; margin-right: 3px; }

  /* Coverage tables */
  .vi-table {
    width: 100%; border-collapse: collapse; font-size: 11px;
    table-layout: fixed;
  }
  .vi-table th {
    text-align: left; font-size: 9px; font-weight: 700;
    text-transform: uppercase; letter-spacing: .05em;
    color: #9CA3AF; padding: 0 8px 5px 0; border-bottom: 1px solid #F0F0F5;
    white-space: nowrap;
  }
  .vi-table th.r { text-align: right; }
  .vi-table td {
    padding: 5px 8px 5px 0; border-bottom: 1px solid #F8F8FB;
    vertical-align: middle; color: #374151;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .vi-table td.r { text-align: right; white-space: nowrap; }
  .vi-table tr:last-child td { border-bottom: none; }
  .vi-pct-cell { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
  .vi-pct-bar  { width: 48px; height: 4px; background: #F3F4F6; border-radius: 2px; overflow: hidden; flex-shrink: 0; }
  .vi-pct-fill { height: 100%; border-radius: 2px; }
  .vi-pct-val  { font-weight: 700; font-size: 10px; width: 32px; text-align: right; flex-shrink: 0; }
  .vi-code     { font-family: monospace; font-size: 9px; font-weight: 700;
                 color: #9CA3AF; margin-right: 4px; }
  .vi-vins     { font-size: 9px; color: #9CA3AF; }

  /* Two-column layout for model + WMI tables */
  .vi-tables-row {
    display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start;
  }
  .vi-col-full { margin-top: 14px; padding-top: 12px; border-top: 1px solid #F0F0F5; }
</style>
<script>
(function () {
  var _insights = null;

  function norm(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

  function clearInsights() {
    document.querySelectorAll('.drill-insights-section').forEach(function (el) { el.remove(); });
  }

  function pctColor(p) {
    return p >= 80 ? '#10B981' : p >= 40 ? '#F59E0B' : '#EF4444';
  }

  function pctCell(pct) {
    var color = pctColor(pct);
    return '<td class="r">'
      + '<div class="vi-pct-cell">'
      + '<div class="vi-pct-bar"><div class="vi-pct-fill" style="width:' + pct + '%;background:' + color + '"></div></div>'
      + '<span class="vi-pct-val" style="color:' + color + '">' + pct.toFixed(0) + '%</span>'
      + '</div></td>';
  }

  /* ── Year sparkline ── */
  function yearSparkline(yc) {
    if (!yc || yc.length === 0) return '';
    var maxTotal = 0;
    yc.forEach(function (y) { if (y.total > maxTotal) maxTotal = y.total; });
    if (maxTotal === 0) return '';

    var bars   = '';
    var lbls   = '';
    yc.forEach(function (y) {
      var h     = Math.max(4, Math.round((y.total / maxTotal) * 32));
      var color = pctColor(y.pct);
      var tip   = y.year + ': ' + y.pct.toFixed(0) + '% (' + y.covered + '/' + y.total + ' VINs)';
      bars += '<div class="vi-year-bar" style="height:' + h + 'px;background:' + color + '" data-tip="' + tip + '"></div>';
      var yr     = parseInt(y.year, 10);
      var showLbl = (yr % 5 === 0);
      lbls += '<div style="flex:1;min-width:6px;font-size:8px;color:#9CA3AF;text-align:center;overflow:hidden">'
        + (showLbl ? y.year : '') + '</div>';
    });

    return '<div class="vi-sub">Year Coverage</div>'
      + '<div class="vi-year-wrap">' + bars + '</div>'
      + '<div style="display:flex;gap:3px;margin-top:1px;margin-bottom:4px">' + lbls + '</div>'
      + '<div class="vi-year-legend">'
      + '<span style="font-size:9px;color:#9CA3AF"><span class="vi-year-leg-dot" style="background:#10B981"></span>≥80%</span>'
      + '<span style="font-size:9px;color:#9CA3AF"><span class="vi-year-leg-dot" style="background:#F59E0B"></span>40–79%</span>'
      + '<span style="font-size:9px;color:#9CA3AF"><span class="vi-year-leg-dot" style="background:#EF4444"></span>&lt;40%</span>'
      + '</div>';
  }

  /* ── Model table ── */
  function modelTable(mc) {
    if (!mc || mc.length === 0) return '<span style="font-size:10px;color:#9CA3AF;font-style:italic">No data</span>';
    var rows = mc.map(function (m) {
      var isUnknown = m.model === '(unknown)';
      var nameStyle = isUnknown ? 'color:#9CA3AF;font-style:italic' : '';
      return '<tr>'
        + '<td title="' + m.model + '" style="' + nameStyle + '">' + m.model + '</td>'
        + '<td class="r"><span class="vi-vins">' + m.total + '</span></td>'
        + pctCell(m.pct)
        + '</tr>';
    }).join('');
    return '<table class="vi-table">'
      + '<colgroup><col style="width:auto"><col style="width:40px"><col style="width:100px"></colgroup>'
      + '<thead><tr>'
      + '<th>Model</th>'
      + '<th class="r">VINs</th>'
      + '<th class="r">Coverage</th>'
      + '</tr></thead>'
      + '<tbody>' + rows + '</tbody>'
      + '</table>';
  }

  /* ── WMI table ── */
  function wmiTable(wc) {
    if (!wc || wc.length === 0) return '<span style="font-size:10px;color:#9CA3AF;font-style:italic">No data</span>';
    var rows = wc.map(function (w) {
      var nameCell = w.manufacturer
        ? '<td title="' + w.wmi + ' – ' + w.manufacturer + '">'
          + '<span class="vi-code">' + w.wmi + '</span>' + w.manufacturer + '</td>'
        : '<td><span class="vi-code">' + w.wmi + '</span></td>';
      return '<tr>'
        + nameCell
        + '<td class="r"><span class="vi-vins">' + w.total + '</span></td>'
        + pctCell(w.pct)
        + '</tr>';
    }).join('');
    return '<table class="vi-table">'
      + '<colgroup><col style="width:auto"><col style="width:40px"><col style="width:100px"></colgroup>'
      + '<thead><tr>'
      + '<th>Assembly Plant</th>'
      + '<th class="r">VINs</th>'
      + '<th class="r">Coverage</th>'
      + '</tr></thead>'
      + '<tbody>' + rows + '</tbody>'
      + '</table>';
  }

  function injectInsights() {
    if (!_insights) return;

    document.querySelectorAll('.drill-row').forEach(function (drillRow) {
      var inner = drillRow.querySelector('.drill-inner');
      if (!inner || inner.querySelector('.drill-insights-section')) return;

      var uid      = drillRow.id.replace('drill_', '');
      var brandRow = document.getElementById('brow_' + uid);
      if (!brandRow) return;
      var nameCell = brandRow.querySelector('.name-cell');
      if (!nameCell) return;
      var key     = norm(nameCell.textContent);
      var insight = _insights[key];
      if (!insight) return;

      var mc = insight.model_coverage || [];
      var wc = insight.wmi_coverage   || [];
      var yc = insight.year_coverage  || [];
      if (mc.length === 0 && wc.length === 0 && yc.length === 0) return;

      var section = document.createElement('div');
      section.className = 'drill-insights-section';
      section.innerHTML =
        '<div class="vi-hdr">'
          + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3632FF" stroke-width="2.5">'
          + '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>'
          + 'VIN Insights'
          + '<span style="font-size:9px;font-weight:400;color:#9CA3AF;margin-left:4px">from sample analysis</span>'
        + '</div>'
        /* Year sparkline — full width above tables */
        + (yc.length > 0 ? yearSparkline(yc) + '<div style="margin-bottom:14px"></div>' : '')
        /* Two-column: models | WMIs */
        + '<div class="vi-tables-row">'
          + '<div>'
            + '<div class="vi-sub">Model Coverage</div>'
            + modelTable(mc)
          + '</div>'
          + '<div>'
            + '<div class="vi-sub">Assembly Plant (WMI)</div>'
            + wmiTable(wc)
          + '</div>'
        + '</div>';

      inner.appendChild(section);
    });
  }

  function hookRenderTable() {
    if (typeof renderTable === 'undefined') { setTimeout(hookRenderTable, 80); return; }
    var _orig = renderTable;
    renderTable = function (brands) {
      _orig(brands);
      setTimeout(function () { clearInsights(); injectInsights(); }, 60);
    };
    if (_insights) injectInsights();
  }

  fetch('/api/coverage-vin/insights')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      /* Normalise keys so "LAND ROVER" → "LANDROVER" matches norm(nameCell) */
      var raw = data || {};
      _insights = {};
      Object.keys(raw).forEach(function (k) { _insights[norm(k)] = raw[k]; });
      injectInsights();
    })
    .catch(function () { /* no data */ });

  hookRenderTable();
})();
<\/script>`;
}

// ── Brands with coverage KPI card ────────────────────────────────────────────
// Hooks renderHero to append a 5th KPI card to #kpis showing how many brands
// have at least 1 covered VIN (y > 0) in the current region's dataset.
function brandsCoveredStatHtml(): string {
  return `
<style>
  /* Expand KPI grid from 4 → 5 columns on desktop */
  .kpis { grid-template-columns: repeat(5, 1fr) !important; }
  @media (max-width: 640px) {
    .kpis { grid-template-columns: 1fr 1fr !important; }
  }
</style>
<script>
(function () {
  function hookRenderHero() {
    if (typeof renderHero === 'undefined') { setTimeout(hookRenderHero, 80); return; }
    var _orig = renderHero;
    renderHero = function (brands) {
      _orig(brands);
      injectKpiCard(brands);
    };
    /* trigger immediately if data already rendered */
    var currentRegion = (typeof window.region !== 'undefined' ? window.region : null) || 'ALL';
    if (typeof DATA !== 'undefined' && DATA[currentRegion]) {
      injectKpiCard(DATA[currentRegion]);
    }
  }

  function injectKpiCard(brands) {
    var kpisEl = document.getElementById('kpis');
    if (!kpisEl) return;

    /* count ALL brands with at least 1 covered VIN — unaffected by the minN filter */
    var withCoverage = brands.filter(function (b) { return b.y > 0; }).length;
    var totalBrands  = brands.length;

    /* re-use or create the card element */
    var card = document.getElementById('kpi-brands-covered');
    if (!card) {
      card = document.createElement('div');
      card.id        = 'kpi-brands-covered';
      card.className = 'kpi';
      kpisEl.appendChild(card);
    }
    card.innerHTML = '<div class="kbar" style="background:#10B981"></div>'
      + '<div class="kpi-body">'
      + '<div class="klbl">Brands with Coverage</div>'
      + '<div class="kval" style="color:#10B981">' + withCoverage
        + '<span style="font-size:14px;font-weight:500;color:#9CA3AF"> / ' + totalBrands + '</span>'
        + '</div>'
      + '<div class="ksub">≥ 1 VIN supported</div>'
      + '</div>';
  }

  hookRenderHero();
})();
<\/script>`;
}

// ── Inject integration counts before </body> ──────────────────────────────────
function injectIntegrationCounts(html: string): string {
  const MARKER = '</body>';
  const idx = html.lastIndexOf(MARKER);
  if (idx === -1) return html;
  return (
    html.slice(0, idx) +
    integrationCountsHtml() + "\n" +
    blockRulesHtml() + "\n" +
    vinInsightsHtml() + "\n" +
    brandsCoveredStatHtml() + "\n" +
    html.slice(idx)
  );
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

  return new NextResponse(injectIntegrationCounts(injectTrendChart(html)), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
