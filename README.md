# Interpreter Metrics

Internal analytics tool. Restricted to `@partly.com` Google accounts.

---

## Setup

### 1. Database — Neon Postgres

Create a project at [neon.tech](https://neon.tech) and run migrations in order:

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

### 4. Local development

```bash
npm install
npm run dev
```

---

## Deployment — Vercel

1. Push to GitHub
2. Import into [vercel.com](https://vercel.com)
3. Add all environment variables in the Vercel dashboard
4. Deploy — Vercel handles builds automatically on every push to `main`

---

## Architecture

- **Framework:** Next.js 14 (App Router)
- **Database:** Neon Postgres via `@neondatabase/serverless`
- **Auth:** NextAuth.js v4 with Google OAuth2
- **Styling:** Tailwind CSS
- **Hosting:** Vercel
