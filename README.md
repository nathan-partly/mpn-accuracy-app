# MPN Accuracy Benchmarking

Internal tool for tracking and visualising interpreter MPN accuracy across all benchmarked brands.

Live: **https://mpn-accuracy-app.vercel.app** (Partly Google login required)

---

## How it works

Each time you run a new benchmark, you re-upload your master CSV. Every upload creates a new dated **snapshot** for each brand in the file, building up a timeline of accuracy over time. Old snapshots are never overwritten.

---

## Setup (first time only)

### 1. Database — Neon Postgres

1. Go to [neon.tech](https://neon.tech) and create a new project
2. Copy the connection string from the dashboard
3. Run the migration:
   ```bash
   psql "your-connection-string" -f migrations/001_initial_schema.sql
   ```
   This creates the tables and seeds all known brands.

### 2. Environment variables

Create `.env.local` in the project root:

```env
DATABASE_URL="postgresql://..."          # Neon connection string
GOOGLE_CLIENT_ID="..."                   # Google OAuth client ID
GOOGLE_CLIENT_SECRET="..."              # Google OAuth client secret
NEXTAUTH_SECRET="..."                    # Random string: openssl rand -base64 32
NEXTAUTH_URL="https://your-domain.com"  # Your deployment URL (localhost:3000 for dev)
```

### 3. Google OAuth credentials

In [Google Cloud Console](https://console.cloud.google.com):
- Create an OAuth 2.0 client (Web application)
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

1. Push the project to a public GitHub repo
2. Import into [vercel.com](https://vercel.com) (Hobby tier is sufficient)
3. Add all environment variables in the Vercel dashboard
4. Deploy — Vercel handles the build automatically

---

## CSV format

One row per VIN × part-type × upstream-provider combination. The `brand` column is required and must match an existing brand name exactly (e.g. `Ford`, `BMW`).

| Column | Required | Description |
|--------|----------|-------------|
| `brand` | **Yes** | e.g. `Ford` — must match an existing brand |
| `region` | No | e.g. `EU`, `US` |
| `vin` | **Yes** | Full VIN |
| `make` | No | e.g. `Ford` |
| `model` | No | e.g. `Focus` |
| `year` | No | e.g. `2022` |
| `upstream_provider` | No | e.g. `ADP`, `YQService` |
| `part_type` | **Yes** | e.g. `Front Bumper Cover` |
| `interpreter_output` | No | MPN(s) returned by the interpreter |
| `epc_output` | No | Ground truth MPN from the Original EPC |
| `pl24_output` | No | Ground truth MPN from PL24 (leave blank if not used) |
| `is_valid` | **Yes** | `true`, `false`, or blank (skipped) |
| `notes` | No | Optional context |

**`is_valid` rules:**
- `true` — at least one variant returned is a correct fitting part number (supersessions and multiple variants are fine as long as the correct one is included)
- `false` — no correct fitting part number in any variant returned
- blank — not applicable (e.g. missing diagram, missing hotspot — excluded from accuracy calculations)

A downloadable template is available on the Upload page in the app.

---

## Exporting from Google Sheets

A Google Apps Script is included at `scripts/export_sheet.gs` to export the benchmarking Google Sheet into a master CSV ready for upload.

**Steps:**
1. Open the benchmarking Google Sheet
2. Go to **Extensions → Apps Script**
3. Paste the contents of `scripts/export_sheet.gs` and save
4. Run `exportMasterCSV`
5. Authorise when prompted
6. A single file `mpn_accuracy_all_brands.csv` will appear in your Google Drive root
7. Download it and upload via the **Upload Results** page in the app

---

## Architecture

- **Framework:** Next.js 14 (App Router)
- **Database:** Neon Postgres via `@neondatabase/serverless`
- **Auth:** NextAuth.js v4 with Google OAuth2, restricted to `@partly.com`
- **Charts:** Recharts
- **Styling:** Tailwind CSS with Partly brand tokens
- **Hosting:** Vercel (Hobby tier)

### Key files

```
src/
├── app/
│   ├── page.tsx                  — Dashboard (all brands overview + global stats)
│   ├── brands/[id]/page.tsx      — Brand detail (snapshot timeline + breakdowns)
│   ├── upload/page.tsx           — CSV upload (multi-brand, creates one snapshot per brand)
│   └── api/
│       ├── brands/               — GET all brands
│       └── snapshots/            — POST new snapshot + records
├── components/
│   ├── Navbar.tsx
│   ├── KpiCard.tsx
│   ├── AccuracyBadge.tsx
│   ├── AccuracyChart.tsx
│   └── ExpandableModelTable.tsx  — Expandable model/VIN/part breakdown table
├── lib/
│   ├── db.ts                     — Neon client
│   ├── auth.ts                   — NextAuth config
│   ├── queries.ts                — All DB queries
│   └── utils.ts                  — Helpers (formatDate, accuracyPct, parseIsValid)
├── types/index.ts                — Shared TypeScript interfaces
└── middleware.ts                 — Auth guard (protects all routes)

migrations/
└── 001_initial_schema.sql        — Creates tables and seeds brands

scripts/
└── export_sheet.gs               — Google Apps Script: exports Sheet → master CSV
```
