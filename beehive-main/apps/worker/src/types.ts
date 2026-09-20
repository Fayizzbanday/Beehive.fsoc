import type { User } from "../../../packages/shared/src/index";
export type Bindings = Omit<
  CloudflareEnv,
  | "APP_URL"
  | "DEMO_MODE"
  | "EVM_RPC_URL"
  | "CHAIN_ID"
  | "CONTRACT_ADDRESS"
  | "BLOCK_EXPLORER_URL"
  | "NETWORK_NAME"
  | "BLOCKCHAIN_PRIVATE_KEY"
> & {
  APP_URL: string;
  DEMO_MODE: string;
  EVM_RPC_URL: string;
  CHAIN_ID: string;
  CONTRACT_ADDRESS: string;
  BLOCK_EXPLORER_URL: string;
  NETWORK_NAME: string;
  BLOCKCHAIN_PRIVATE_KEY?: string;
};
export type AppEnv = {
  Bindings: Bindings;
  Variables: { user: User; requestId: string };
};
