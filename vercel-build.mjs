// Vercel build using the Build Output API (https://vercel.com/docs/build-output-api/v3).
//
// Why this instead of letting Vercel auto-detect functions:
//   - This is a pnpm monorepo whose backend is authored for esbuild "bundler"
//     module resolution (extensionless imports, default imports of CJS deps).
//     Vercel's @vercel/node would re-compile that source with nodenext rules
//     and fail. Here we bundle the Express app with the project's OWN battle-
//     tested esbuild config and hand Vercel a finished artifact — no recompile.
//
// Output produced:
//   .vercel/output/
//     config.json                      routing (api -> function, rest -> SPA)
//     static/                          the built frontend (CDN-served)
//     functions/api.func/              the Express app as one serverless function
//
import { execSync } from "node:child_process";
import { rm, mkdir, cp, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, ".vercel", "output");

function run(cmd, env) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });
}

// 1. Bundle the backend (produces artifacts/api-server/dist/vercel.mjs + deps).
run("pnpm --filter @workspace/api-server run build");

// 2. Build the frontend. Its vite.config requires PORT and BASE_PATH; BASE_PATH
//    is "/" because the SPA is served from the domain root.
run("pnpm --filter @workspace/realaize run build", { PORT: "3000", BASE_PATH: "/" });

// 3. Reset the Build Output directory.
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

// 4. Static frontend -> .vercel/output/static
await cp(
  path.join(root, "artifacts/realaize/dist/public"),
  path.join(out, "static"),
  { recursive: true },
);

// 5. Backend bundle -> .vercel/output/functions/api.func
const funcDir = path.join(out, "functions", "api.func");
await mkdir(funcDir, { recursive: true });
await cp(path.join(root, "artifacts/api-server/dist"), funcDir, { recursive: true });
await writeFile(
  path.join(funcDir, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs20.x",
      handler: "vercel.mjs",
      launcherType: "Nodejs",
      // Express parses its own body; don't let the launcher consume the stream.
      shouldAddHelpers: false,
      supportsResponseStreaming: true,
      // Co-locate with the Supabase eu-west-1 database.
      regions: ["fra1"],
    },
    null,
    2,
  ),
);

// 6. Routing config.
await writeFile(
  path.join(out, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        // Serve real static assets first (JS/CSS/images/index.html).
        { handle: "filesystem" },
        // API -> the Express serverless function.
        { src: "^/api(?:/.*)?$", dest: "/api" },
        // Everything else is a client-side route -> SPA shell.
        { src: "/.*", dest: "/index.html" },
      ],
    },
    null,
    2,
  ),
);

console.log("\n✓ Build Output written to .vercel/output");
