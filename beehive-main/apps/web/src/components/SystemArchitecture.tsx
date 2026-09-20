import { useRef, useState } from "react";
import { motion, useReducedMotion, useInView } from "framer-motion";
import {
  Activity,
  Boxes,
  Cloud,
  Code2,
  Database,
  FileText,
  Hash,
  Hexagon,
  Link2,
  QrCode,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
const nodes = [
  {
    id: "hive",
    name: "Hive / IoT",
    tech: "ESP32 · producer input",
    icon: Hexagon,
    x: 90,
    y: 70,
  },
  {
    id: "react",
    name: "React application",
    tech: "TypeScript · Vite",
    icon: Code2,
    x: 320,
    y: 70,
  },
  {
    id: "pages",
    name: "Cloudflare Pages",
    tech: "Global frontend delivery",
    icon: Cloud,
    x: 550,
    y: 70,
  },
  {
    id: "worker",
    name: "Worker API",
    tech: "Validation · roles · routing",
    icon: Boxes,
    x: 320,
    y: 200,
  },
  {
    id: "d1",
    name: "D1 database",
    tech: "Private records · audit history",
    icon: Database,
    x: 90,
    y: 330,
  },
  {
    id: "risk",
    name: "Risk engine",
    tech: "Rules + statistical features",
    icon: Sparkles,
    x: 320,
    y: 330,
  },
  {
    id: "r2",
    name: "R2 evidence",
    tech: "Documents · certificates",
    icon: FileText,
    x: 550,
    y: 330,
  },
  {
    id: "hash",
    name: "SHA-256",
    tech: "Canonical record fingerprint",
    icon: Hash,
    x: 320,
    y: 460,
  },
  {
    id: "evm",
    name: "EVM registry",
    tech: "Solidity · immutable hashes",
    icon: Link2,
    x: 550,
    y: 460,
  },
  {
    id: "qr",
    name: "QR passport",
    tech: "Public URL only",
    icon: QrCode,
    x: 320,
    y: 590,
  },
  {
    id: "consumer",
    name: "Consumer",
    tech: "No account required",
    icon: ScanLine,
    x: 90,
    y: 590,
  },
  {
    id: "authority",
    name: "Authority",
    tech: "Risk & integrity review",
    icon: ShieldCheck,
    x: 550,
    y: 590,
  },
];
const edges = [
  ["hive", "react"],
  ["pages", "react"],
  ["react", "worker"],
  ["worker", "d1"],
  ["worker", "risk"],
  ["worker", "r2"],
  ["risk", "hash"],
  ["d1", "hash"],
  ["hash", "evm"],
  ["evm", "qr"],
  ["qr", "consumer"],
  ["d1", "authority"],
  ["evm", "authority"],
  ["consumer", "react"],
  ["worker", "authority"],
];
const scenarios = {
  "Create Batch": {
    path: ["hive", "react", "worker", "d1", "risk", "hash", "evm", "d1", "qr"],
    description:
      "A registered source becomes a private D1 record. The risk assessment joins the certified payload, whose fingerprint is anchored before a QR is issued.",
  },
  "Verify Batch": {
    path: [
      "consumer",
      "qr",
      "react",
      "worker",
      "d1",
      "hash",
      "evm",
      "consumer",
    ],
    description:
      "The public URL starts a new check. The Worker rehashes the current record, reads the configured registry, and compares the two fingerprints.",
  },
  "Hive Alert": {
    path: ["hive", "react", "worker", "d1", "risk", "authority"],
    description:
      "An authenticated device reading is validated and stored. Abnormal colony conditions generate a persistent alert for the producer and authority.",
  },
  "Tampering Attack": {
    path: ["d1", "hash", "evm", "authority"],
    description:
      "A certified database value changes. Rehashing exposes a mismatch against the immutable registry. The public verdict changes and an authority incident is recorded.",
  },
};
export default function SystemArchitecture() {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { amount: 0.1 });
  const [scenario, setScenario] =
    useState<keyof typeof scenarios>("Create Batch");
  const [selected, setSelected] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const active = scenarios[scenario];
  const attack = scenario === "Tampering Attack";
  const selectedNode = nodes.find((n) => n.id === selected);
  return (
    <div
      ref={ref}
      className={`system-architecture ${attack ? "architecture-attack" : ""}`}
    >
      <div
        className="architecture-scenarios"
        aria-label="Architecture scenario"
      >
        {Object.keys(scenarios).map((s) => (
          <button
            key={s}
            className={scenario === s ? "active" : ""}
            aria-pressed={scenario === s}
            onClick={() => {
              setScenario(s as keyof typeof scenarios);
              setSelected(null);
            }}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="architecture-content">
        <div className="architecture-canvas">
          <svg
            className="architecture-lines"
            viewBox="0 0 640 660"
            aria-hidden="true"
          >
            {edges.map(([from, to]) => {
              const a = nodes.find((n) => n.id === from)!,
                b = nodes.find((n) => n.id === to)!;
              const enabled = selected
                ? from === selected || to === selected
                : active.path.includes(from) && active.path.includes(to);
              const d = `M${a.x} ${a.y} C${a.x} ${(a.y + b.y) / 2},${b.x} ${(a.y + b.y) / 2},${b.x} ${b.y}`;
              return (
                <g key={`${from}-${to}`}>
                  <path
                    d={d}
                    fill="none"
                    stroke={
                      enabled ? (attack ? "#c3705c" : "#a2ac87") : "#e0e3d6"
                    }
                    strokeWidth={enabled ? 1.6 : 1}
                    strokeDasharray={enabled ? "4 5" : "none"}
                  />
                  {enabled && !reduced && visible ? (
                    <circle r="3.5" fill={attack ? "#c66a55" : "#bd9538"}>
                      <animateMotion
                        dur="3.5s"
                        repeatCount="indefinite"
                        path={d}
                      />
                    </circle>
                  ) : null}
                </g>
              );
            })}
          </svg>
          {nodes.map((node) => (
            <button
              className={`architecture-node ${active.path.includes(node.id) ? "path-active" : ""} ${selected === node.id ? "selected" : ""}`}
              key={node.id}
              style={{
                left: `${(node.x / 640) * 100}%`,
                top: `${(node.y / 660) * 100}%`,
              }}
              onMouseEnter={() => setSelected(node.id)}
              onMouseLeave={() => setSelected(null)}
              onFocus={() => setSelected(node.id)}
              onBlur={() => setSelected(null)}
              onClick={() => setSelected(node.id)}
              aria-label={`${node.name}: ${node.tech}`}
            >
              <span>
                <node.icon size={18} />
              </span>
              <strong>{node.name}</strong>
              <small>{node.tech}</small>
            </button>
          ))}
        </div>
        <aside className="architecture-story">
          <span className="architecture-story-icon">
            {attack ? <ShieldCheck size={25} /> : <Activity size={25} />}
          </span>
          <h3>{selectedNode?.name ?? scenario}</h3>
          <p>{selectedNode?.tech ?? active.description}</p>
          <ol>
            {active.path.map((id, i) => {
              const n = nodes.find((n) => n.id === id)!;
              return (
                <li
                  className={selected === id ? "highlighted" : ""}
                  key={`${id}-${i}`}
                >
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {n.name}
                </li>
              );
            })}
          </ol>
          <div className="architecture-boundary">
            <LockNote />
            <strong>Trust boundary</strong>
            <p>
              Private records and keys stay inside the Worker infrastructure.
              The public chain stores fingerprints.
            </p>
          </div>
        </aside>
      </div>
      <div className="tech-badges">
        {[
          "React",
          "Cloudflare Pages",
          "Workers",
          "D1",
          "R2",
          "Solidity",
          "EVM",
          "SHA-256",
        ].map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </div>
  );
}
function LockNote() {
  return <ShieldCheck size={19} />;
}
