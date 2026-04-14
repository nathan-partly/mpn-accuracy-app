/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@neondatabase/serverless"],
    // Disable client-side router cache for dynamic pages so navigating back
    // always fetches fresh data rather than serving a stale cached render.
    staleTimes: {
      dynamic: 0,
    },
  },
};

module.exports = nextConfig;
