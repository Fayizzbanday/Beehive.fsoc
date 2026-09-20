import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  FileCheck2,
  Hash,
  Hexagon,
  Link2,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { api, post, useApi, useUser } from "../lib/api";
import {
  Badge,
  Button,
  ErrorState,
  Loading,
  PageHeader,
  Panel,
  RiskGauge,
  Status,
} from "../components/ui";
import Passport from "../components/Passport";
import {
  batchSchema,
  type Batch,
  type Hive,
} from "../../../../packages/shared/src/index";
const steps = [
  "Source",
  "Harvest",
  "Quality & evidence",
  "Traceability",
  "AI analysis",
  "Proof generation",
  "QR certificate",
];
export default function BatchWizard() {
  const { data: hives, error } = useApi<Hive[]>("/hives");
  const { data: apiaries } =
    useApi<{ id: string; name: string; location: string }[]>("/apiaries");
  const { data: user } = useUser();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    apiaryId: "",
    hiveIds: [] as string[],
    harvestDate: new Date().toISOString().slice(0, 10),
    honeyType: "Acacia",
    quantity: 25,
    moisture: 17.8,
    lotInformation: "",
    extractionMethod: "Cold extraction",
    notes: "",
    hmf: "",
    diastase: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [proofStage, setProofStage] = useState(0);
  const { mutate } = useSWRConfig();
  const reduced = useReducedMotion();
  if (user?.role === "authority") return <Navigate to="/authority" replace />;
  if (error) return <ErrorState error={error} />;
  if (!hives || !apiaries) return <Loading />;
  const sourceHives = hives.filter((h) => h.apiary_id === form.apiaryId);
  function field(key: string, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
    setFormError("");
  }
  async function next() {
    setFormError("");
    if (step === 0) {
      if (!form.apiaryId || !form.hiveIds.length) {
        setFormError("Select an apiary and at least one source hive.");
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      if (
        !form.lotInformation.trim() ||
        form.quantity <= 0 ||
        !form.harvestDate ||
        form.harvestDate > new Date().toISOString().slice(0, 10)
      ) {
        setFormError(
          "Enter a valid past or current harvest date, positive quantity and lot reference.",
        );
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (form.moisture < 0 || form.moisture > 100) {
        setFormError("Moisture must be between 0 and 100%.");
        return;
      }
      if (file && file.size > 5 * 1024 * 1024) {
        setFormError("Choose a file smaller than 5 MB.");
        return;
      }
      setStep(3);
      return;
    }
    if (step === 3) {
      setBusy(true);
      try {
        let doc = documentId;
        if (file && !doc) {
          setMessage("Uploading and fingerprinting your evidence");
          const data = new FormData();
          data.set("file", file);
          data.set("apiaryId", form.apiaryId);
          doc = (
            await api<{ id: string }>("/documents", {
              method: "POST",
              body: data,
            })
          ).id;
          setDocumentId(doc);
        }
        setMessage("Creating your traceability record");
        const input = {
          apiaryId: form.apiaryId,
          hiveIds: form.hiveIds,
          harvestDate: form.harvestDate,
          honeyType: form.honeyType,
          quantity: form.quantity,
          moisture: form.moisture,
          labValues: {
            hmf: form.hmf === "" ? null : Number(form.hmf),
            diastase: form.diastase === "" ? null : Number(form.diastase),
          },
          lotInformation: form.lotInformation,
          extractionMethod: form.extractionMethod,
          notes: form.notes,
          documentId: doc,
        };
        const parsed = batchSchema.safeParse(input);
        if (!parsed.success)
          throw new Error(parsed.error.issues.map((i) => i.message).join(" "));
        const result = await post<Batch>("/batches", parsed.data);
        setBatch(result);
        await mutate("/batches");
        setStep(4);
      } catch (e) {
        setFormError((e as Error).message);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (step === 4) {
      if (batch?.assessment) {
        setStep(5);
        return;
      }
      setBusy(true);
      setMessage(
        "Checking yield, source conditions, evidence and record patterns",
      );
      try {
        const result = await post<Batch>(`/batches/${batch!.publicId}/analyze`);
        setBatch(result);
        await mutate("/batches");
        toast.success("Explainable risk assessment completed");
      } catch (e) {
        setFormError((e as Error).message);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (step === 5) {
      setBusy(true);
      setProofStage(1);
      try {
        setMessage(
          "Canonicalizing the certified record and signing the fingerprint",
        );
        let result = await post<Batch>(`/batches/${batch!.publicId}/anchor`);
        setBatch(result);
        setProofStage(2);
        setMessage("Transaction broadcast. Waiting for an EVM confirmation");
        result = await post<Batch>(
          `/batches/${batch!.publicId}/anchor/confirm`,
        );
        setBatch(result);
        if (result.status !== "ANCHORED") {
          setFormError(
            "The transaction is pending. Check confirmation again to continue.",
          );
          return;
        }
        setProofStage(3);
        await mutate("/batches");
        await post(`/batches/${batch!.publicId}/passport`);
        setStep(6);
        toast.success("Fingerprint anchored. QR passport issued.");
      } catch (e) {
        setFormError((e as Error).message);
      } finally {
        setBusy(false);
      }
    }
  }
  return (
    <>
      <Link className="back-link" to="/batches">
        ← Honey batches
      </Link>
      <PageHeader
        eyebrow="A new chain of trust"
        title="Give your harvest a verifiable story."
        description="From source hive to a public digital passport, one careful step at a time."
      />
      <ol
        className="wizard-steps"
        tabIndex={0}
        aria-label="Batch creation steps"
      >
        {steps.map((s, i) => (
          <li
            key={s}
            className={i === step ? "active" : i < step ? "complete" : ""}
          >
            <span>{i < step ? <Check size={15} /> : i + 1}</span>
            <strong>{s}</strong>
          </li>
        ))}
      </ol>
      <div className="wizard-layout">
        <section className="wizard-card">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={reduced ? false : { opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <span className="wizard-count">Step {step + 1} of 7</span>
              <h2>
                {
                  [
                    "Start at the source.",
                    "Tell us about the harvest.",
                    "Let the evidence speak.",
                    "Your record, before it’s certified.",
                    "Know what deserves attention.",
                    "Make the fingerprint permanent.",
                    "Your honey has a passport.",
                  ][step]
                }
              </h2>
              <p className="wizard-description">
                {
                  [
                    "Every batch begins with a registered apiary and its hives.",
                    "These details become part of the immutable certified record.",
                    "Producer measurements are useful. Supporting evidence makes them more accountable.",
                    "Review the origin and harvest. Certified fields lock when analysis begins.",
                    "Rules and statistical checks screen for anomalies. No LLM is required.",
                    "Your private record stays in D1. Its SHA-256 fingerprint goes to the EVM registry.",
                    "One QR makes this proof accessible to anyone, without an account.",
                  ][step]
                }
              </p>
              {step === 0 ? (
                <>
                  <label>
                    Source apiary
                    <select
                      value={form.apiaryId}
                      onChange={(e) => {
                        field("apiaryId", e.target.value);
                        field("hiveIds", []);
                      }}
                    >
                      <option value="">Choose an apiary</option>
                      {apiaries.map((a) => (
                        <option value={a.id} key={a.id}>
                          {a.name} · {a.location}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="field-label">Source hives</span>
                  <div className="source-picker">
                    {sourceHives.map((h) => (
                      <label
                        className={
                          form.hiveIds.includes(h.id)
                            ? "source-option selected"
                            : "source-option"
                        }
                        key={h.id}
                      >
                        <input
                          type="checkbox"
                          checked={form.hiveIds.includes(h.id)}
                          onChange={(e) =>
                            field(
                              "hiveIds",
                              e.target.checked
                                ? [...form.hiveIds, h.id]
                                : form.hiveIds.filter((id) => id !== h.id),
                            )
                          }
                        />
                        <Hexagon size={22} />
                        <span>
                          <strong>{h.name}</strong>
                          <small>{h.public_id}</small>
                        </span>
                        <Status value={h.status} />
                      </label>
                    ))}
                  </div>
                  {!form.apiaryId ? (
                    <p className="muted small">
                      Choose an apiary to see its registered hives.
                    </p>
                  ) : null}
                </>
              ) : null}
              {step === 1 ? (
                <>
                  <div className="form-grid">
                    <label>
                      Harvest date
                      <input
                        type="date"
                        value={form.harvestDate}
                        max={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => field("harvestDate", e.target.value)}
                      />
                    </label>
                    <label>
                      Honey type
                      <select
                        value={form.honeyType}
                        onChange={(e) => field("honeyType", e.target.value)}
                      >
                        {[
                          "Acacia",
                          "Multiflora",
                          "Mustard",
                          "Eucalyptus",
                          "Wildflower",
                          "Litchi",
                        ].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Harvest quantity (kg)
                      <input
                        type="number"
                        min="0.001"
                        max="10000"
                        step="0.001"
                        value={form.quantity}
                        onChange={(e) =>
                          field("quantity", Number(e.target.value))
                        }
                      />
                    </label>
                    <label>
                      Lot reference
                      <input
                        maxLength={120}
                        placeholder="MG-SEP-2026-043"
                        value={form.lotInformation}
                        onChange={(e) =>
                          field("lotInformation", e.target.value)
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Extraction method
                    <select
                      value={form.extractionMethod}
                      onChange={(e) =>
                        field("extractionMethod", e.target.value)
                      }
                    >
                      {[
                        "Cold extraction",
                        "Centrifugal extraction",
                        "Gravity filtration",
                      ].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              {step === 2 ? (
                <>
                  <div className="form-grid">
                    <label>
                      Moisture (%)
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={form.moisture}
                        onChange={(e) =>
                          field("moisture", Number(e.target.value))
                        }
                      />
                    </label>
                    <label>
                      HMF (mg/kg, optional)
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        step="0.1"
                        placeholder="Not measured"
                        value={form.hmf}
                        onChange={(e) => field("hmf", e.target.value)}
                      />
                    </label>
                    <label>
                      Diastase (DN, optional)
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        step="0.1"
                        placeholder="Not measured"
                        value={form.diastase}
                        onChange={(e) => field("diastase", e.target.value)}
                      />
                    </label>
                  </div>
                  <label className="file-upload">
                    <Upload size={25} />
                    <strong>
                      {file ? file.name : "Attach a laboratory certificate"}
                    </strong>
                    <span>PDF, PNG or JPEG · up to 5 MB · optional</span>
                    <input
                      type="file"
                      aria-label="Upload certificate"
                      accept="application/pdf,image/png,image/jpeg"
                      onChange={(e) => {
                        setFile(e.target.files?.[0] ?? null);
                        setDocumentId(null);
                      }}
                    />
                  </label>
                  <label>
                    Harvest notes
                    <textarea
                      maxLength={2000}
                      rows={3}
                      placeholder="Floral source, field observations or handling details"
                      value={form.notes}
                      onChange={(e) => field("notes", e.target.value)}
                    />
                  </label>
                </>
              ) : null}
              {step === 3 ? (
                <>
                  <div className="review-origin">
                    <MapMark />
                    <div>
                      <small>Registered source</small>
                      <h3>
                        {apiaries.find((a) => a.id === form.apiaryId)?.name}
                      </h3>
                      <p>
                        {apiaries.find((a) => a.id === form.apiaryId)?.location}
                      </p>
                    </div>
                  </div>
                  <dl className="detail-grid">
                    <div>
                      <dt>Source hives</dt>
                      <dd>
                        {hives
                          .filter((h) => form.hiveIds.includes(h.id))
                          .map((h) => h.public_id)
                          .join(", ")}
                      </dd>
                    </div>
                    <div>
                      <dt>Honey</dt>
                      <dd>{form.honeyType}</dd>
                    </div>
                    <div>
                      <dt>Harvest</dt>
                      <dd>{form.harvestDate}</dd>
                    </div>
                    <div>
                      <dt>Quantity</dt>
                      <dd>{form.quantity} kg</dd>
                    </div>
                    <div>
                      <dt>Moisture</dt>
                      <dd>{form.moisture}%</dd>
                    </div>
                    <div>
                      <dt>Evidence</dt>
                      <dd>{file?.name ?? "No certificate attached"}</dd>
                    </div>
                  </dl>
                  <div className="advisory">
                    <ShieldCheck size={18} />
                    <p>
                      Source coordinates and producer identity come from the
                      registered apiary. They cannot be entered arbitrarily in
                      this form.
                    </p>
                  </div>
                </>
              ) : null}
              {step === 4 ? (
                <>
                  {batch?.assessment ? (
                    <>
                      <div className="assessment-summary">
                        <RiskGauge score={batch.assessment.score} size={150} />
                        <div>
                          <Status value={batch.assessment.classification} />
                          <h3>Screening complete</h3>
                          <p>
                            {batch.assessment.features.length} explainable
                            checks ·{" "}
                            {Math.round(batch.assessment.confidence * 100)}%
                            confidence
                          </p>
                        </div>
                      </div>
                      <ul className="reason-list">
                        {batch.assessment.reasons.slice(0, 6).map((r) => (
                          <li key={r}>
                            <Check size={16} />
                            {r}
                          </li>
                        ))}
                      </ul>
                      <div className="advisory">
                        <strong>Recommendations</strong>
                        {batch.assessment.recommendations.map((r) => (
                          <p key={r}>{r}</p>
                        ))}
                      </div>
                      <p className="scope-note">{batch.assessment.scope}</p>
                    </>
                  ) : (
                    <div className="analysis-ready">
                      <Sparkles size={48} />
                      <h3>Ready for the risk engine.</h3>
                      <p>
                        Yield consistency, moisture, hive conditions, evidence,
                        geographic origin and historical deviation.
                      </p>
                      <Badge tone="neutral">
                        Hybrid rules + statistical features
                      </Badge>
                    </div>
                  )}
                </>
              ) : null}
              {step === 5 ? (
                <>
                  <div className="proof-sequence">
                    {[
                      {
                        icon: FileCheck2,
                        title: "Canonicalize & fingerprint",
                        detail: "Versioned schema · deterministic SHA-256",
                      },
                      {
                        icon: Link2,
                        title: "Sign & broadcast",
                        detail:
                          batch?.proof?.blockchain_tx_hash ??
                          "Worker signer → Solidity registry",
                      },
                      {
                        icon: ShieldCheck,
                        title: "Confirm on-chain",
                        detail:
                          "Read receipt and verify registered fingerprint",
                      },
                    ].map((s, i) => (
                      <div
                        key={s.title}
                        className={
                          proofStage > i
                            ? "complete"
                            : proofStage === i
                              ? "active"
                              : ""
                        }
                      >
                        <span>
                          {proofStage > i ? (
                            <Check size={22} />
                          ) : (
                            <s.icon size={22} />
                          )}
                        </span>
                        <div>
                          <h3>{s.title}</h3>
                          <p className={i === 1 ? "mono" : ""}>{s.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {batch?.proof?.record_hash ? (
                    <div className="hash-block">
                      <small>Certified fingerprint</small>
                      <code>{batch.proof.record_hash}</code>
                    </div>
                  ) : null}
                  <div className="advisory">
                    <Hash size={18} />
                    <p>
                      Anchoring preserves the exact record, including its risk
                      assessment. It does not turn a high-risk record into an
                      approved product.
                    </p>
                  </div>
                </>
              ) : null}
              {step === 6 && batch ? (
                <div className="wizard-passport">
                  <Passport batch={batch} />
                  <Link
                    to={`/batches/${batch.publicId}`}
                    className="btn btn-primary"
                  >
                    View batch & certificate
                    <ArrowRight size={16} />
                  </Link>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
          {formError ? (
            <p role="alert" className="form-error">
              {formError}
            </p>
          ) : null}
          {busy ? (
            <p className="working-message" role="status">
              <span className="live-dot" />
              {message}
            </p>
          ) : null}
          {step < 6 ? (
            <div className="wizard-footer">
              <Button
                variant="ghost"
                disabled={busy || step === 0 || step >= 4}
                onClick={() => setStep(step - 1)}
              >
                <ArrowLeft size={16} />
                Back
              </Button>
              <Button busy={busy} onClick={() => void next()}>
                {step === 3
                  ? "Create record"
                  : step === 4
                    ? batch?.assessment
                      ? "Continue to proof"
                      : "Run risk analysis"
                    : step === 5
                      ? batch?.proof?.blockchain_tx_hash
                        ? "Check confirmation"
                        : "Generate & anchor proof"
                      : "Continue"}
                <ArrowRight size={16} />
              </Button>
            </div>
          ) : null}
        </section>
        <aside className="wizard-aside">
          <span className="outline-hex small-hex">
            <Hexagon size={28} />
          </span>
          <h3>Good records create lasting trust.</h3>
          <p>
            The certified record connects your honey to its physical source. One
            deterministic fingerprint keeps that story accountable.
          </p>
          <ol>
            <li>
              <CheckCheck size={16} />
              Source identity from registered hives
            </li>
            <li>
              <Sparkles size={16} />
              Readable reasons behind every risk score
            </li>
            <li>
              <Hash size={16} />
              Private data stays off-chain
            </li>
            <li>
              <ShieldCheck size={16} />
              Public verification without an account
            </li>
          </ol>
          {batch ? (
            <div className="wizard-batch-id">
              <small>Your batch</small>
              <strong>{batch.publicId}</strong>
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}
function MapMark() {
  return (
    <span className="map-mark">
      <Hexagon size={34} />
    </span>
  );
}
