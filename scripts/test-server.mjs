import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const state = await mkdtemp(join(tmpdir(), "last-ditch-tests-"));
const worker = spawn(
  process.execPath,
  [
    "node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--port",
    "8791",
    "--persist-to",
    state,
  ],
  { stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => worker.kill(signal));
worker.on("exit", async (code) => {
  await rm(state, { recursive: true, force: true });
  process.exitCode = code ?? 0;
});
