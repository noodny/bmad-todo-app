import { spawn } from "node:child_process";

function run(name, cmd, args) {
  let child;
  try {
    child = spawn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      detached: true,
    });
  } catch (err) {
    console.error(`[${name}] Failed to spawn:`, err.message);
    process.exit(1);
  }

  child.unref();
  const prefix = `[${name}]`;
  child.stdout.on("data", (d) => process.stdout.write(`${prefix} ${d}`));
  child.stderr.on("data", (d) => process.stderr.write(`${prefix} ${d}`));
  child.on("exit", (code, signal) => {
    if (signal) {
      // Process was killed by signal; exit handler will clean up.
      return;
    }
    if (code !== 0) {
      process.exitCode = code ?? 1;
      shutdown("SIGTERM");
    }
  });
  return child;
}

const server = run("server", "npm", ["run", "dev", "--prefix", "server"]);
const client = run("client", "npm", ["run", "dev", "--prefix", "client"]);

let shuttingDown = false;
let shutdownTimeout = null;

function shutdown(sig) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of [server, client]) {
    if (child.pid && child.pid > 0) {
      try {
        process.kill(-child.pid, sig);
      } catch {
        // Process group already gone.
      }
    }
  }

  // Force kill after grace period if children don't exit cleanly
  shutdownTimeout = setTimeout(() => {
    console.error(
      "[orchestrator] Children did not exit within grace period; force-killing...",
    );
    for (const child of [server, client]) {
      if (child.pid && child.pid > 0) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {}
      }
    }
    process.exit(1);
  }, 10000);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
