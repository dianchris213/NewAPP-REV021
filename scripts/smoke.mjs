/**
 * Post-build / post-deploy smoke test.
 *
 * Usage:
 *   bun run smoke                       # boots `vite preview` and checks it
 *   SMOKE_URL=https://app.example.com bun run smoke   # checks a deployment
 */
import { spawn } from "node:child_process";

const ROUTES = ["/", "/wallet", "/settings", "/analytics"];
const EXTERNAL = process.env.SMOKE_URL;
const BASE = EXTERNAL ?? "http://localhost:4173";

async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not become ready at ${url}`);
}

async function checkRoutes() {
  const failures = [];
  for (const route of ROUTES) {
    const url = `${BASE}${route}`;
    try {
      const res = await fetch(url, { headers: { accept: "text/html" } });
      const body = await res.text();
      if (!res.ok) failures.push(`${route} -> HTTP ${res.status}`);
      else if (!body.includes("<html")) failures.push(`${route} -> no HTML document returned`);
      else console.log(`ok   ${route} (${res.status}, ${body.length} bytes)`);
    } catch (error) {
      failures.push(`${route} -> ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return failures;
}

let server;
if (!EXTERNAL) {
  server = spawn("bunx", ["vite", "preview", "--port", "4173", "--strictPort"], {
    stdio: ["ignore", "inherit", "inherit"],
  });
}

let exitCode = 0;
try {
  await waitForServer(BASE);
  const failures = await checkRoutes();
  if (failures.length) {
    console.error("\nSmoke test FAILED:\n" + failures.map((f) => ` - ${f}`).join("\n"));
    exitCode = 1;
  } else {
    console.log(`\nSmoke test passed for ${BASE}`);
  }
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  server?.kill("SIGTERM");
}
process.exit(exitCode);
