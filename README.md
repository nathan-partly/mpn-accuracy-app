# Interpreter Metrics

Internal tool for tracking VIN coverage, MPN accuracy, and data quality across Partly's interpreter pipeline. Restricted to `@partly.com` Google accounts.

Live: **https://mpn-accuracy-app.vercel.app**

---

## Features

| Dashboard | What it shows |
|-----------|---------------|
| **Coverage** | VIN coverage rates by brand and region, derived from coverage snapshots. Includes a Coverage Rate Trend chart driven by the Data Integrations table, and an Integrations count column in the brand table. |
| **Accuracy** | MPN accuracy benchmarking by brand. Snapshot timeline, provider-level breakdown, and model/VIN drill-down. |
| **Quality** | Diagram classification and annotation quality by brand, with VIO rank and trend charts. |

---

## Setup (first time)

### 1. Database — Neon Postgres

1. Create a project at [neon.tech](https://neon.tech) and copy the connection string
2. Run migrations in order:

```bash
psql "your-connection-string" -f migrations/001_initial_schema.sql
psql "your-connection-string" -f migrations/002_quality.sql
psql "your-connection-string" -f migrations/003_coverage_snapshots.sql
psql "your-connection-string" -f migrations/004_data_integrations.sql
```

### 2. Environment variables

Create `.env.local` in the project root:

```env
DATABASE_URL="postgresql://..."          # Neon connection string
GOOGLE_CLIENT_ID="..."                   # Google OAuth client ID
GOOGLE_CLIENT_SECRET="..."              # Google OAuth client secret
NEXTAUTH_SECRET="..."                    # openssl rand -base64 32
NEXTAUTH_URL="https://your-domain.com"  # or http://localhost:3000 for dev
```

### 3. Google OAuth

In [Google Cloud Console](https://console.cloud.google.com):
- Create an OAuth 2.0 Web Application client
- Add `https://your-domain.com/api/auth/callback/google` as an authorised redirect URI
- Only `@partly.com` accounts are permitted — enforced in `src/lib/auth.ts`

### 4. Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deployment — Vercel

1. Push to GitHub
2. Import into [vercel.com](https://vercel.com)
3. Add all environment variables in the Vercel dashboard
4. Deploy — Vercel handles builds automatically on every push to `main`

---

## Accuracy benchmarking

### CSV format

One row per VIN × part-type × upstream-provider combination.

| Column | Required | Description |
|--------|----------|-------------|
| `brand` | **Yes** | e.g. `Ford` — must match an existing brand name |
| `region` | No | e.g. `EU`, `US` |
| `vin` | **Yes** | Full VIN |
| `make` | No | e.g. `Ford` |
| `model` | No | e.g. `Focus` |
| `year` | No | e.g. `2022` |
| `upstream_provider` | No | e.g. `ADP`, `YQService` |
| `part_type` | **Yes** | e.g. `Front Bumper Cover` |
| `interpreter_output` | No | MPN(s) returned by the interpreter |
| `epc_output` | No | Ground truth MPN from the Original EPC |
| `trusted_third_party_output` | No | MPN from a trusted third-party source (non-original EPC) |
| `is_valid` | **Yes** | `true`, `false`, or blank (skipped) |
| `notes` | No | Optional context |

**`is_valid` rules:**
- `true` — at least one returned variant is a correct fitting part number (supersessions OK)
- `false` — no correct fitting part number in any returned variant
- blank — not applicable (missing diagram, missing hotspot — excluded from calculations)

A downloadable template is available on the Upload page.

### Exporting from Google Sheets

A Google Apps Script at `scripts/export_sheet.gs` exports the benchmarking Sheet into a master CSV ready for upload.

1. Open the benchmarking Google Sheet
2. Go to **Extensions → Apps Script**, paste `scripts/export_sheet.gs`, and save
3. Run `exportMasterCSV` and authorise when prompted
4. Download `mpn_accuracy_all_brands.csv` from your Google Drive root
5. Upload via **Upload Results** in the app

### Syncing pending brands from Coverage

The Accuracy page has a **Sync from Coverage** button. Clicking it reads the latest coverage snapshot, finds every brand with at least one covered VIN, and adds any that are not already tracked as pending-benchmarking entries.

---

## VIN Coverage dashboard

The dashboard is stored as an HTML snapshot in the database (uploaded via **New Snapshot**) and served from `/api/coverage-html`. The app injects two additions at serve time:

- **Coverage Rate Trend chart** — driven by the Data Integrations table (see below)
- **Integrations column** — count of live data integrations per brand, with details in the expanded drawer

### Data Integrations

Manage at `/coverage/integrations`. Each integration represents an OEM or third-party data source:

| Field | Description |
|-------|-------------|
| **Name** | Integration name (e.g. "HONDA INDIRECT") |
| **Type** | Online or Offline |
| **Relationship** | Direct or Third-party |
| **Brands** | Comma-separated list of covered makes |
| **Total VIO %** | Total global VIO % this integration covers |
| **Incremental VIO %** | New VIO % added on top of existing coverage |
| **Integration Date** | Actual date if live; future dates appear as projected targets (dashed line) |

The Coverage Rate Trend chart derives its data from this table:
- **Coverage Rate** (blue) — cumulative sum of Incremental VIO % across all integrations, in date order
- **Offline Coverage** (green) — cumulative sum of Total VIO % from Offline integrations

---

## Quality dashboard

Upload a quality CSV snapshot via the Quality tab. The dashboard shows:
- Diagram classification % and annotation % by brand
- VIO rank and global VIO % per brand
- Trend charts for top brands (interactive legend, toggle lines on/off)
- Level 1 / Level 2 / Level 3 breakdowns with VIO coverage per level

---

## Architecture

- **Framework:** Next.js 14 (App Router), all data pages use `force-dynamic`
- **Database:** Neon Postgres via `@neondatabase/serverless` (HTTP driver — no native transactions; rollback by DELETE on failure)
- **Auth:** NextAuth.js v4 with Google OAuth2, restricted to `@partly.com`
- **Charts:** Recharts (accuracy/quality), Chart.js 4 (coverage trend — injected into iframe)
- **Styling:** Tailwind CSS with Partly brand tokens
- **Hosting:** Vercel (auto-deploy on push to `main`)

### Key files

```
src/
├── app/
│   ├── accuracy/page.tsx             — Accuracy benchmarking dashboard
│   ├── quality/page.tsx              — Quality dashboard
│   ├── coverage/
│   │   ├── page.tsx                  — Coverage iframe wrapper
│   │   └── integrations/page.tsx     — Data Integrations CRUD table
│   ├── brands/[id]/page.tsx          — Brand detail (snapshot timeline + breakdowns)
│   ├── upload/page.tsx               — Accuracy CSV upload
│   └── api/
│       ├── brands/                   — GET all brands; POST new brand
│       │   └── sync-coverage/        — POST: sync pending brands from coverage snapshot
│       ├── snapshots/                — POST new accuracy snapshot
│       ├── records/                  — GET records for a snapshot
│       ├── coverage/                 — Coverage snapshot upload (CSV + HTML)
│       ├── coverage-html/            — Serves coverage dashboard with injected chart
│       ├── coverage-history/         — GET coverage rate history from snapshots
│       ├── coverage-csv/             — GET latest coverage snapshot as CSV
│       ├── data-integrations/        — CRUD for data integrations
│       └── quality/                  — Quality snapshot upload + data
├── components/
│   ├── Navbar.tsx
│   ├── KpiCard.tsx
│   ├── AccuracyBadge.tsx
│   ├── AccuracyBrandsTable.tsx       — Filterable/sortable accuracy brand table
│   ├── AccuracyChart.tsx
│   ├── AccuracySnapshotHistory.tsx
│   ├── CoverageUploadClient.tsx
│   ├── DeleteSnapshotButton.tsx
│   ├── ExpandableModelTable.tsx      — Model/VIN/part drill-down (accuracy)
│   ├── LevelBadge.tsx
│   ├── QualityBrandTable.tsx
│   ├── QualityTrendCharts.tsx        — Interactive trend charts with legend
│   ├── SnapshotDiffPanel.tsx
│   └── SyncCoverageButton.tsx        — Syncs pending brands from coverage snapshot
├── lib/
│   ├── db.ts                         — Neon client
│   ├── auth.ts                       — NextAuth config (partly.com domain restriction)
│   ├── queries.ts                    — All DB queries
│   └── utils.ts                      — Helpers
├── types/index.ts                    — Shared TypeScript interfaces
└── middleware.ts                     — Auth guard (protects all routes)

migrations/
├── 001_initial_schema.sql            — brands, benchmark_snapshots, benchmark_records
├── 002_quality.sql                   — quality_snapshots, quality_brand_data
├── 003_coverage_snapshots.sql        — coverage_snapshots
└── 004_data_integrations.sql         — data_integrations

scripts/
└── export_sheet.gs                   — Google Apps Script: exports Sheet → master CSV
```
