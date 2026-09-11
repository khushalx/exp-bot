import "./sites-env.mjs";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

// Use an absolute env path because Wrangler resolves it against the built
// configuration directory. Never copy secrets into the build output.
const cli = new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url);
const args = process.argv.slice(2);
const child = spawn(process.execPath, [fileURLToPath(cli), "dev",
  "--config", "dist/server/wrangler.json", "--env-file", fileURLToPath(new URL("../.env", import.meta.url)),
  "--local", "--persist-to", ".wrangler/state", "--ip", "127.0.0.1", "--inspector-port", "0", ...args], { stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 0; });
