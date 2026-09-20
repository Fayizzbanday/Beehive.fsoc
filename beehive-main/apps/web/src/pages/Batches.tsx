import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  Boxes,
  Download,
  Check,
  ExternalLink,
  FileText,
  Hash,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useApi, post, shortHash, useUser, downloadDocument } from "../lib/api";
import {
  Badge,
  Button,
  CopyButton,
  Empty,
  ErrorState,
  LinkButton,
  Loading,
  PageHeader,
  Panel,
  RiskGauge,
  Status,
} from "../components/ui";
import Passport from "../components/Passport";
import type {
  Batch,
  BatchDocument,
} from "../../../../packages/shared/src/index";
import { formatDate } from "../../../../packages/shared/src/index";
export function BatchTable({ batches }: { batches: Batch[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Honey batch</th>
            <th>Source</th>
            <th>Harvest</th>
            <th>Quantity</th>
            <th>AI risk</th>
            <th>Blockchain</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {batches.map((b) => (
            <tr key={b.id}>
              <td>
                <Link to={`/batches/${b.publicId}`} className="table-name">
                  <span className="batch-small">
                    <Boxes size={18} />
                  </span>
                  <span>
                    <strong>{b.record.honeyType} honey</strong>
                    <small className="mono">{b.publicId}</small>
                  </span>
                </Link>
              </td>
              <td>
                <span className="small">{b.record.hiveIds.join(", ")}</span>
              </td>
              <td>{formatDate(b.record.harvestDate)}</td>
              <td>
                {b.record.quantity} <span className="unit">kg</span>
              </td>
              <td>
                {b.assessment ? (
                  <div className="risk-cell">
                    <strong>{b.assessment.score}</strong>
                    <Status value={b.assessment.classification} />
                  </div>
                ) : (
                  <span className="muted">Not analyzed</span>
                )}
              </td>
              <td>
                <Status value={b.status} />
              </td>
              <td>
                <Link
                  className="icon-button"
                  to={`/batches/${b.publicId}`}
                  aria-label={`View ${b.publicId}`}
                >
                  <ArrowUpRight size={17} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export default function Batches() {
  const { data, error, mutate } = useApi<Batch[]>("/batches");
  const { data: user } = useUser();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All batches");
  if (error) return <ErrorState error={error} retry={() => void mutate()} />;
  if (!data) return <Loading />;
  const filtered = data.filter(
    (b) =>
      `${b.publicId} ${b.record.honeyType} ${b.record.producerName}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "All batches" ||
        (filter === "Anchored" && b.status === "ANCHORED") ||
        (filter === "Needs attention" &&
          b.assessment &&
          b.assessment.score > 30) ||
        (filter === "In progress" && b.status !== "ANCHORED")),
  );
  return (
    <>
      <PageHeader
        eyebrow="Every harvest has a story"
        title="Honey batches"
        description="Create, certify and follow your honey from source to shelf."
        action={
          user?.role !== "authority" ? (
            <LinkButton to="/batches/new">
              <Plus size={17} />
              Create honey batch
            </LinkButton>
          ) : null
        }
      />
      <div className="batch-summary">
        <div>
          <Boxes size={21} />
          <strong>{data.length}</strong>
          <span>Total batches</span>
        </div>
        <div>
          <ShieldCheck size={21} />
          <strong>{data.filter((b) => b.status === "ANCHORED").length}</strong>
          <span>Blockchain anchored</span>
        </div>
        <div>
          <Hash size={21} />
          <strong>
            {data.filter((b) => b.assessment?.classification === "LOW").length}
          </strong>
          <span>Low-risk assessments</span>
        </div>
      </div>
      <Panel>
        <div className="table-toolbar">
          <div className="segmented">
            {["All batches", "Anchored", "Needs attention", "In progress"].map(
              (f) => (
                <button
                  key={f}
                  className={filter === f ? "active" : ""}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ),
            )}
          </div>
          <div className="search-input">
            <Search size={16} />
            <input
              aria-label="Search honey batches"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search batch or honey type"
            />
          </div>
        </div>
        {filtered.length ? (
          <BatchTable batches={filtered} />
        ) : (
          <Empty
            title="No batches match"
            description="Try a different search or create your first honey batch."
          />
        )}
      </Panel>
    </>
  );
}
export function BatchDetail() {
  const { id } = useParams();
  const { data: batch, error, mutate } = useApi<Batch>(`/batches/${id}`);
  const { data: user } = useUser();
  const { data: documents, error: documentsError } = useApi<BatchDocument[]>(
    `/batches/${id}/documents`,
  );
  const [busy, setBusy] = useState("");
  if (error) return <ErrorState error={error} />;
  if (!batch) return <Loading />;
  async function advance() {
    setBusy(
      batch!.status === "DRAFT"
        ? "Running risk analysis"
        : "Preparing and broadcasting fingerprint",
    );
    try {
      let result = batch!;
      if (result.status === "DRAFT")
        result = await post<Batch>(`/batches/${id}/analyze`);
      else {
        result = await post<Batch>(`/batches/${id}/anchor`);
        setBusy("Confirming on the blockchain");
        result = await post<Batch>(`/batches/${id}/anchor/confirm`);
      }
      await mutate(result);
      toast.success(
        result.status === "ANCHORED"
          ? "Fingerprint anchored. Your QR passport is ready."
          : "Record updated.",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <Link to="/batches" className="back-link">
        ← Honey batches
      </Link>
      <PageHeader
        eyebrow={batch.publicId}
        title={`${batch.record.honeyType} honey`}
        description={`${batch.record.producerName} · Harvested ${formatDate(batch.record.harvestDate)}`}
        action={<Status value={batch.status} />}
      />
      <div className="batch-detail-layout">
        <div className="stack">
          <Panel
            title="A record of origin"
            subtitle="The exact fields committed to this certificate"
          >
            <dl className="detail-grid">
              <div>
                <dt>Producer</dt>
                <dd>{batch.record.producerName}</dd>
              </div>
              <div>
                <dt>Origin</dt>
                <dd>{batch.record.origin.region}</dd>
              </div>
              <div>
                <dt>Apiary</dt>
                <dd>{batch.record.apiary}</dd>
              </div>
              <div>
                <dt>Source hives</dt>
                <dd>
                  {batch.record.hiveIds.map((h) => (
                    <Link key={h} to={`/hives/${h}`}>
                      {h}{" "}
                    </Link>
                  ))}
                </dd>
              </div>
              <div>
                <dt>Harvest date</dt>
                <dd>{formatDate(batch.record.harvestDate)}</dd>
              </div>
              <div>
                <dt>Quantity</dt>
                <dd>{batch.record.quantity} kg</dd>
              </div>
              <div>
                <dt>Moisture</dt>
                <dd>{batch.record.qualityMeasurements.moisture}%</dd>
              </div>
              <div>
                <dt>Extraction</dt>
                <dd>{batch.record.extractionMethod}</dd>
              </div>
              <div>
                <dt>Lot reference</dt>
                <dd>{batch.record.lotInformation}</dd>
              </div>
              <div>
                <dt>Evidence</dt>
                <dd>
                  {batch.record.certificateDigest
                    ? "Fingerprint attached"
                    : "Producer-reported measurements"}
                </dd>
              </div>
            </dl>
          </Panel>
          {documentsError ? <ErrorState error={documentsError} /> : null}
          {documents?.length ? (
            <Panel
              title="Evidence and reports"
              subtitle="Original files and their SHA-256 fingerprints"
            >
              <div className="stack">
                {documents.map((document) => (
                  <div className="hash-block" key={document.id}>
                    <strong>{document.filename}</strong>
                    <small>
                      {document.kind === "report"
                        ? "Traceability report"
                        : "Producer evidence"}{" "}
                      · {Math.ceil(document.size / 1024)} KB ·{" "}
                      {formatDate(document.created_at)}
                    </small>
                    <code>{document.digest}</code>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        void downloadDocument(
                          document.id,
                          document.filename,
                        ).catch((error: Error) => toast.error(error.message))
                      }
                    >
                      <Download size={15} /> Download{" "}
                      {document.kind === "report" ? "report" : "evidence"}
                    </Button>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}
          <Panel
            title="AI risk assessment"
            subtitle="Explainable metadata and anomaly screening"
          >
            {batch.assessment ? (
              <>
                <div className="assessment-summary">
                  <RiskGauge score={batch.assessment.score} />
                  <div>
                    <Status value={batch.assessment.classification} />
                    <h3>
                      {batch.assessment.score <= 30
                        ? "Routine monitoring recommended"
                        : "This batch deserves closer attention"}
                    </h3>
                    <p>
                      Screening confidence:{" "}
                      {Math.round(batch.assessment.confidence * 100)}% ·{" "}
                      {batch.assessment.version}
                    </p>
                  </div>
                </div>
                <ul className="reason-list">
                  {batch.assessment.reasons.map((r) => (
                    <li key={r}>
                      <Check size={15} />
                      {r}
                    </li>
                  ))}
                </ul>
                <div className="advisory">
                  <strong>Recommended next steps</strong>
                  {batch.assessment.recommendations.map((r) => (
                    <p key={r}>{r}</p>
                  ))}
                </div>
                <p className="scope-note">{batch.assessment.scope}</p>
              </>
            ) : (
              <Empty
                title="Ready for risk screening"
                description="Analyze quantity, origin, evidence and source conditions before certification."
              />
            )}
          </Panel>
          <Panel
            title="Blockchain proof"
            subtitle="Only the fingerprint is registered on-chain"
          >
            {batch.proof ? (
              <>
                <dl className="detail-list">
                  <div>
                    <dt>Network</dt>
                    <dd>{batch.proof.blockchain_network}</dd>
                  </div>
                  <div>
                    <dt>Schema</dt>
                    <dd>{batch.proof.canonical_payload_version}</dd>
                  </div>
                  <div>
                    <dt>State</dt>
                    <dd>
                      <Status value={batch.proof.status} />
                    </dd>
                  </div>
                  <div>
                    <dt>Confirmed at</dt>
                    <dd>
                      {batch.proof.blockchain_timestamp
                        ? new Date(
                            batch.proof.blockchain_timestamp,
                          ).toLocaleString("en-IN")
                        : "Pending"}
                    </dd>
                  </div>
                </dl>
                <div className="hash-block">
                  <small>SHA-256 certified fingerprint</small>
                  <code>{batch.proof.record_hash}</code>
                  <CopyButton value={batch.proof.record_hash} />
                </div>
                {batch.proof.blockchain_tx_hash ? (
                  <div className="hash-block">
                    <small>Transaction hash</small>
                    <code>{batch.proof.blockchain_tx_hash}</code>
                    <CopyButton value={batch.proof.blockchain_tx_hash} />
                    {batch.proof.explorerUrl ? (
                      <a
                        href={batch.proof.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-link"
                      >
                        View on explorer
                        <ExternalLink size={14} />
                      </a>
                    ) : (
                      <small>
                        Local EVM receipts are available through the JSON-RPC
                        endpoint.
                      </small>
                    )}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="panel-empty">
                The fingerprint will be generated after risk analysis.
              </p>
            )}
            {batch.status !== "ANCHORED" && user?.role !== "authority" ? (
              <Button busy={!!busy} onClick={() => void advance()}>
                {busy ||
                  (batch.status === "DRAFT"
                    ? "Run risk analysis"
                    : "Generate and anchor proof")}
              </Button>
            ) : null}
          </Panel>
          {batch.notes ? (
            <Panel title="Producer notes">
              <p>{batch.notes}</p>
            </Panel>
          ) : null}
        </div>
        <div className="certificate-column">
          {batch.status === "ANCHORED" ? (
            <Passport batch={batch} />
          ) : (
            <div className="passport-placeholder">
              <FileText size={40} />
              <h3>Your passport is next.</h3>
              <p>
                Complete analysis and anchor the fingerprint to issue a public
                verification QR.
              </p>
            </div>
          )}
          <div className="certificate-footnote">
            <ShieldCheck size={18} />
            <p>
              Blockchain confirms the integrity of this record. It does not
              certify the physical honey’s purity.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
