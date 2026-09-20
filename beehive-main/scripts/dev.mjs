import { spawn, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
let ready = false;
try {
  const r = await fetch("http://127.0.0.1:8545", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_chainId",
      params: [],
    }),
  });
  ready = (await r.json()).result === "0x7a69" && existsSync(".local/ready");
} catch {}
if (!ready)
  execFileSync(process.execPath, ["scripts/setup-demo.mjs"], {
    stdio: "inherit",
  });
const children = [
  spawn("npm", ["run", "dev:worker"], { stdio: "inherit" }),
  spawn("npm", ["run", "dev:web"], { stdio: "inherit" }),
];
function stop() {
  for (const child of children) child.kill("SIGTERM");
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children)
  child.on("exit", (code) => {
    if (code) stop();
  });
