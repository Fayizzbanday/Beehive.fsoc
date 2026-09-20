import { Hono } from "hono";
import type { Hex } from "viem";
import type { AppEnv } from "./types";
import type { CertifiedRecord } from "../../../packages/shared/src/index";
import {
  canonicalizeRecord,
  sha256,
} from "../../../packages/shared/src/canonical";
import {
  broadcastRecord,
  confirmTransaction,
  readAnchoredRecord,
  chainClients,
} from "../../../packages/blockchain/src/index";
import { registryAbi } from "../../../packages/blockchain/src/abi";
import { authenticated, roles } from "./auth";
import { getBatchRow, hydrateBatch } from "./batches";
import { statement, ok, fail, id, now, audit } from "./core";
interface ProofRow {
  id: string;
  status: string;
  record_hash: Hex;
  blockchain_tx_hash: Hex | null;
  created_at: string;
}
const proofs = new Hono<AppEnv>();
proofs.use("*", authenticated, roles("producer", "admin"));
proofs.post("/:id/anchor", async (c) => {
  const batch = await getBatchRow(c, c.req.param("id"));
  if (batch.status === "DRAFT")
    fail(409, "Run risk analysis before generating proof.");
  if (batch.status === "REVOKED") fail(409, "This record has been revoked.");
  if (!c.env.CONTRACT_ADDRESS || !c.env.BLOCKCHAIN_PRIVATE_KEY)
    fail(
      503,
      "Blockchain is not configured. Run local demo setup or configure the Worker signing secret and registry.",
    );
  let proof = await statement(
    c.env,
    "SELECT * FROM blockchain_proofs WHERE batch_id=?",
    batch.id,
  ).first<ProofRow>();
  if (proof?.blockchain_tx_hash || proof?.status === "ANCHORED")
    return ok(c, await hydrateBatch(c, batch));
  if (
    proof?.status === "PREPARING" &&
    Date.now() - Date.parse(proof.created_at) < 60000
  )
    fail(409, "Proof preparation is already in progress. Retry shortly.");
  const record: CertifiedRecord = JSON.parse(batch.record_json);
  if (!record.aiAssessmentDigest)
    fail(409, "An assessment digest is required.");
  const canonical = canonicalizeRecord(record),
    hash = await sha256(canonical);
  const proofId = id();
  const result = await statement(
    c.env,
    "INSERT INTO blockchain_proofs (id,batch_id,canonical_payload_version,canonical_payload,record_hash,blockchain_network,chain_id,contract_address,status,created_at) VALUES (?,?,?,?,?,?,?,?,'PREPARING',?) ON CONFLICT(batch_id) DO UPDATE SET status='PREPARING',error=NULL,created_at=excluded.created_at WHERE blockchain_proofs.status='FAILED' OR (blockchain_proofs.status='PREPARING' AND blockchain_proofs.created_at<?) RETURNING id",
    proofId,
    batch.id,
    record.schemaVersion,
    canonical,
    hash,
    c.env.NETWORK_NAME,
    Number(c.env.CHAIN_ID),
    c.env.CONTRACT_ADDRESS,
    now(),
    new Date(Date.now() - 60000).toISOString(),
  ).first<{ id: string }>();
  if (!result) fail(409, "An anchoring operation is already in progress.");
  await statement(
    c.env,
    "UPDATE batches SET status='ANCHORING' WHERE id=?",
    batch.id,
  ).run();
  try {
    const existing = await readAnchoredRecord(c.env, batch.public_id);
    let tx: Hex;
    if (existing.exists) {
      if (existing.hash !== hash)
        fail(
          409,
          "The immutable registry already contains a different fingerprint for this public ID.",
        );
      const { client, address } = chainClients(c.env);
      const logs = await client.getContractEvents({
        address,
        abi: registryAbi,
        eventName: "RecordRegistered",
        args: { recordHash: hash },
        fromBlock: 0n,
        toBlock: "latest",
      });
      const found = logs.find((l) => l.args.publicId === batch.public_id);
      if (!found)
        throw new Error(
          "Registration found but its receipt could not be recovered.",
        );
      tx = found.transactionHash;
    } else tx = await broadcastRecord(c.env, batch.public_id, hash);
    await statement(
      c.env,
      "UPDATE blockchain_proofs SET blockchain_tx_hash=?,status='CONFIRMING' WHERE batch_id=?",
      tx,
      batch.id,
    ).run();
    await audit(
      c,
      "Blockchain transaction broadcast",
      batch.id,
      tx,
      batch.producer_id,
    );
    return ok(c, await hydrateBatch(c, await getBatchRow(c, batch.id)), 202);
  } catch (e) {
    await c.env.DB.batch([
      statement(
        c.env,
        "UPDATE blockchain_proofs SET status='FAILED',error=? WHERE batch_id=?",
        e instanceof Error ? e.message.slice(0, 300) : "Anchoring failed",
        batch.id,
      ),
      statement(
        c.env,
        "UPDATE batches SET status='ANALYZED' WHERE id=?",
        batch.id,
      ),
    ]);
    fail(
      503,
      "Blockchain submission failed. Check the RPC, signer balance and registry authorization, then retry.",
    );
  }
});
proofs.post("/:id/anchor/confirm", async (c) => {
  const batch = await getBatchRow(c, c.req.param("id"));
  const proof = await statement(
    c.env,
    "SELECT * FROM blockchain_proofs WHERE batch_id=?",
    batch.id,
  ).first<ProofRow>();
  if (!proof?.blockchain_tx_hash) fail(409, "Broadcast the fingerprint first.");
  if (proof.status === "ANCHORED") return ok(c, await hydrateBatch(c, batch));
  try {
    const receipt = await confirmTransaction(c.env, proof.blockchain_tx_hash);
    const chain = await readAnchoredRecord(c.env, batch.public_id);
    if (!chain.exists || chain.hash !== proof.record_hash)
      fail(409, "The contract fingerprint does not match the prepared proof.");
    await c.env.DB.batch([
      statement(
        c.env,
        "UPDATE blockchain_proofs SET status='ANCHORED',blockchain_timestamp=?,block_number=?,error=NULL WHERE batch_id=?",
        receipt.timestamp,
        receipt.blockNumber,
        batch.id,
      ),
      statement(
        c.env,
        "UPDATE batches SET status='ANCHORED' WHERE id=?",
        batch.id,
      ),
    ]);
    await audit(
      c,
      "Blockchain anchoring confirmed",
      batch.id,
      receipt.transactionHash,
      batch.producer_id,
    );
    return ok(c, await hydrateBatch(c, await getBatchRow(c, batch.id)));
  } catch (e) {
    return ok(
      c,
      {
        ...(await hydrateBatch(c, batch)),
        confirmationMessage:
          "Confirmation is still pending. Retry to check the transaction.",
      },
      202,
    );
  }
});
export default proofs;
