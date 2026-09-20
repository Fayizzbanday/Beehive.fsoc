import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  Database,
  FlaskConical,
  Hash,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { post, useApi } from "../lib/api";
import {
  Badge,
  Button,
  ErrorState,
  LinkButton,
  Loading,
  PageHeader,
  Panel,
  Status,
} from "../components/ui";
import {
  GOLDEN_ID,
  type Verification,
} from "../../../../packages/shared/src/index";
export default function Tamper() {
  const { data, error, mutate } = useApi<Verification>(`/verify/${GOLDEN_ID}`);
  const [busy, setBusy] = useState("");
  const { mutate: globalMutate } = useSWRConfig();
  const reduced = useReducedMotion();
  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading />;
  const tampered = data.verdict === "TAMPERED";
  async function action(type: "tamper" | "reset") {
    setBusy(type);
    try {
      const result = await post<Verification>(`/demo/${type}/${GOLDEN_ID}`);
      await mutate(result, { revalidate: false });
      await Promise.all([
        globalMutate("/authority/alerts"),
        globalMutate("/authority/overview"),
        globalMutate("/batches"),
      ]);
      toast[type === "tamper" ? "warning" : "success"](
        type === "tamper"
          ? "Hash mismatch detected. Authority alert created."
          : "Original certified record restored.",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Controlled integrity experiment"
        title="The proof holds. Even when the record doesn’t."
        description="Change one certified database value. Watch an unchanged blockchain fingerprint expose it."
        action={<Badge tone="amber">Admin-only demo lab</Badge>}
      />
      <div className="lab-notice">
        <FlaskConical size={19} />
        <p>
          This isolated experiment only changes {GOLDEN_ID}. Every action is
          audited, and the certified snapshot can be restored.
        </p>
      </div>
      {data.verdict === "PENDING" || data.verdict === "NOT_FOUND" ? (
        <Panel title="Anchor the golden record first">
          <p>
            The tamper demonstration requires a confirmed Solidity registration.
          </p>
          <LinkButton to={`/batches/${GOLDEN_ID}`}>
            Open golden batch
            <ArrowRight size={16} />
          </LinkButton>
        </Panel>
      ) : (
        <>
          <section className={`tamper-lab ${tampered ? "attacked" : ""}`}>
            <div className="lab-heading">
              <span>
                <span className="live-dot" />
                Integrity monitor
              </span>
              <Status value={data.verdict} />
            </div>
            <div className="comparison-grid">
              <div className="comparison-source">
                <span className="comparison-icon">
                  <Database size={27} />
                </span>
                <h2>Current database record</h2>
                <small>{GOLDEN_ID}</small>
                <div className="quantity-display">
                  <span>Harvest quantity</span>
                  <motion.strong
                    key={data.record?.quantity}
                    initial={reduced ? false : { scale: 0.86, opacity: 0.3 }}
                    animate={{ scale: 1, opacity: 1 }}
                  >
                    {data.record?.quantity}
                    <em>kg</em>
                  </motion.strong>
                  {tampered ? (
                    <span className="changed-label">Changed from 25 kg</span>
                  ) : (
                    <span className="original-label">
                      Original certified value
                    </span>
                  )}
                </div>
                <ArrowDown size={20} className="hash-arrow" />
                <span className="hash-caption">
                  <Hash size={16} />
                  Recalculated SHA-256
                </span>
                <code className="comparison-hash">{data.currentHash}</code>
              </div>
              <div className="comparison-divider">
                <span>{tampered ? "≠" : "="}</span>
                <small>{tampered ? "Hash mismatch" : "Exact match"}</small>
              </div>
              <div className="comparison-source">
                <span className="comparison-icon">
                  <LockKeyhole size={27} />
                </span>
                <h2>Immutable blockchain</h2>
                <small>{data.proof?.blockchain_network}</small>
                <div className="quantity-display immutable-display">
                  <span>Registered evidence</span>
                  <ShieldCheck size={57} />
                  <span className="original-label">
                    Fingerprint stays unchanged
                  </span>
                </div>
                <ArrowDown size={20} className="hash-arrow" />
                <span className="hash-caption">
                  <Hash size={16} />
                  Anchored SHA-256
                </span>
                <code className="comparison-hash">{data.anchoredHash}</code>
              </div>
            </div>
            <motion.div
              key={data.verdict}
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="lab-verdict"
            >
              {tampered ? <ShieldX size={32} /> : <ShieldCheck size={32} />}
              <div>
                <h2>{tampered ? "RECORD TAMPERED" : "AUTHENTIC"}</h2>
                <p>
                  {tampered
                    ? "A single changed value. A completely different fingerprint. An immediate authority alert."
                    : "The current certified record and the immutable proof match exactly."}
                </p>
              </div>
            </motion.div>
          </section>
          <div className="lab-actions">
            <Button
              variant="danger"
              busy={busy === "tamper"}
              disabled={!!busy || tampered}
              onClick={() => void action("tamper")}
            >
              <Database size={17} />
              Simulate Database Tampering
            </Button>
            <Button
              variant="secondary"
              busy={busy === "reset"}
              disabled={!!busy || !tampered}
              onClick={() => void action("reset")}
            >
              <RefreshCw size={17} />
              Restore Demo
            </Button>
          </div>
          <div className="lab-follow">
            <Link to={`/verify/${GOLDEN_ID}`}>
              <span>
                <strong>See what a consumer sees</strong>
                <small>Open the public passport and recheck the verdict.</small>
              </span>
              <ArrowRight size={21} />
            </Link>
            <Link to="/authority/alerts">
              <span>
                <strong>Follow the authority alert</strong>
                <small>
                  Review the incident, record and permanent audit history.
                </small>
              </span>
              <ArrowRight size={21} />
            </Link>
          </div>
        </>
      )}
      <div className="lab-explanation">
        <Hash size={25} />
        <p>
          SHA-256 creates a deterministic fingerprint of the certified fields. A
          database modification changes that fingerprint. The blockchain retains
          the original, so every subsequent verification can detect the
          mismatch.
        </p>
      </div>
    </>
  );
}
