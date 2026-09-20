import { lazy, Suspense, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  Droplets,
  Hexagon,
  MapPin,
  Plus,
  Radio,
  ScanEye,
  Thermometer,
  Weight,
  Wind,
} from "lucide-react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { useApi, post, useUser } from "../lib/api";
import {
  Badge,
  Button,
  CopyButton,
  Empty,
  ErrorState,
  LinkButton,
  Loading,
  Metric,
  Modal,
  PageHeader,
  Panel,
  RiskGauge,
  SectionLink,
  Status,
} from "../components/ui";
import type {
  Batch,
  Hive,
  Reading,
  Scan,
} from "../../../../packages/shared/src/index";
import { SCAN_MODE_LABELS } from "../../../../packages/shared/src/index";
const TelemetryChart = lazy(() =>
  import("../components/Charts").then((m) => ({ default: m.TelemetryChart })),
);
export function HiveTable({ hives }: { hives: Hive[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Hive / source</th>
            <th>Temperature</th>
            <th>Humidity</th>
            <th>Est. weight</th>
            <th>Health</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {hives.map((h) => (
            <tr key={h.id}>
              <td>
                <Link className="table-name" to={`/hives/${h.public_id}`}>
                  <span className={`hive-small ${h.status.toLowerCase()}`}>
                    <Hexagon size={19} />
                  </span>
                  <span>
                    <strong>{h.public_id}</strong>
                    <small>{h.name}</small>
                  </span>
                </Link>
              </td>
              <td>
                {h.temperature ?? "—"}
                <span className="unit"> °C</span>
              </td>
              <td>
                {h.humidity ?? "—"}
                <span className="unit"> %</span>
              </td>
              <td>
                {h.weight ?? "—"}
                <span className="unit"> kg</span>
              </td>
              <td>
                <Status value={h.status} />
              </td>
              <td>
                <Link
                  className="icon-button"
                  aria-label={`View ${h.public_id}`}
                  to={`/hives/${h.public_id}`}
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
export default function Hives() {
  const { data: hives, error, mutate } = useApi<Hive[]>("/hives", 15000);
  const { data: apiaries } =
    useApi<{ id: string; name: string }[]>("/apiaries");
  const { data: user } = useUser();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (error) return <ErrorState error={error} retry={() => void mutate()} />;
  if (!hives) return <Loading />;
  return (
    <>
      <PageHeader
        eyebrow="Connected to the source"
        title="Hive intelligence"
        description="A closer look at the living source of every batch."
        action={
          user?.role !== "authority" ? (
            <Button onClick={() => setOpen(true)}>
              <Plus size={17} />
              Register hive
            </Button>
          ) : null
        }
      />
      <div className="metrics-grid four">
        <Metric
          label="Connected hives"
          value={hives.length}
          icon={<Hexagon />}
        />
        <Metric
          label="Healthy colonies"
          value={hives.filter((h) => h.status === "Healthy").length}
          icon={<Activity />}
        />
        <Metric
          label="Need attention"
          value={hives.filter((h) => h.status !== "Healthy").length}
          icon={<Wind />}
        />
        <Metric
          label="Average health"
          value={`${Math.round(hives.reduce((s, h) => s + h.healthScore, 0) / Math.max(1, hives.length))}%`}
          icon={<Radio />}
        />
      </div>
      <div className="hive-grid">
        {hives.map((h) => (
          <Link className="hive-card" to={`/hives/${h.public_id}`} key={h.id}>
            <div className="hive-card-top">
              <span className={`hive-small ${h.status.toLowerCase()}`}>
                <Hexagon size={23} />
              </span>
              <Status value={h.status} />
            </div>
            <h2>{h.name}</h2>
            <span className="mono muted">{h.public_id}</span>
            <p className="location">
              <MapPin size={13} />
              {h.apiary} · {h.location}
            </p>
            <div className="hive-readings">
              <span>
                <Thermometer size={16} />
                <strong>{h.temperature ?? "—"}°</strong>
                <small>Temperature</small>
              </span>
              <span>
                <Droplets size={16} />
                <strong>{h.humidity ?? "—"}%</strong>
                <small>Humidity</small>
              </span>
              <span>
                <Weight size={16} />
                <strong>
                  {h.weight ?? "—"}
                  <i> kg</i>
                </strong>
                <small>Est. weight</small>
              </span>
            </div>
            <div className="hive-card-footer">
              <span>
                <span className="live-dot" />
                {h.timestamp
                  ? new Date(h.timestamp).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Awaiting readings"}
              </span>
              <ArrowUpRight size={17} />
            </div>
          </Link>
        ))}
      </div>
      {!hives.length ? (
        <Empty
          title="Register your first hive"
          description="Connect a colony to start collecting readings and creating traceable batches."
        />
      ) : null}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Register a hive"
        description="Connect a physical colony to your BeeHive workspace."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            try {
              await post("/hives", {
                name: f.get("name"),
                apiaryId: f.get("apiary"),
                species: f.get("species"),
                queenAge: Number(f.get("queenAge")),
                installationDate: f.get("installationDate"),
              });
              await mutate();
              setOpen(false);
              toast.success("Hive registered");
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Hive name
            <input
              name="name"
              required
              minLength={2}
              maxLength={80}
              placeholder="North orchard colony"
            />
          </label>
          <label>
            Apiary
            <select name="apiary" required>
              {apiaries?.map((a) => (
                <option value={a.id} key={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Species
            <select name="species">
              <option>Apis mellifera</option>
              <option>Apis cerana indica</option>
            </select>
          </label>
          <div className="form-grid">
            <label>
              Queen age (months)
              <input
                type="number"
                min="0"
                max="60"
                name="queenAge"
                defaultValue="6"
                required
              />
            </label>
            <label>
              Installed on
              <input
                type="date"
                name="installationDate"
                max={new Date().toISOString().slice(0, 10)}
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </label>
          </div>
          <Button type="submit" busy={busy}>
            Register hive
          </Button>
        </form>
      </Modal>
    </>
  );
}
export function HiveDetail() {
  const { id } = useParams();
  const { data, error, mutate } = useApi<{
    hive: Hive;
    readings: Reading[];
    inspections: {
      id: string;
      notes: string;
      inspector: string;
      created_at: string;
    }[];
    alerts: { id: string; title: string; detail: string }[];
  }>(`/hives/${id}`, 15000);
  const { data: batches } = useApi<Batch[]>("/batches");
  const { data: scans } = useApi<Scan[]>(`/scans?hiveId=${id}`);
  const { data: health } = useApi<{ demoMode: boolean }>("/health");
  const { data: user } = useUser();
  const { mutate: globalMutate } = useSWRConfig();
  const [busy, setBusy] = useState("");
  const [token, setToken] = useState("");
  const [field, setField] = useState<"temperature" | "humidity" | "weight">(
    "temperature",
  );
  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading />;
  const { hive, readings, inspections, alerts } = data;
  async function simulate(mode: string) {
    setBusy(mode);
    try {
      await post(`/hives/${id}/simulate`, { mode });
      await Promise.all([
        mutate(),
        globalMutate("/hives"),
        globalMutate("/activity"),
      ]);
      toast[mode === "stress" ? "warning" : "success"](
        mode === "stress"
          ? "Hive warning generated. Authority notified."
          : "Healthy readings received.",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <Link className="back-link" to="/hives">
        ← All hives
      </Link>
      <PageHeader
        eyebrow={hive.public_id}
        title={hive.name}
        description={`${hive.apiary} · ${hive.location}`}
        action={<Status value={hive.status} />}
      />
      <div className="hive-detail-grid">
        <Panel className="health-card">
          <RiskGauge
            score={hive.healthScore}
            label="Colony health"
            kind="health"
            size={175}
          />
          <div>
            <h2>
              {hive.status === "Healthy"
                ? "A colony in balance."
                : "Your colony needs a closer look."}
            </h2>
            <p>
              {hive.status === "Healthy"
                ? "Temperature and humidity are within the configured monitoring range."
                : "Check ventilation, water access and shading. Inspect the colony before the next harvest."}
            </p>
            <Badge tone={hive.status === "Healthy" ? "green" : "amber"}>
              Sensor-based advisory
            </Badge>
          </div>
        </Panel>
        <div className="metrics-grid three">
          <Metric
            label="Temperature"
            value={`${hive.temperature ?? "—"}°C`}
            detail="Target: 32–36°C"
            icon={<Thermometer />}
          />
          <Metric
            label="Humidity"
            value={`${hive.humidity ?? "—"}%`}
            detail="Monitor: 40–65%"
            icon={<Droplets />}
          />
          <Metric
            label="Hive weight"
            value={`${hive.weight ?? "—"} kg`}
            detail="Hive + colony + stores"
            icon={<Weight />}
          />
        </div>
      </div>
      <div className="dashboard-grid">
        <Panel
          title="The rhythm of your hive"
          subtitle="Timestamped sensor observations"
          action={
            <SectionLink to={`/hives/${id}/readings`}>View history</SectionLink>
          }
        >
          <div className="segmented">
            {(["temperature", "humidity", "weight"] as const).map((f) => (
              <button
                key={f}
                className={field === f ? "active" : ""}
                onClick={() => setField(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <Suspense fallback={<Loading />}>
            <TelemetryChart
              readings={readings}
              field={field}
              color={field === "temperature" ? "#bc913a" : "#708569"}
              unit={
                field === "temperature"
                  ? "°C"
                  : field === "humidity"
                    ? "%"
                    : "kg"
              }
            />
          </Suspense>
        </Panel>
        <Panel
          title="Field notes"
          subtitle="The physical source behind the proof"
        >
          <dl className="detail-list">
            <div>
              <dt>Species</dt>
              <dd>{hive.species}</dd>
            </div>
            <div>
              <dt>Queen age</dt>
              <dd>{hive.queen_age} months</dd>
            </div>
            <div>
              <dt>Installed</dt>
              <dd>{hive.installation_date}</dd>
            </div>
            <div>
              <dt>Coordinates</dt>
              <dd>
                {hive.latitude}° N, {hive.longitude}° E
              </dd>
            </div>
          </dl>
          {inspections.map((i) => (
            <div className="inspection" key={i.id}>
              <span className="live-dot" />
              <div>
                <strong>{i.inspector}</strong>
                <p>{i.notes}</p>
                <small>
                  {new Date(i.created_at).toLocaleDateString("en-IN")}
                </small>
              </div>
            </div>
          ))}
        </Panel>
      </div>
      {health?.demoMode && user?.role !== "authority" ? (
        <Panel className="simulator">
          <div>
            <Badge tone="amber">Sensor simulator</Badge>
            <h3>Bring the hive into the demonstration.</h3>
            <p>
              Write a real reading to D1. Stress conditions create a persistent
              warning.
            </p>
          </div>
          <div className="button-row">
            <Button
              variant="secondary"
              busy={busy === "healthy"}
              disabled={!!busy}
              onClick={() => void simulate("healthy")}
            >
              <Activity size={16} />
              Simulate Healthy Data
            </Button>
            <Button
              variant="danger"
              busy={busy === "stress"}
              disabled={!!busy}
              onClick={() => void simulate("stress")}
            >
              <Wind size={16} />
              Simulate Hive Stress
            </Button>
          </div>
        </Panel>
      ) : null}
      {alerts.length ? (
        <Panel title="Latest alerts">
          {alerts.map((a) => (
            <div className="alert-inline" key={a.id}>
              <Wind size={20} />
              <div>
                <strong>{a.title}</strong>
                <p>{a.detail}</p>
              </div>
            </div>
          ))}
        </Panel>
      ) : null}
      <Panel
        title="AI vision scans"
        subtitle="Simulated prototype reports from recorded clips of this colony"
        action={
          <SectionLink to={`/scan?hive=${hive.public_id}`}>
            New scan
          </SectionLink>
        }
      >
        {scans?.length ? (
          <div className="source-batches">
            {scans.slice(0, 4).map((scan) => (
              <Link key={scan.id} to={`/scan/${scan.publicId}`}>
                <span>
                  <strong>{SCAN_MODE_LABELS[scan.mode].title}</strong>
                  <small>
                    {scan.publicId} ·{" "}
                    {new Date(scan.createdAt).toLocaleDateString("en-IN")}
                  </small>
                </span>
                <Status value={scan.classification} />
                <ArrowUpRight size={17} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="alert-inline">
            <ScanEye size={20} />
            <div>
              <strong>No scan yet for this colony</strong>
              <p>
                Record a short clip to estimate disease pressure, honey
                readiness or a full digital twin.
              </p>
            </div>
          </div>
        )}
      </Panel>
      <Panel
        title="Honey from this hive"
        action={<SectionLink to="/batches/new">Create batch</SectionLink>}
      >
        <div className="source-batches">
          {batches
            ?.filter((b) => b.record.hiveIds.includes(hive.public_id))
            .map((b) => (
              <Link key={b.id} to={`/batches/${b.publicId}`}>
                <span>
                  <strong>{b.record.honeyType} honey</strong>
                  <small>
                    {b.publicId} · {b.record.quantity} kg
                  </small>
                </span>
                <Status value={b.status} />
                <ArrowUpRight size={17} />
              </Link>
            ))}
        </div>
      </Panel>
      {user?.role !== "authority" ? (
        <details className="device-settings">
          <summary>Connect an ESP32 device</summary>
          <p>
            Generate a per-hive bearer token. Rotating it immediately
            invalidates the previous token.
          </p>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const r = await post<{ token: string }>(
                  `/hives/${id}/device-token`,
                );
                setToken(r.token);
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Generate device token
          </Button>
          {token ? (
            <>
              <code className="hash-text">{token}</code>
              <CopyButton value={token} />
            </>
          ) : null}
        </details>
      ) : null}
    </>
  );
}
export function HiveReadings() {
  const { id } = useParams();
  const { data, error } = useApi<Reading[]>(`/hives/${id}/readings`);
  if (error) return <ErrorState error={error} />;
  if (!data) return <Loading />;
  return (
    <>
      <Link to={`/hives/${id}`} className="back-link">
        ← Hive details
      </Link>
      <PageHeader
        title="Sensor history"
        description={`${id} · Most recent 1,000 timestamped observations`}
      />
      <Panel>
        <div
          className="table-scroll readings-table"
          tabIndex={0}
          role="region"
          aria-label="Sensor reading history"
        >
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Temperature</th>
                <th>Humidity</th>
                <th>Weight</th>
                <th>Activity</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.timestamp).toLocaleString("en-IN")}</td>
                  <td>{r.temperature}°C</td>
                  <td>{r.humidity}%</td>
                  <td>{r.weight} kg</td>
                  <td>{r.activity ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
