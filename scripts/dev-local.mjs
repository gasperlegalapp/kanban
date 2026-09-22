// Runs the app against the LOCAL embedded database (./.pglite) with the
// pick-your-name login, even though .env.local points at the live Supabase
// database. Use this for trying changes without touching real data:
//
//   node scripts/dev-local.mjs            (port 3000)
//   node scripts/dev-local.mjs 3001
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.argv[2] ?? "3000";
const child = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", root, "--port", port], {
  stdio: "inherit",
  env: { ...process.env, USE_PGLITE: "1", AUTH_MODE: "dev" },
});
child.on("exit", (code) => process.exit(code ?? 0));
