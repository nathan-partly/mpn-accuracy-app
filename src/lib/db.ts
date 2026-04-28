import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// fetchOptions: { cache: "no-store" } tells Next.js's extended fetch cache
// never to cache responses from the Neon HTTP driver. Without this, Next.js 14
// caches full-table-scan query results even with force-dynamic routes, causing
// stale JSONB data to be returned after writes.
export const sql = neon(process.env.DATABASE_URL, {
  fetchOptions: { cache: "no-store" },
});
