# MPN Accuracy Benchmarking

Internal tool for tracking and visualising interpreter accuracy across all benchmarked brands.

---

## Setup

### 1. Database — Neon Postgres (recommended, free tier)

1. Go to [neon.tech](https://neon.tech) and create a new project (takes ~30 seconds)
2. Copy the connection string from the dashboard
3. Run the migration:
   ```bash
   # Install psql if needed: brew install postgresql
   psql "your-connection-string" -f migrations/001_initial_schema.sql
   ```
   This creates the three tables and seeds all the known brands.

### 2. Google OAuth credentials

Post in **#eng-platform** on Slack and ask for a Google OAuth2 client:
- App name: `MPN Accuracy Benchmarking`
- Redirect URI: `https://<your-domain>/api/auth/callback/google`
- You'll receive a `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

### 3. Environment variables

Copy `.env.example` to `.env.local` and fill in your values:
```bash
cp .env.example .env.local
```

For `NEXTAUTH_SECRET`, generate one with:
```bash
openssl rand -base64 32
```

### 4. Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deployment — Vercel (recommended)

1. Push the project to a GitHub repo
2. Import into [vercel.com](https://vercel.com)
3. Add all environment variables from `.env.example` in the Vercel dashboard
4. Deploy — Vercel handles the build automatically

**Important:** Set `NEXTAUTH_URL` to your exact deployment URL (e.g. `https://mpn-accuracy.vercel.app`).

---

## Migrating data from the Google Sheet

A Google Apps Script is included at `scripts/export_sheet.gs` to export the existing Google Sheet data into flat CSV files ready for import.

**Steps:**
1. Open the benchmarking Google Sheet
2. Go to **Extensions → Apps Script**
3. Paste the contents of `scripts/export_sheet.gs` into the editor
4. Click **Run → exportAllBrandsToCSV**
5. Authorise when prompted
6. CSV files will appear in your Google Drive root folder — one per brand
7. Download each CSV and upload via the **Upload Results** page in the app
8. Set the snapshot date to the date the original benchmarking was performed

**Note on `is_valid` values:** The script infers validity from the `Analysis` column in the sheet. Any rows where is_valid is left blank should be reviewed manually and can be updated via the manual entry form.

---

## CSV format for uploads

One row per VIN × part-type combination:

| Column | Required | Description |
|--------|----------|-------------|
| `region` | No | e.g. `EU` |
| `vin` | **Yes** | Full VIN |
| `make` | No | e.g. `Peugeot` |
| `model` | No | e.g. `3008` |
| `year` | No | e.g. `2021` |
| `upstream_provider` | No | e.g. `ADP` |
| `part_type` | **Yes** | e.g. `Front Bumper Cover` |
| `interpreter_output` | No | Part number(s) returned by interpreter |
| `epc_output` | No | Ground truth from EPC |
| `is_valid` | **Yes** | `true`, `false`, or blank (skipped) |
| `notes` | No | Optional context |

**`is_valid` rules (Nathan's definition):**
- `true` — at least one variant returned is a correct fitting part number (supersessions are fine; multiple variants are fine as long as the correct one is there)
- `false` — no correct fitting part number in any variant returned
- blank — not applicable (e.g. missing diagram / missing hotspot — excluded from accuracy calculations)

---

## Architecture

- **Framework:** Next.js 14 (App Router)
- **Database:** Neon Postgres via `@neondatabase/serverless`
- **Auth:** NextAuth.js v4 with Google OAuth2, restricted to `@partly.com`
- **Charts:** Recharts
- **Styling:** Tailwind CSS with Partly brand tokens
- **Hosting:** Vercel

### Key files

```
src/
├── app/
│   ├── page.tsx              — Dashboard (all brands overview)
│   ├── brands/[id]/page.tsx  — Brand detail (timeline + breakdown)
│   ├── upload/page.tsx       — CSV upload + manual entry
│   └── api/
│       ├── brands/           — GET all brands, POST new brand
│       ├── snapshots/        — POST new snapshot + records
│       └── records/          — POST individual record
├── components/
│   ├── Navbar.tsx
│   ├── KpiCard.tsx
│   ├── AccuracyBadge.tsx
│   └── AccuracyChart.tsx
├── lib/
│   ├── db.ts                 — Neon client
│   ├── auth.ts               — NextAuth config
│   ├── queries.ts            — All DB queries
│   └── utils.ts              — Helpers
└── middleware.ts             — Auth guard (protects all routes)
```
