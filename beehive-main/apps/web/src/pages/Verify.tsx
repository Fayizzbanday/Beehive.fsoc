import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronDown,
  ExternalLink,
  FileCheck2,
  Hash,
  Hexagon,
  LockKeyhole,
  MapPin,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  ShieldX,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { useApi, shortHash } from "../lib/api";
import {
  Badge,
  Button,
  CopyButton,
  ErrorState,
  LinkButton,
  Loading,
  Logo,
  Modal,
  RiskGauge,
  Status,
} from "../components/ui";
import {
  GOLDEN_ID,
  PUBLIC_ID,
  formatDate,
  type Verification,
} from "../../../../packages/shared/src/index";
interface Detector {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
}
type DetectorConstructor = new (options: { formats: string[] }) => Detector;
export default function VerifySearch() {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();
  function go(raw: string) {
    let publicId = raw.trim().toUpperCase();
    try {
      const url = new URL(raw);
      publicId =
        url.pathname.split("/").filter(Boolean).pop()?.toUpperCase() ?? "";
    } catch {}
    if (!PUBLIC_ID.test(publicId)) {
      setError("Enter a batch ID such as BH-2026-000042.");
      return;
    }
    navigate(`/verify/${publicId}`);
  }
  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | undefined,
      active = true,
      timer: ReturnType<typeof setTimeout>;
    const start = async () => {
      try {
        const Constructor = (
          window as typeof window & { BarcodeDetector?: DetectorConstructor }
        ).BarcodeDetector;
        if (!Constructor)
          throw new Error(
            "This browser does not support in-page QR scanning. Use your phone camera or enter the batch ID below.",
          );
        const detector = new Constructor({ formats: ["qr_code"] });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
        }
        const scan = async () => {
          if (!active) return;
          try {
            if (video.current) {
              const results = await detector.detect(video.current);
              if (results[0]) {
                const raw = results[0].rawValue;
                let candidate = raw;
                try {
                  candidate = new URL(raw).pathname.split("/").pop() ?? "";
                } catch {}
                if (PUBLIC_ID.test(candidate.toUpperCase())) {
                  go(raw);
                  return;
                }
              }
            }
          } catch {}
          timer = setTimeout(scan, 400);
        };
        void scan();
      } catch (e) {
        setError((e as Error).message);
        setScanning(false);
      }
    };
    void start();
    return () => {
      active = false;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [scanning]);
  return (
    <div className="verify-search-page">
      <header className="public-header">
        <Logo />
        <Link to="/login" className="text-link">
          Producer sign in
          <ArrowUpRight size={15} />
        </Link>
      </header>
      <main id="main" className="verify-search-main">
        <div className="scan-emblem">
          <ScanLine size={39} />
        </div>
        <Badge tone="green">Open to everyone</Badge>
        <h1>
          A little scan.
          <br />A lot of certainty.
        </h1>
        <p>
          Follow your honey back to its source. Check that its certified record
          is exactly as it was registered.
        </p>
        <form
          className="verify-search-form"
          onSubmit={(e) => {
            e.preventDefault();
            go(value);
          }}
        >
          <label htmlFor="batch-search">
            Enter the batch ID from your honey label
          </label>
          <div className="verify-input">
            <Search size={20} />
            <input
              id="batch-search"
              placeholder="BH-2026-000042"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError("");
              }}
              autoCapitalize="characters"
              autoComplete="off"
              required
            />
            <Button type="submit" aria-label="Verify batch">
              <ArrowRight size={21} />
            </Button>
          </div>
          {error ? (
            <p role="alert" className="form-error">
              {error}
            </p>
          ) : null}
        </form>
        <Button variant="secondary" onClick={() => setScanning((s) => !s)}>
          <ScanLine size={17} />
          {scanning ? "Close scanner" : "Scan a QR code"}
        </Button>
        {scanning ? (
          <video
            className="scanner-video"
            ref={video}
            muted
            playsInline
            aria-label="QR camera scanner"
          />
        ) : null}
        <div className="sample-passport">
          <span className="batch-small">
            <Hexagon size={21} />
          </span>
          <div>
            <small>Try the demonstration passport</small>
            <strong>Acacia honey · Mountain Gold Apiary</strong>
            <span>{GOLDEN_ID}</span>
          </div>
          <Link to={`/verify/${GOLDEN_ID}`} aria-label="Open example passport">
            <ArrowUpRight size={23} />
          </Link>
        </div>
        <div className="verify-assurances">
          <span>
            <LockKeyhole size={15} />
            No account needed
          </span>
          <span>
            <ShieldCheck size={15} />
            Checked against the blockchain
          </span>
        </div>
      </main>
      <footer className="public-footer">
        <span>From hive to honey. Every claim, verifiable.</span>
        <Link to="/architecture">How verification works</Link>
      </footer>
    </div>
  );
}
export function VerifyResult() {
  const { publicId } = useParams();
  const { data, error, isValidating, mutate } = useApi<Verification>(
    `/verify/${publicId}`,
  );
  const [technical, setTechnical] = useState(false);
  const reduced = useReducedMotion();
  if (error)
    return (
      <div className="verify-result-page">
        <header className="public-header">
          <Logo />
          <Link to="/verify">Verify another batch</Link>
        </header>
        <ErrorState error={error} retry={() => void mutate()} />
      </div>
    );
  if (!data) return <Loading />;
  const authentic = data.verdict === "AUTHENTIC",
    tampered = data.verdict === "TAMPERED",
    record = data.record;
  return (
    <div className={`verify-result-page ${tampered ? "is-tampered" : ""}`}>
      <header className="public-header">
        <Logo />
        <Link to="/verify" className="text-link">
          Verify another batch
          <ScanLine size={15} />
        </Link>
      </header>
      <main id="main" className="verify-result-main">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="verdict-header"
        >
          <div
            className={`verdict-icon ${authentic ? "authentic" : tampered ? "tampered" : "pending"}`}
          >
            {authentic ? (
              <ShieldCheck size={42} />
            ) : tampered ? (
              <ShieldX size={42} />
            ) : (
              <Search size={37} />
            )}
          </div>
          <Badge tone={authentic ? "green" : tampered ? "red" : "amber"}>
            {authentic
              ? "Verified BeeHive record"
              : tampered
                ? "Integrity mismatch"
                : data.verdict.replace("_", " ")}
          </Badge>
          <h1>
            {authentic
              ? "A story you can verify."
              : tampered
                ? "This record has been changed."
                : data.verdict === "NOT_FOUND"
                  ? "We couldn’t find that batch."
                  : "The proof is not confirmed yet."}
          </h1>
          <p>{data.message}</p>
          <div className="verification-live">
            <span className={`live-dot ${tampered ? "red" : ""}`} />
            <span>
              Checked{" "}
              {new Date(data.checkedAt).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
            <button
              className="icon-button"
              aria-label="Recheck verification"
              disabled={isValidating}
              onClick={async () => {
                await mutate();
                toast.success(
                  "Verification refreshed from the current record and blockchain.",
                );
              }}
            >
              <RefreshCw size={14} className={isValidating ? "spin" : ""} />
            </button>
          </div>
        </motion.div>
        {record ? (
          <>
            <div className="honey-passport">
              <div className="honey-passport-visual">
                <div className="honey-jar">
                  <div className="jar-lid" />
                  <div className="jar-glass">
                    <div className="jar-label">
                      <Hexagon size={28} />
                      <strong>BeeHive</strong>
                      <span>{record.honeyType}</span>
                      <small>Source. Story. Proof.</small>
                    </div>
                    <div className="jar-shine" />
                  </div>
                </div>
                <div className="passport-visual-caption">
                  <MapPin size={14} />
                  {record.origin.region}
                </div>
              </div>
              <div className="honey-passport-info">
                <small>Single-origin provenance record</small>
                <h2>
                  {record.honeyType}
                  <br />
                  honey.
                </h2>
                <p>{record.producerName}</p>
                <div className="public-batch-id">
                  <span>Batch passport</span>
                  <strong>{publicId}</strong>
                </div>
                <div className="passport-specs">
                  <span>
                    <small>Harvested</small>
                    <strong>{formatDate(record.harvestDate)}</strong>
                  </span>
                  <span>
                    <small>Batch quantity</small>
                    <strong className={tampered ? "red-text" : ""}>
                      {record.quantity} kg
                    </strong>
                  </span>
                </div>
              </div>
            </div>
            <div className="verification-checks">
              <div>
                <Hash size={20} />
                <span>
                  Record integrity
                  <strong>
                    {authentic
                      ? "Verified"
                      : tampered
                        ? "Mismatch"
                        : "Unconfirmed"}
                  </strong>
                </span>
                <Status value={data.verdict} />
              </div>
              <div>
                <ShieldCheck size={20} />
                <span>
                  Blockchain proof
                  <strong>
                    {data.anchoredHash
                      ? "Fingerprint registered"
                      : "Awaiting proof"}
                  </strong>
                </span>
                {data.anchoredHash ? <Check size={18} /> : null}
              </div>
              <div>
                <Sparkles size={20} />
                <span>
                  AI risk assessment
                  <strong>
                    {data.assessment
                      ? `${data.assessment.score} / 100`
                      : "Not assessed"}
                  </strong>
                </span>
                {data.assessment ? (
                  <Status value={data.assessment.classification} />
                ) : null}
              </div>
            </div>
            {tampered ? (
              <div className="tamper-public-alert" role="alert">
                <TriangleAlert size={23} />
                <div>
                  <strong>Do not rely on this record as certified.</strong>
                  <p>
                    The current quantity or other certified evidence differs
                    from the registered proof. An authority alert has been
                    recorded.
                  </p>
                </div>
              </div>
            ) : null}
            <div className="public-details">
              <details open>
                <summary>
                  <span>
                    <MapPin size={19} />
                    Origin & source hive
                  </span>
                  <ChevronDown size={18} />
                </summary>
                <dl className="detail-grid">
                  <div>
                    <dt>Producer</dt>
                    <dd>{record.producerName}</dd>
                  </div>
                  <div>
                    <dt>Apiary</dt>
                    <dd>{record.apiary}</dd>
                  </div>
                  <div>
                    <dt>Origin</dt>
                    <dd>{record.origin.region}</dd>
                  </div>
                  <div>
                    <dt>Source hives</dt>
                    <dd>{record.hiveIds.join(", ")}</dd>
                  </div>
                </dl>
              </details>
              <details>
                <summary>
                  <span>
                    <FileCheck2 size={19} />
                    Quality information
                  </span>
                  <ChevronDown size={18} />
                </summary>
                <dl className="detail-grid">
                  <div>
                    <dt>Reported moisture</dt>
                    <dd>{record.qualityMeasurements.moisture}%</dd>
                  </div>
                  <div>
                    <dt>Extraction</dt>
                    <dd>{record.extractionMethod}</dd>
                  </div>
                  <div>
                    <dt>HMF</dt>
                    <dd>{record.qualityMeasurements.hmf ?? "Not supplied"}</dd>
                  </div>
                  <div>
                    <dt>Diastase</dt>
                    <dd>
                      {record.qualityMeasurements.diastase ?? "Not supplied"}
                    </dd>
                  </div>
                </dl>
                <p className="scope-note">
                  Measurements are producer-reported. Record integrity is not
                  laboratory certification.
                </p>
              </details>
              <details>
                <summary>
                  <span>
                    <Sparkles size={19} />
                    AI assessment
                  </span>
                  <ChevronDown size={18} />
                </summary>
                {data.assessment ? (
                  <>
                    <div className="assessment-summary">
                      <RiskGauge score={data.assessment.score} />
                      <div>
                        <Status value={data.assessment.classification} />
                        <p>
                          {Math.round(data.assessment.confidence * 100)}%
                          screening confidence
                        </p>
                      </div>
                    </div>
                    <ul className="reason-list">
                      {data.assessment.reasons.map((r) => (
                        <li key={r}>
                          <Check size={15} />
                          {r}
                        </li>
                      ))}
                    </ul>
                    <p className="scope-note">{data.assessment.scope}</p>
                  </>
                ) : (
                  <p>No assessment available.</p>
                )}
              </details>
              <details>
                <summary>
                  <span>
                    <ShieldCheck size={19} />
                    Blockchain proof
                  </span>
                  <ChevronDown size={18} />
                </summary>
                <dl className="detail-list">
                  <div>
                    <dt>Network</dt>
                    <dd>
                      {data.proof?.blockchain_network ?? "Not registered"}
                    </dd>
                  </div>
                  <div>
                    <dt>Confirmed</dt>
                    <dd>
                      {data.proof?.blockchain_timestamp
                        ? formatDate(data.proof.blockchain_timestamp)
                        : "Pending"}
                    </dd>
                  </div>
                  <div>
                    <dt>Transaction</dt>
                    <dd className="mono">
                      {shortHash(data.proof?.blockchain_tx_hash)}
                    </dd>
                  </div>
                </dl>
                <Button variant="secondary" onClick={() => setTechnical(true)}>
                  View Technical Proof
                  <Hash size={15} />
                </Button>
              </details>
              <details>
                <summary>
                  <span>
                    <CheckCheck size={19} />
                    Traceability timeline
                  </span>
                  <ChevronDown size={18} />
                </summary>
                <ol className="activity-list">
                  {data.timeline?.map((t, i) => (
                    <li key={i}>
                      <span className="timeline-dot" />
                      <div>
                        <strong>{t.action}</strong>
                        <small>
                          {new Date(t.created_at).toLocaleString("en-IN")}
                        </small>
                      </div>
                    </li>
                  ))}
                </ol>
              </details>
            </div>
            <Button
              className="technical-button"
              variant="ghost"
              onClick={() => setTechnical(true)}
            >
              <Hash size={15} />
              View Technical Proof
              <ArrowUpRight size={15} />
            </Button>
            <p className="verification-disclaimer">
              BeeHive verifies that the certified record has not changed. AI
              screens metadata for risk; neither AI nor blockchain proves honey
              purity.
            </p>
          </>
        ) : (
          <LinkButton to="/verify" variant="secondary">
            Try another batch
            <ArrowRight size={16} />
          </LinkButton>
        )}
      </main>
      <footer className="public-footer">
        <Logo />
        <span>Scan. Verify. Trust.</span>
        <Link to="/architecture">How it works</Link>
      </footer>
      <Modal
        open={technical}
        onOpenChange={setTechnical}
        title="The proof, in full."
        description="The current fingerprint is recalculated from the database; the anchored fingerprint is read from the configured EVM registry."
      >
        <div className="technical-proof">
          <Status value={data.verdict} />
          {[
            ["Current SHA-256", data.currentHash],
            ["Blockchain anchored SHA-256", data.anchoredHash],
            ["Transaction", data.proof?.blockchain_tx_hash],
            ["Registry contract", data.proof?.contract_address],
          ].map(([label, value]) => (
            <div className="hash-block" key={label}>
              <small>{label}</small>
              <code>{value ?? "Not available"}</code>
              {value ? <CopyButton value={value} /> : null}
            </div>
          ))}
          <dl className="detail-list">
            <div>
              <dt>Network</dt>
              <dd>{data.proof?.blockchain_network}</dd>
            </div>
            <div>
              <dt>Schema</dt>
              <dd>{data.proof?.canonical_payload_version}</dd>
            </div>
            <div>
              <dt>Confirmed</dt>
              <dd>{data.proof?.blockchain_timestamp ?? "Pending"}</dd>
            </div>
          </dl>
          {data.proof?.explorerUrl ? (
            <a
              className="text-link"
              href={data.proof.explorerUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open transaction explorer
              <ExternalLink size={15} />
            </a>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
