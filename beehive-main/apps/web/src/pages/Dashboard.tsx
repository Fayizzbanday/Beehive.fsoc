import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  Hexagon,
  MapPin,
  Plus,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useApi, useUser } from "../lib/api";
import {
  Badge,
  ErrorState,
  LinkButton,
  Loading,
  Metric,
  PageHeader,
  Panel,
  SectionLink,
} from "../components/ui";
import { HiveTable } from "./Hives";
import { BatchTable } from "./Batches";
import type {
  Batch,
  Hive,
  Reading,
} from "../../../../packages/shared/src/index";
const TelemetryChart = lazy(() =>
  import("../components/Charts").then((m) => ({ default: m.TelemetryChart })),
);
export default function Dashboard() {
  const { data: user } = useUser();
  const { data: hives, error: hiveError } = useApi<Hive[]>("/hives", 15000);
  const { data: batches, error: batchError } = useApi<Batch[]>(
    "/batches",
    15000,
  );
  const { data: metrics } = useApi<{ activeAlerts: number }>(
    "/dashboard/metrics",
    15000,
  );
  const { data: activity } = useApi<
    { action: string; detail: string; created_at: string; entity_id: string }[]
  >("/activity", 15000);
  const { data: readings } = useApi<Reading[]>(
    hives?.[0] ? `/hives/${hives[0].public_id}/readings` : null,
    15000,
  );
  if (hiveError || batchError)
    return <ErrorState error={hiveError ?? batchError} />;
  if (!hives || !batches) return <Loading />;
  const healthy = hives.filter((h) => h.status === "Healthy").length;
  return (
    <>
      <PageHeader
        eyebrow="Your apiary, at a glance"
        title={`Good to see you, ${user?.name.split(" ")[0] ?? "beekeeper"}.`}
        description="A healthy hive. An honest harvest. A stronger chain of trust."
        action={
          user?.role !== "authority" ? (
            <LinkButton to="/batches/new">
              <Plus size={17} />
              Create honey batch
            </LinkButton>
          ) : null
        }
      />
      <div className="metrics-grid five">
        <Metric
          label="Total hives"
          value={hives.length}
          detail="Connected to your workspace"
          icon={<Hexagon />}
        />
        <Metric
          label="Healthy hives"
          value={healthy}
          detail={`${Math.round((healthy / Math.max(1, hives.length)) * 100)}% of your colonies`}
          icon={<Activity />}
        />
        <Metric
          label="Active alerts"
          value={metrics?.activeAlerts ?? 0}
          detail="Source and batch cases to review"
          icon={<TriangleAlert />}
        />
        <Metric
          label="Honey batches"
          value={batches.length}
          detail="Traceable harvest records"
          icon={<Boxes />}
        />
        <Metric
          label="Anchored batches"
          value={batches.filter((b) => b.status === "ANCHORED").length}
          detail="Immutable fingerprints registered"
          icon={<ShieldCheck />}
        />
      </div>
      <div className="dashboard-grid">
        <Panel
          title="The pulse of your apiary"
          subtitle={`${hives[0]?.name ?? "Source hive"} · recent temperature`}
          action={<Badge tone="green">Sensor history</Badge>}
        >
          {readings ? (
            <Suspense fallback={<Loading />}>
              <TelemetryChart readings={readings} />
            </Suspense>
          ) : (
            <div className="skeleton sk-chart" />
          )}
          <div className="chart-footer">
            <span>
              <span className="chart-legend" />
              Temperature °C
            </span>
            <Link to="/hives">
              Explore hive intelligence
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </Panel>
        <section className="harvest-feature">
          <div>
            <span className="feature-hex">
              <Hexagon size={32} />
            </span>
            <Badge tone="neutral">Your next harvest</Badge>
          </div>
          <h2>
            From your hive.
            <br />
            With proof.
          </h2>
          <p>
            Give every honey batch a risk assessment, an immutable fingerprint,
            and a passport anyone can verify.
          </p>
          <Link to="/batches/new">
            Create a honey batch
            <ArrowRight size={20} />
          </Link>
          <div className="harvest-rings" aria-hidden="true" />
        </section>
      </div>
      <Panel
        title="Apiary status"
        subtitle="Current source readings and colony conditions"
        action={<SectionLink to="/hives">All hives</SectionLink>}
      >
        <HiveTable hives={hives.slice(0, 4)} />
      </Panel>
      <div className="dashboard-bottom">
        <Panel
          title="Recent honey batches"
          action={<SectionLink to="/batches">View all</SectionLink>}
        >
          <BatchTable batches={batches.slice(0, 4)} />
        </Panel>
        <Panel
          title="The trust trail"
          subtitle="Recorded activity across your workspace"
        >
          <ol className="activity-list">
            {activity?.slice(0, 6).map((a, i) => (
              <li key={`${a.created_at}-${i}`}>
                <span className="timeline-dot">
                  <Check size={10} />
                </span>
                <div>
                  <strong>{a.action}</strong>
                  <p>
                    {a.detail.length > 90
                      ? `${a.detail.slice(0, 87)}…`
                      : a.detail}
                  </p>
                  <small>
                    {new Date(a.created_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    ·{" "}
                    {new Date(a.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </small>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </>
  );
}
