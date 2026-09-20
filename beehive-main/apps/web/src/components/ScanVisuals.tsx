import { motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  Compass,
  Droplets,
  Sun,
  TriangleAlert,
  Wind,
} from "lucide-react";
import type {
  DigitalTwin,
  PlacementReport,
  ScanFinding,
  ScanMetric,
} from "../../../../packages/shared/src/index";
const ROLE_COLOURS: Record<string, string> = {
  BROOD: "var(--amber)",
  HONEY: "#c98b21",
  POLLEN: "var(--green)",
  EMPTY: "var(--line)",
};
/** Detection chips sit over the frame, so a long finding title is trimmed to its first clause. */
const label = (title: string) => {
  const first = title.split("·")[0].trim();
  return first.length > 26 ? `${first.slice(0, 25)}…` : first;
};
export const severityTone = (severity: ScanFinding["severity"]) =>
  severity === "ACTION" ? "red" : severity === "WATCH" ? "amber" : "neutral";
export function KeyframeGallery({
  frames,
  findings,
  active,
  onSelect,
}: {
  frames: { url: string; label: string; timeOffset: number }[];
  findings: ScanFinding[];
  active: number;
  onSelect: (index: number) => void;
}) {
  if (!frames.length) return null;
  const current = frames[Math.min(active, frames.length - 1)];
  const boxes = findings.filter((f) => f.frame === active);
  return (
    <div className="keyframes">
      <div className="keyframe-stage">
        <img
          src={current.url}
          alt={`Keyframe ${active + 1}: ${current.label}`}
        />
        <div className="keyframe-grid" aria-hidden="true" />
        {boxes.map((finding) => (
          <motion.span
            key={finding.id}
            className={`detect-box detect-${severityTone(finding.severity)}`}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            style={{
              left: `${finding.region.x * 100}%`,
              top: `${finding.region.y * 100}%`,
              width: `${finding.region.width * 100}%`,
              height: `${finding.region.height * 100}%`,
            }}
          >
            <b>
              {label(finding.title)} · {Math.round(finding.confidence * 100)}%
            </b>
          </motion.span>
        ))}
        <span className="keyframe-caption">
          {current.label} · {current.timeOffset}s
        </span>
      </div>
      <div
        className="keyframe-strip"
        role="tablist"
        aria-label="Captured keyframes"
      >
        {frames.map((frame, index) => (
          <button
            key={frame.url}
            role="tab"
            aria-selected={index === active}
            className={index === active ? "active" : ""}
            onClick={() => onSelect(index)}
          >
            <img src={frame.url} alt="" />
            <small>
              {index + 1}
              {findings.some((f) => f.frame === index) ? (
                <i className="frame-dot" />
              ) : null}
            </small>
          </button>
        ))}
      </div>
    </div>
  );
}
export function MetricGrid({ metrics }: { metrics: ScanMetric[] }) {
  return (
    <div className="scan-metrics">
      {metrics.map((metric) => (
        <div className={`scan-metric band-${metric.band}`} key={metric.key}>
          <span className="scan-metric-label">{metric.label}</span>
          <strong>
            {metric.value.toLocaleString("en-IN")}
            <i>{metric.unit}</i>
          </strong>
          <p>{metric.detail}</p>
          {metric.benchmark ? <small>{metric.benchmark}</small> : null}
        </div>
      ))}
    </div>
  );
}
export function FindingList({
  findings,
  onFocus,
}: {
  findings: ScanFinding[];
  onFocus?: (frame: number) => void;
}) {
  return (
    <ol className="finding-list">
      {findings.map((finding) => (
        <li key={finding.id}>
          <span
            className={`finding-severity sev-${severityTone(finding.severity)}`}
          >
            {finding.severity}
          </span>
          <div>
            <strong>{finding.title}</strong>
            <p>{finding.detail}</p>
            <p className="finding-action">{finding.action}</p>
            <div className="confidence">
              <span>
                <i
                  style={{ width: `${Math.round(finding.confidence * 100)}%` }}
                />
              </span>
              <small>
                {Math.round(finding.confidence * 100)}% model confidence
              </small>
              {onFocus ? (
                <button
                  className="text-link"
                  onClick={() => onFocus(finding.frame)}
                >
                  Frame {finding.frame + 1}
                </button>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
export function TwinDiagram({ twin }: { twin: DigitalTwin }) {
  const perBox = twin.frames / twin.boxes;
  const heaviest = Math.max(...twin.weight.map((w) => w.kilograms), 1);
  return (
    <div className="twin-grid">
      <div className="twin-hive">
        <svg
          viewBox="0 0 240 200"
          role="img"
          aria-label="Reconstructed hive structure"
        >
          <rect
            x="28"
            y="182"
            width="184"
            height="10"
            rx="3"
            fill="var(--line)"
          />
          <polygon
            points="18,34 222,34 200,12 40,12"
            fill="var(--dark)"
            opacity="0.88"
          />
          {Array.from({ length: twin.boxes }, (_, box) => {
            const height = 142 / twin.boxes;
            const top = 38 + box * height;
            return (
              <g key={box}>
                <rect
                  x="26"
                  y={top}
                  width="188"
                  height={height - 6}
                  rx="4"
                  fill="var(--surface)"
                  stroke="var(--line)"
                  strokeWidth="1.5"
                />
                {twin.frameMap
                  .slice(box * perBox, (box + 1) * perBox)
                  .map((frame, index) => (
                    <motion.rect
                      key={frame.index}
                      initial={{ opacity: 0, scaleY: 0.4 }}
                      animate={{ opacity: 1, scaleY: 1 }}
                      transition={{ delay: 0.02 * frame.index, duration: 0.3 }}
                      style={{ transformOrigin: `0px ${top + height - 8}px` }}
                      x={32 + index * (176 / perBox)}
                      y={top + 4}
                      width={176 / perBox - 3}
                      height={(height - 16) * (frame.coverage / 100)}
                      rx="2"
                      fill={ROLE_COLOURS[frame.role]}
                      opacity={
                        frame.role === "EMPTY" ? 0.5 : 0.35 + frame.capped / 200
                      }
                    />
                  ))}
              </g>
            );
          })}
          <rect
            x="96"
            y="186"
            width="48"
            height="6"
            rx="3"
            fill="var(--amber)"
          />
        </svg>
        <div className="twin-legend">
          {(["BROOD", "HONEY", "POLLEN", "EMPTY"] as const).map((role) => (
            <span key={role}>
              <i style={{ background: ROLE_COLOURS[role] }} />
              {role.toLowerCase()}
            </span>
          ))}
        </div>
      </div>
      <div className="twin-weight">
        <h3>Modelled weight</h3>
        <div className="twin-total">
          <strong>{twin.estimatedWeight} kg</strong>
          {twin.sensorWeight !== null ? (
            <span
              className={
                Math.abs(twin.weightDelta ?? 0) > 1.5 ? "amber" : "green"
              }
            >
              {(twin.weightDelta ?? 0) >= 0 ? (
                <ArrowUpRight size={14} />
              ) : (
                <ArrowDownRight size={14} />
              )}
              {Math.abs(twin.weightDelta ?? 0)} kg vs load cell (
              {twin.sensorWeight} kg)
            </span>
          ) : (
            <span className="muted">No load-cell reading to compare</span>
          )}
        </div>
        <ul className="weight-breakdown">
          {twin.weight.map((part) => (
            <li key={part.component}>
              <span>{part.component}</span>
              <i>
                <motion.b
                  initial={{ width: 0 }}
                  animate={{ width: `${(part.kilograms / heaviest) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </i>
              <strong>{part.kilograms} kg</strong>
            </li>
          ))}
        </ul>
        <dl className="twin-facts">
          <div>
            <dt>Population</dt>
            <dd>{twin.population.toLocaleString("en-IN")} bees</dd>
          </div>
          <div>
            <dt>Sealed brood</dt>
            <dd>{twin.broodAreaCm2.toLocaleString("en-IN")} cm²</dd>
          </div>
          <div>
            <dt>Drawn frames</dt>
            <dd>
              {twin.occupiedFrames} / {twin.frames}
            </dd>
          </div>
          <div>
            <dt>Queen</dt>
            <dd>{twin.queenStatus}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
export function TwinProjections({ twin }: { twin: DigitalTwin }) {
  return (
    <div className="projection-grid">
      {twin.projections.map((projection) => (
        <div key={projection.horizonDays} className="projection">
          <span className="eyebrow">{projection.horizonDays} days</span>
          <strong>{projection.expectedWeight} kg</strong>
          <p>
            about {projection.expectedYield} kg extractable · risk{" "}
            {projection.riskScore}/100
          </p>
          <small>{projection.note}</small>
        </div>
      ))}
      <div className="projection expected-diseases">
        <span className="eyebrow">Expected pressure</span>
        <ul>
          {twin.expectedDiseases.map((disease) => (
            <li key={disease.name}>
              <strong>{disease.name}</strong>
              <span>{Math.round(disease.probability * 100)}%</span>
              <small>within {disease.window}</small>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
export function PlacementMap({ placement }: { placement: PlacementReport }) {
  return (
    <div className="placement-grid">
      <div className="placement-map">
        <svg
          viewBox="0 0 100 100"
          role="img"
          aria-label="Recommended hive placement"
        >
          <defs>
            <radialGradient id="sunGlow" cx="0.5" cy="0.5">
              <stop offset="0%" stopColor="var(--amber)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--amber)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="100" height="100" fill="var(--paper)" />
          <circle cx="82" cy="18" r="30" fill="url(#sunGlow)" />
          <path
            d="M2 74 Q26 62 48 72 T98 66"
            fill="none"
            stroke="var(--green)"
            strokeWidth="1.4"
            strokeDasharray="3 2"
            opacity="0.7"
          />
          <path
            d="M0 88 Q30 80 56 88 T100 84 L100 100 L0 100 Z"
            fill="var(--green)"
            opacity="0.14"
          />
          {placement.recommendedSpots.map((spot, index) => (
            <motion.g
              key={spot.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.12 }}
            >
              <circle
                cx={spot.x}
                cy={spot.y}
                r={index === 0 ? 5.5 : 4}
                fill={index === 0 ? "var(--amber)" : "var(--surface)"}
                stroke="var(--dark)"
                strokeWidth="1.1"
              />
              <text
                x={spot.x}
                y={spot.y - 8}
                textAnchor="middle"
                fontSize="4.4"
                fill="var(--ink)"
              >
                {spot.suitability}
              </text>
            </motion.g>
          ))}
          <g opacity="0.7">
            <path d="M7 12 l5 2.5 -5 2.5 z" fill="var(--muted)" />
            <text x="14" y="16" fontSize="3.2" fill="var(--muted)">
              prevailing wind
            </text>
          </g>
          <g opacity="0.75">
            <circle cx="90" cy="90" r="1.4" fill="var(--muted)" />
            <path
              d="M90 88.6 v-4.6 M88.4 86 l1.6-2 1.6 2"
              fill="none"
              stroke="var(--muted)"
              strokeWidth="0.7"
            />
            <text
              x="90"
              y="96"
              fontSize="3"
              textAnchor="middle"
              fill="var(--muted)"
            >
              N
            </text>
          </g>
          <g opacity="0.8">
            <path
              d="M14 78 q2.6-4 2.6-5.6 a2.6 2.6 0 1 0-5.2 0 q0 1.6 2.6 5.6 z"
              fill="#7d94a8"
            />
            <text x="19" y="78" fontSize="3" fill="var(--muted)">
              water
            </text>
          </g>
        </svg>
        <div className="placement-legend">
          <span>
            <Sun size={14} /> {placement.sunlightHours} h morning sun
          </span>
          <span>
            <Compass size={14} /> {placement.orientation}
          </span>
          <span>
            <Droplets size={14} /> {placement.carryingCapacity} colonies
            supported
          </span>
        </div>
      </div>
      <div className="placement-spots">
        {placement.recommendedSpots.map((spot, index) => (
          <div key={spot.id} className={index === 0 ? "spot primary" : "spot"}>
            <div>
              <strong>{spot.label}</strong>
              <small>
                {spot.distanceMeters === 0
                  ? "At the scan marker"
                  : `${spot.distanceMeters} m from the marker`}{" "}
                · {spot.orientation.toLowerCase()}
              </small>
            </div>
            <p>{spot.rationale}</p>
            <span className="spot-score">{spot.suitability}</span>
          </div>
        ))}
        <ul className="placement-cautions">
          {placement.cautions.map((caution) => (
            <li key={caution}>
              {caution.startsWith("No blocking") ? (
                <Wind size={15} />
              ) : (
                <TriangleAlert size={15} />
              )}
              {caution}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
