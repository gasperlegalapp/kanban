import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (the embedded local database) ships WASM and Node-only code that
  // must not be bundled. The Postgres driver is excluded for the same reason.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  env: {
    // Lets the database layer find ./drizzle and ./.pglite even when the dev
    // server is launched from another working directory.
    CASECONTROL_ROOT: __dirname,
  },
  experimental: {
    serverActions: {
      // Attachments are uploaded through a server action.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
