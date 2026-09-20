import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import {
  Camera,
  CircleStop,
  Clock,
  Cpu,
  Hexagon,
  Leaf,
  RefreshCw,
  ScanEye,
  ShieldAlert,
  Sparkles,
  Upload,
  Video,
} from "lucide-react";
import {
  SCAN_MODES,
  SCAN_MODE_LABELS,
  type Hive,
  type Scan as ScanRecord,
  type ScanMode,
} from "../../../../packages/shared/src/index";
import { api, apiUrl, useApi, useUser } from "../lib/api";
import {
  Badge,
  Button,
  Empty,
  ErrorState,
  LinkButton,
  Loading,
  PageHeader,
  Panel,
  RiskGauge,
  SectionLink,
  Status,
} from "../components/ui";
import {
  FindingList,
  KeyframeGallery,
  MetricGrid,
  PlacementMap,
  TwinDiagram,
  TwinProjections,
} from "../components/ScanVisuals";
import {
  captureFromFile,
  cameraSupported,
  recordFromPreview,
  releaseCapture,
  FRAME_TARGET,
  MAX_RECORDING_SECONDS,
  type Capture,
  type Recording,
} from "../lib/video";
const MODE_ICONS: Record<ScanMode, typeof Camera> = {
  HONEY_QUALITY: Sparkles,
  ENVIRONMENT: Leaf,
  DISEASE: ShieldAlert,
  DIGITAL_TWIN: Cpu,
};
const PIPELINE = [
  "Decoding keyframes on device",
  "Segmenting comb, colony and terrain",
  "Matching against the reference library",
  "Composing the field report",
];
export function ScanReportView({
  scan,
  frames,
}: {
  scan: ScanRecord;
  frames: { url: string; label: string; timeOffset: number }[];
}) {
  const [active, setActive] = useState(0);
  const { report } = scan;
  return (
    <>
      <Panel className="scan-verdict">
        <RiskGauge
          score={
            report.headline.unit === "/ 100"
              ? report.headline.value
              : report.score
          }
          label={report.headline.label}
          kind={
            report.headline.unit === "/ 100" && report.mode !== "DISEASE"
              ? "health"
              : "risk"
          }
          size={170}
        />
        <div>
          <div className="scan-verdict-badges">
            <Badge tone="neutral">{SCAN_MODE_LABELS[report.mode].title}</Badge>
            <Status value={report.classification} />
            <Badge tone="amber">Simulated prototype scan</Badge>
          </div>
          <h2>{report.title}</h2>
          <p>{report.summary}</p>
          <dl className="scan-meta">
            <div>
              <dt>Scan</dt>
              <dd className="mono">{scan.publicId}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>
                {scan.source === "camera" ? "Recorded in app" : "Uploaded clip"}{" "}
                · {scan.durationSeconds}s · {scan.frameCount} frames
              </dd>
            </div>
            <div>
              <dt>Capture fingerprint</dt>
              <dd className="mono">{scan.captureDigest.slice(0, 18)}…</dd>
            </div>
            <div>
              <dt>Model confidence</dt>
              <dd>{Math.round(report.confidence * 100)}%</dd>
            </div>
          </dl>
        </div>
      </Panel>
      {frames.length ? (
        <Panel
          title="What the model looked at"
          subtitle="Keyframes extracted on device, with the regions each finding came from"
        >
          <KeyframeGallery
            frames={frames}
            findings={report.findings}
            active={active}
            onSelect={setActive}
          />
        </Panel>
      ) : null}
      <Panel title="Measurements" subtitle={`Engine ${report.engine}`}>
        <MetricGrid metrics={report.metrics} />
      </Panel>
      {report.twin ? (
        <>
          <Panel
            title="Digital twin"
            subtitle="Reconstructed structure, stores and modelled weight"
          >
            <TwinDiagram twin={report.twin} />
          </Panel>
          <Panel
            title="Projected 90 days"
            subtitle="Expected weight, yield and disease pressure if conditions hold"
          >
            <TwinProjections twin={report.twin} />
          </Panel>
        </>
      ) : null}
      {report.placement ? (
        <Panel
          title="Where to put the hive"
          subtitle={`Site suitability ${report.placement.suitability} / 100`}
        >
          <PlacementMap placement={report.placement} />
        </Panel>
      ) : null}
      <div className="dashboard-grid">
        <Panel
          title="Findings"
          subtitle="Ranked by severity and model confidence"
        >
          <FindingList
            findings={report.findings}
            onFocus={frames.length ? setActive : undefined}
          />
        </Panel>
        <Panel title="What to do next">
          <ol className="recommendation-list">
            {report.recommendations.map((recommendation) => (
              <li key={recommendation}>{recommendation}</li>
            ))}
          </ol>
          <p className="scope-note">{report.scope}</p>
          {report.mode === "HONEY_QUALITY" ? (
            <SectionLink to="/batches/new">
              Create a batch from this harvest
            </SectionLink>
          ) : report.mode === "ENVIRONMENT" ? (
            <SectionLink to="/hives">Register a hive at this site</SectionLink>
          ) : (
            <SectionLink to={`/hives/${scan.hivePublicId ?? ""}`}>
              Open this hive's telemetry
            </SectionLink>
          )}
        </Panel>
      </div>
    </>
  );
}
function ScanHistory({ scans }: { scans: ScanRecord[] }) {
  if (!scans.length)
    return (
      <Empty
        title="No scans yet"
        description="Record a short clip of a frame, a colony or a candidate site to generate your first report."
      />
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Scan</th>
            <th>Mode</th>
            <th>Source</th>
            <th>Result</th>
            <th>Captured</th>
          </tr>
        </thead>
        <tbody>
          {scans.map((scan) => (
            <tr key={scan.id}>
              <td>
                <Link className="table-name" to={`/scan/${scan.publicId}`}>
                  <span className="hive-small healthy">
                    <ScanEye size={18} />
                  </span>
                  <span>
                    <strong>{scan.publicId}</strong>
                    <small>
                      {scan.hivePublicId ?? scan.apiary ?? "Site scan"}
                    </small>
                  </span>
                </Link>
              </td>
              <td>{SCAN_MODE_LABELS[scan.mode].title}</td>
              <td>{scan.source === "camera" ? "Recorded" : "Uploaded"}</td>
              <td>
                <Status value={scan.classification} />
              </td>
              <td>{new Date(scan.createdAt).toLocaleString("en-IN")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export default function Scan() {
  const { data: user } = useUser();
  const { data: hives } = useApi<Hive[]>("/hives");
  const { data: scans, error, mutate } = useApi<ScanRecord[]>("/scans");
  const { mutate: globalMutate } = useSWRConfig();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<ScanMode>("HONEY_QUALITY");
  const [hivePublicId, setHivePublicId] = useState(params.get("hive") ?? "");
  const [stage, setStage] = useState<
    "setup" | "live" | "ready" | "analysing" | "done"
  >("setup");
  const [capture, setCapture] = useState<Capture | null>(null);
  const [result, setResult] = useState<ScanRecord | null>(null);
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingRef = useRef<Recording | null>(null);
  const recordingTimer = useRef<number | null>(null);
  const captureRef = useRef<Capture | null>(null);
  captureRef.current = capture;
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);
  useEffect(
    () => () => {
      recordingRef.current?.cancel();
      stopCamera();
      releaseCapture(captureRef.current);
    },
    [stopCamera],
  );
  const hive = hives?.find((h) => h.public_id === hivePublicId) ?? hives?.[0];
  const needsHive = SCAN_MODE_LABELS[mode].needsHive;
  const apiaryId = hive?.apiary_id ?? "";
  function reset() {
    setRecording(false);
    releaseCapture(capture);
    setCapture(null);
    setResult(null);
    setStage("setup");
  }
  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      releaseCapture(capture);
      setCapture(null);
      setResult(null);
      setStage("live");
    } catch {
      toast.error(
        "Camera access was refused. Upload a clip instead, or allow camera access and retry.",
      );
    }
  }
  function startRecording() {
    if (!videoRef.current || !streamRef.current) return;
    recordingRef.current = recordFromPreview(
      videoRef.current,
      streamRef.current,
      FRAME_TARGET,
    );
    setElapsed(0);
    const started = Date.now();
    const timer = window.setInterval(() => {
      const seconds = (Date.now() - started) / 1000;
      setElapsed(seconds);
      if (seconds >= MAX_RECORDING_SECONDS) {
        window.clearInterval(timer);
        void stopRecording();
      }
    }, 100);
    recordingTimer.current = timer;
    setRecording(true);
  }
  async function stopRecording() {
    if (recordingTimer.current) window.clearInterval(recordingTimer.current);
    const active = recordingRef.current;
    if (!active) return;
    recordingRef.current = null;
    setRecording(false);
    setBusy(true);
    try {
      const taken = await active.stop();
      stopCamera();
      setCapture(taken);
      setStage("ready");
    } catch (e) {
      toast.error((e as Error).message);
      setStage("setup");
    } finally {
      setBusy(false);
    }
  }
  async function onUpload(file: File) {
    setBusy(true);
    try {
      releaseCapture(capture);
      const taken = await captureFromFile(file, FRAME_TARGET);
      stopCamera();
      setCapture(taken);
      setResult(null);
      setStage("ready");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function analyse() {
    if (!capture) return;
    if (needsHive && !hive) {
      toast.error("Register a hive before running this scan.");
      return;
    }
    if (!apiaryId) {
      toast.error("No apiary is linked to your workspace yet.");
      return;
    }
    setStage("analysing");
    setStep(0);
    const ticker = window.setInterval(
      () => setStep((current) => Math.min(PIPELINE.length - 1, current + 1)),
      620,
    );
    const form = new FormData();
    form.append(
      "metadata",
      JSON.stringify({
        mode,
        apiaryId,
        hiveId: needsHive ? (hive?.public_id ?? null) : null,
        source: capture.source,
        captureDigest: capture.digest,
        durationSeconds: capture.durationSeconds,
        frameCount: capture.frames.length,
        notes: "",
      }),
    );
    capture.frames.forEach((frame, index) =>
      form.append("frame", frame.blob, `frame-${index}.jpg`),
    );
    try {
      const [scan] = await Promise.all([
        api<ScanRecord>("/scans", { method: "POST", body: form }),
        new Promise((resolve) => setTimeout(resolve, PIPELINE.length * 620)),
      ]);
      setResult(scan);
      setStage("done");
      await Promise.all([mutate(), globalMutate("/activity")]);
      toast.success(
        `${scan.publicId} analysed · ${scan.classification} result`,
      );
    } catch (e) {
      toast.error((e as Error).message);
      setStage("ready");
    } finally {
      window.clearInterval(ticker);
    }
  }
  if (error) return <ErrorState error={error} retry={() => void mutate()} />;
  if (!scans || !hives) return <Loading />;
  const readOnly = user?.role === "authority";
  return (
    <>
      <PageHeader
        eyebrow="AI vision · prototype"
        title="Scan a hive, a frame, or a site."
        description="Record a short clip and BeeHive returns a structured field report: honey readiness, disease pressure, placement advice, or a full digital twin."
        action={
          <LinkButton to="/forecast" variant="secondary">
            Market risk forecast
          </LinkButton>
        }
      />
      {readOnly ? null : (
        <>
          <div className="scan-modes" role="radiogroup" aria-label="Scan mode">
            {SCAN_MODES.map((option) => {
              const Icon = MODE_ICONS[option];
              return (
                <button
                  key={option}
                  role="radio"
                  aria-checked={mode === option}
                  className={`scan-mode ${mode === option ? "active" : ""}`}
                  onClick={() => setMode(option)}
                >
                  <Icon size={20} />
                  <strong>{SCAN_MODE_LABELS[option].title}</strong>
                  <small>{SCAN_MODE_LABELS[option].tagline}</small>
                </button>
              );
            })}
          </div>
          <Panel className="scan-studio">
            <div className="scan-stage">
              <div className={`capture-surface stage-${stage}`}>
                <video
                  ref={videoRef}
                  className={stage === "live" ? "visible" : ""}
                  muted
                  playsInline
                />
                {stage === "setup" ? (
                  <div className="capture-idle">
                    <Video size={30} />
                    <h3>Point the camera at the subject</h3>
                    <p>
                      A slow {MAX_RECORDING_SECONDS}-second sweep is enough.
                      Frames are extracted in the browser — the video never
                      leaves your device.
                    </p>
                  </div>
                ) : null}
                {stage === "live" ? (
                  <div className="capture-live">
                    <span className="rec-dot" />
                    {recording
                      ? `${elapsed.toFixed(1)}s / ${MAX_RECORDING_SECONDS}s`
                      : "Camera ready"}
                    <div
                      className="capture-progress"
                      style={{
                        width: `${Math.min(100, (elapsed / MAX_RECORDING_SECONDS) * 100)}%`,
                      }}
                    />
                  </div>
                ) : null}
                {capture && stage !== "live" ? (
                  <div className="capture-frames">
                    {capture.frames.map((frame) => (
                      <img key={frame.url} src={frame.url} alt="" />
                    ))}
                  </div>
                ) : null}
                {stage === "analysing" ? (
                  <div className="capture-analysing">
                    <span className="scan-sweep" />
                    <ol>
                      {PIPELINE.map((label, index) => (
                        <li
                          key={label}
                          className={
                            index < step
                              ? "done"
                              : index === step
                                ? "active"
                                : ""
                          }
                        >
                          {label}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </div>
              <div className="capture-controls">
                {stage === "live" ? (
                  recording ? (
                    <Button
                      variant="danger"
                      busy={busy}
                      onClick={() => void stopRecording()}
                    >
                      <CircleStop size={17} />
                      Stop and analyse
                    </Button>
                  ) : (
                    <Button onClick={startRecording}>
                      <span className="rec-dot" />
                      Start recording
                    </Button>
                  )
                ) : (
                  <Button
                    onClick={() => void openCamera()}
                    disabled={!cameraSupported() || stage === "analysing"}
                  >
                    <Camera size={17} />
                    {capture ? "Record again" : "Open camera"}
                  </Button>
                )}
                <label
                  className={`btn btn-secondary ${busy ? "disabled" : ""}`}
                >
                  <Upload size={17} />
                  Upload a clip
                  <input
                    type="file"
                    accept="video/*"
                    capture="environment"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void onUpload(file);
                    }}
                  />
                </label>
                {capture && stage === "ready" ? (
                  <Button
                    variant="secondary"
                    busy={busy}
                    onClick={() => void analyse()}
                  >
                    <Sparkles size={17} />
                    Run AI analysis
                  </Button>
                ) : null}
                {stage === "done" ? (
                  <Button variant="ghost" onClick={reset}>
                    <RefreshCw size={16} />
                    New scan
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="scan-setup">
              <label>
                Subject hive
                <select
                  value={hive?.public_id ?? ""}
                  disabled={!needsHive}
                  onChange={(event) => setHivePublicId(event.target.value)}
                >
                  {hives.map((option) => (
                    <option key={option.id} value={option.public_id}>
                      {option.public_id} · {option.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="scan-setup-note">
                {needsHive
                  ? "The report is grounded in this hive's latest telemetry: temperature, humidity and load-cell weight."
                  : "A site scan needs no hive. The report is grounded in the apiary's registered coordinates."}
              </p>
              <ul className="scan-facts">
                <li>
                  <Clock size={15} />
                  {capture
                    ? `${capture.durationSeconds}s captured · ${capture.frames.length} keyframes`
                    : `Up to ${MAX_RECORDING_SECONDS}s · ${FRAME_TARGET} keyframes`}
                </li>
                <li>
                  <Hexagon size={15} />
                  {hive
                    ? `${hive.apiary} · ${hive.location}`
                    : "No hive selected"}
                </li>
                <li>
                  <ScanEye size={15} />
                  Deterministic demo model · the same clip always returns the
                  same report
                </li>
              </ul>
              <p className="scope-note">
                Prototype simulation. Vision output supports beekeeping
                decisions; it never enters the certified record or the
                blockchain proof.
              </p>
            </div>
          </Panel>
        </>
      )}
      {result && stage === "done" ? (
        <ScanReportView
          scan={result}
          frames={(capture?.frames ?? []).map((frame, index) => ({
            url: frame.url,
            label: result.report.frames[index]?.label ?? `Frame ${index + 1}`,
            timeOffset: frame.timeOffset,
          }))}
        />
      ) : null}
      <Panel
        title="Scan history"
        subtitle="Every capture is stored with its keyframes and report"
        action={<SectionLink to="/forecast">Market risk forecast</SectionLink>}
      >
        <ScanHistory scans={scans} />
      </Panel>
    </>
  );
}
export function ScanDetail() {
  const { id } = useParams();
  const { data: scan, error } = useApi<ScanRecord>(`/scans/${id}`);
  if (error) return <ErrorState error={error} />;
  if (!scan) return <Loading />;
  return (
    <>
      <Link className="back-link" to="/scan">
        ← All scans
      </Link>
      <PageHeader
        eyebrow={`${scan.publicId} · ${new Date(scan.createdAt).toLocaleString("en-IN")}`}
        title={SCAN_MODE_LABELS[scan.mode].title}
        description={
          scan.hivePublicId
            ? `${scan.hivePublicId} · ${scan.hiveName ?? ""} · ${scan.apiary ?? ""}`
            : (scan.apiary ?? "Site scan")
        }
        action={<Status value={scan.classification} />}
      />
      <ScanReportView
        scan={scan}
        frames={Array.from({ length: scan.storedFrames }, (_, index) => ({
          url: apiUrl(`/scans/${scan.publicId}/frames/${index}`),
          label: scan.report.frames[index]?.label ?? `Frame ${index + 1}`,
          timeOffset: scan.report.frames[index]?.timeOffset ?? 0,
        }))}
      />
    </>
  );
}
