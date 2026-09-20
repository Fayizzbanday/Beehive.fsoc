import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
const local = !process.argv.includes("--testnet");
const rpc = local ? "http://127.0.0.1:8545" : process.env.EVM_RPC_URL;
if (!rpc) throw new Error("Set EVM_RPC_URL for the testnet.");
const chain = defineChain({
  id: local ? 31337 : Number(process.env.CHAIN_ID ?? 11155111),
  name: local ? "Local EVM (Hardhat)" : "Ethereum Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
});
const client = createPublicClient({ chain, transport: http(rpc) });
const varsPath = "apps/worker/.dev.vars";
let localVars =
  local && existsSync(varsPath) ? readFileSync(varsPath, "utf8") : "";
const oldAddress = localVars.match(
  /^CONTRACT_ADDRESS="(0x[a-fA-F0-9]+)"$/m,
)?.[1] as Hex | undefined;
if (local && oldAddress && (await client.getCode({ address: oldAddress }))) {
  console.log("Existing local registry is ready.");
  process.exit(0);
}
const key = local
  ? generatePrivateKey()
  : (process.env.BLOCKCHAIN_PRIVATE_KEY as Hex | undefined);
if (!key)
  throw new Error(
    "Set BLOCKCHAIN_PRIVATE_KEY for deployment. This key never enters the frontend.",
  );
const account = privateKeyToAccount(key);
if (local)
  await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "hardhat_setBalance",
      params: [account.address, "0x56BC75E2D63100000"],
    }),
  });
if ((await client.getChainId()) !== chain.id)
  throw new Error("RPC chain ID mismatch.");
const wallet = createWalletClient({ account, chain, transport: http(rpc) });
const artifact = JSON.parse(
  readFileSync("artifacts/BeeHiveRegistry.json", "utf8"),
);
const tx = await wallet.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode,
});
const receipt = await client.waitForTransactionReceipt({ hash: tx });
if (receipt.status !== "success" || !receipt.contractAddress)
  throw new Error("Deployment failed.");
mkdirSync(".local", { recursive: true });
writeFileSync(
  ".local/deployment.json",
  JSON.stringify(
    {
      address: receipt.contractAddress,
      transactionHash: tx,
      chainId: chain.id,
      network: chain.name,
    },
    null,
    2,
  ),
);
if (local) {
  localVars = localVars.replace(
    /^(BLOCKCHAIN_PRIVATE_KEY|CONTRACT_ADDRESS)=.*\n?/gm,
    "",
  );
  writeFileSync(
    varsPath,
    `${localVars}\nBLOCKCHAIN_PRIVATE_KEY="${key}"\nCONTRACT_ADDRESS="${receipt.contractAddress}"\n`,
    { mode: 0o600 },
  );
}
console.log(
  `Registry deployed: ${receipt.contractAddress}\nNetwork: ${chain.name}\nTransaction: ${tx}`,
);
if (!local)
  console.log(
    "Set CONTRACT_ADDRESS in the production Worker config and upload the signer using wrangler secret put BLOCKCHAIN_PRIVATE_KEY.",
  );
