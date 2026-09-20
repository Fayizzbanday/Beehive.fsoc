import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  isAddress,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { registryAbi } from "./abi";
export interface ChainConfig {
  EVM_RPC_URL: string;
  CHAIN_ID: string;
  CONTRACT_ADDRESS: string;
  NETWORK_NAME: string;
  BLOCKCHAIN_PRIVATE_KEY?: string;
}
export function chainClients(config: ChainConfig) {
  if (!config.EVM_RPC_URL || !isAddress(config.CONTRACT_ADDRESS))
    throw new Error("Blockchain configuration is incomplete.");
  const chain = defineChain({
    id: Number(config.CHAIN_ID),
    name: config.NETWORK_NAME,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [config.EVM_RPC_URL] } },
  });
  const transport = http(config.EVM_RPC_URL, { timeout: 15000, retryCount: 1 });
  return {
    chain,
    transport,
    client: createPublicClient({ chain, transport }),
    address: config.CONTRACT_ADDRESS as Hex,
  };
}
export async function readAnchoredRecord(
  config: ChainConfig,
  publicId: string,
) {
  const { client, address } = chainClients(config);
  if ((await client.getChainId()) !== Number(config.CHAIN_ID))
    throw new Error("RPC chain does not match configured chain.");
  const [hash, timestamp, registrant] = await client.readContract({
    address,
    abi: registryAbi,
    functionName: "getRecord",
    args: [publicId],
  });
  return { hash, timestamp, registrant, exists: timestamp > 0n };
}
export async function broadcastRecord(
  config: ChainConfig,
  publicId: string,
  hash: Hex,
) {
  if (!config.BLOCKCHAIN_PRIVATE_KEY)
    throw new Error("Worker signing secret is missing.");
  const { client, address, chain, transport } = chainClients(config);
  if ((await client.getChainId()) !== chain.id)
    throw new Error("RPC chain does not match configured chain.");
  const account = privateKeyToAccount(config.BLOCKCHAIN_PRIVATE_KEY as Hex);
  const wallet = createWalletClient({ account, chain, transport });
  const { request } = await client.simulateContract({
    account,
    address,
    abi: registryAbi,
    functionName: "registerRecord",
    args: [hash, publicId],
  });
  return wallet.writeContract(request);
}
export async function confirmTransaction(config: ChainConfig, tx: Hex) {
  const { client } = chainClients(config);
  const receipt = await client.waitForTransactionReceipt({
    hash: tx,
    confirmations: 1,
    timeout: 20000,
    pollingInterval: 1000,
  });
  if (receipt.status !== "success")
    throw new Error("Blockchain transaction reverted.");
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  return {
    transactionHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber.toString(),
    timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
  };
}
