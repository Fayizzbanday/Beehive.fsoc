import { spawn, execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  openSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
mkdirSync(".local", { recursive: true });
async function rpcReady() {
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
    const j = await r.json();
    if (j.result && j.result !== "0x7a69")
      throw new Error("Port 8545 is occupied by a different chain.");
    return j.result === "0x7a69";
  } catch (e) {
    if (e.message.includes("different chain")) throw e;
    return false;
  }
}
if (!(await rpcReady())) {
  const log = openSync(".local/chain.log", "a");
  const chain = spawn(
    process.execPath,
    ["node_modules/hardhat/dist/src/cli.js", "node", "--hostname", "127.0.0.1"],
    { detached: true, stdio: ["ignore", log, log] },
  );
  chain.unref();
  writeFileSync(".local/chain.pid", String(chain.pid));
  for (let i = 0; i < 40 && !(await rpcReady()); i++)
    await new Promise((r) => setTimeout(r, 250));
  if (!(await rpcReady()))
    throw new Error("Local EVM did not start. Inspect .local/chain.log.");
}
for (const task of ["chain:compile", "db:migrate", "chain:deploy", "seed:demo"])
  execFileSync("npm", ["run", task], { stdio: "inherit" });
writeFileSync(".local/ready", "ready");
console.log("\nBeeHive demo is ready. Run npm run dev.");
