import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
  animate,
  useMotionValue,
  useTransform,
} from "framer-motion";
import {
  ArrowRight,
  Check,
  Database,
  FileText,
  Hash,
  Hexagon,
  Link2,
  Pause,
  Play,
  QrCode,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  ShieldX,
  Sparkles,
} from "lucide-react";
import { QRCode } from "./Passport";
const states = [
  "idle",
  "collecting",
  "analyzing",
  "hashing",
  "anchoring",
  "generatingQR",
  "verifying",
  "authentic",
  "tampering",
  "rehashing",
  "mismatch",
] as const;
export type TrustState = (typeof states)[number];
const durations = [
  1300, 2100, 2400, 2100, 2300, 1800, 2000, 3600, 2300, 2000, 3800,
];
const descriptions = [
  [
    "It starts with a living source.",
    "A connected hive records temperature, humidity and weight.",
  ],
  [
    "A harvest becomes a record.",
    "Producer, source hive, harvest and quality measurements form one traceability record.",
  ],
  [
    "AI finds what deserves attention.",
    "Rules and statistical checks explain suspicious metadata. This is risk screening, not a purity test.",
  ],
  [
    "One exact record. One fingerprint.",
    "Canonical JSON turns certified fields into a deterministic SHA-256 hash.",
  ],
  [
    "The fingerprint becomes permanent.",
    "A Worker signs a real transaction. The Solidity registry stores only the fingerprint and public reference.",
  ],
  [
    "Proof gets a public doorway.",
    "A QR contains only the public verification URL. Private database data stays out of the code.",
  ],
  [
    "Anyone can check the story.",
    "A consumer opens the passport. BeeHive rehashes the current record and reads the blockchain proof.",
  ],
  [
    "The fingerprints match.",
    "The current record is exactly the record that was certified. Its integrity is authentic.",
  ],
  [
    "Now, change a database value.",
    "The harvest quantity changes from 25 kg to 250 kg. The immutable blockchain proof stays unchanged.",
  ],
  [
    "Same algorithm. Different answer.",
    "The modified record produces a new SHA-256 fingerprint, which cannot match the original proof.",
  ],
  [
    "Tampering is visible. Immediately.",
    "The consumer sees an integrity mismatch and the authority receives an alert. Proof protects the story.",
  ],
];
const stages = [
  { name: "Hive", icon: Hexagon, state: 0 },
  { name: "Create record", icon: FileText, state: 1 },
  { name: "AI analyze", icon: Sparkles, state: 2 },
  { name: "SHA-256", icon: Hash, state: 3 },
  { name: "Blockchain", icon: Link2, state: 4 },
  { name: "QR passport", icon: QrCode, state: 5 },
  { name: "Consumer verify", icon: ScanLine, state: 6 },
];
export default function TrustChainAnimation() {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { amount: 0.2 });
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const state = states[index];
  const tampered = index >= 8;
  const active =
    index <= 6
      ? index
      : index === 7
        ? 6
        : index === 8
          ? 1
          : index === 9
            ? 3
            : 6;
  useEffect(() => {
    if (paused || reduced || !visible) return;
    const timer = setTimeout(
      () => setIndex((i) => (i + 1) % states.length),
      durations[index],
    );
    return () => clearTimeout(timer);
  }, [index, paused, reduced, visible]);
  return (
    <div
      className={`trust-chain ${tampered ? "chain-tampered" : ""} ${paused || reduced ? "animation-paused" : ""}`}
      ref={ref}
      data-state={state}
    >
      <div className="chain-toolbar">
        <span>
          <span className="live-dot" />
          Interactive walkthrough
        </span>
        <div>
          <span className="chain-cycle">
            {tampered ? "02 / Integrity challenge" : "01 / Certification"}
          </span>
          <button
            className="icon-button"
            onClick={() => {
              if (reduced) setIndex((i) => (i + 1) % states.length);
              else setPaused((p) => !p);
            }}
            aria-label={
              reduced
                ? "Advance animation"
                : paused
                  ? "Play animation"
                  : "Pause animation"
            }
          >
            {paused || reduced ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button
            className="icon-button"
            aria-label="Restart animation"
            onClick={() => {
              setIndex(0);
              setPaused(false);
            }}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
      <div className="chain-stage-row">
        <div className="chain-track" aria-hidden="true">
          <div
            className="chain-track-progress"
            style={{ width: `${(active / 6) * 100}%` }}
          />
          {!paused && !reduced ? (
            <>
              <motion.span
                className="chain-mobile-packet"
                key={`${index}-vertical`}
                initial={{
                  top: `${(Math.max(0, active - 1) / 6) * 100}%`,
                  opacity: 0,
                }}
                animate={{
                  top: `${(active / 6) * 100}%`,
                  opacity: [0, 1, 1, 0],
                }}
                transition={{ duration: 1.4 }}
              />
              <motion.span
                className="chain-packet"
                key={`${index}-packet`}
                initial={{
                  left: `${(Math.max(0, active - 1) / 6) * 100}%`,
                  opacity: 0,
                }}
                animate={{
                  left: `${(active / 6) * 100}%`,
                  opacity: [0, 1, 1, 0],
                }}
                transition={{ duration: 1.4 }}
              />
            </>
          ) : null}
        </div>
        {stages.map((stage, i) => (
          <button
            key={stage.name}
            className={`chain-stage ${active === i ? "active" : ""} ${index >= i ? "visited" : ""}`}
            onClick={() => {
              setIndex(stage.state);
              setPaused(true);
            }}
            aria-pressed={active === i}
          >
            <span className="chain-node">
              <stage.icon size={27} />
              {active === i && !reduced ? (
                <motion.span
                  className="node-halo"
                  initial={{ scale: 0.85, opacity: 0.6 }}
                  animate={{ scale: 1.45, opacity: 0 }}
                  transition={{ duration: 1.7, repeat: paused ? 0 : Infinity }}
                />
              ) : null}
              <span className="node-index">
                {String(i + 1).padStart(2, "0")}
              </span>
            </span>
            <strong>{stage.name}</strong>
            <small>
              {
                [
                  "Physical source",
                  "Harvest metadata",
                  "Risk screening",
                  "Record fingerprint",
                  "Immutable proof",
                  "Public doorway",
                  "Rehash & compare",
                ][i]
              }
            </small>
          </button>
        ))}
      </div>
      <div className="chain-demonstration">
        <div className="chain-record">
          <div>
            <FileText size={15} />
            <span>BH-2026-000042</span>
            <span className="chain-record-state">
              {tampered ? "Modified record" : "Certified record"}
            </span>
          </div>
          <div className="record-content">
            <span>
              <small>Origin</small>
              <strong>Jammu & Kashmir</strong>
            </span>
            <span>
              <small>Honey</small>
              <strong>Acacia</strong>
            </span>
            <span
              className={
                tampered ? "record-quantity changed" : "record-quantity"
              }
            >
              <small>Quantity</small>
              <AnimatePresence mode="wait">
                <motion.strong
                  key={tampered ? "250" : "25"}
                  initial={reduced ? false : { y: 7, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -7, opacity: 0 }}
                >
                  {tampered ? "250" : "25"} kg
                </motion.strong>
              </AnimatePresence>
            </span>
          </div>
        </div>
        <div className="chain-transform" aria-hidden="true">
          <ArrowRight size={20} />
        </div>
        <div className="chain-result">
          <AnimatePresence mode="wait">
            <motion.div
              key={state}
              initial={reduced ? false : { opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {index <= 1 ? (
                <>
                  <Hexagon size={26} />
                  <div>
                    <small>Hive HIVE-0042</small>
                    <strong>34.1°C · 56% RH</strong>
                    <span>Sensor input → traceability record</span>
                  </div>
                </>
              ) : index === 2 ? (
                <>
                  <Sparkles size={29} />
                  <div>
                    <small>Explainable AI risk</small>
                    <strong>
                      <AnimatedRisk /> / 100 <em>LOW</em>
                    </strong>
                    <span>Evidence and metadata screening</span>
                  </div>
                </>
              ) : index === 3 || index === 9 ? (
                <>
                  <Hash size={29} />
                  <div>
                    <small>
                      {index === 9
                        ? "Recalculated fingerprint"
                        : "Canonical JSON → SHA-256"}
                    </small>
                    <strong className="mono">
                      {index === 9 ? "9c72f4e1…61d803ab" : "a8f32d09…be704c12"}
                    </strong>
                    <span>Illustrated hash · 256 bits</span>
                  </div>
                </>
              ) : index === 4 ? (
                <>
                  <Link2 size={29} />
                  <div>
                    <small>Solidity registry</small>
                    <strong>
                      Fingerprint registered <Check size={16} />
                    </strong>
                    <span>Private records stay off-chain</span>
                  </div>
                </>
              ) : index === 5 ? (
                <>
                  <QRCode
                    value={`${window.location.origin}/verify/BH-2026-000042`}
                    size={70}
                  />
                  <div>
                    <small>Digital passport</small>
                    <strong>One public verification URL</strong>
                    <span>Scan with any phone camera</span>
                  </div>
                </>
              ) : index === 8 ? (
                <>
                  <Database size={29} />
                  <div>
                    <small>Controlled database modification</small>
                    <strong className="red-text">25 kg → 250 kg</strong>
                    <span>Blockchain fingerprint unchanged</span>
                  </div>
                </>
              ) : index === 10 ? (
                <>
                  <ShieldX size={32} />
                  <div>
                    <small>Current hash ≠ anchored hash</small>
                    <strong className="red-text">TAMPERED</strong>
                    <span>Integrity mismatch · Authority alerted</span>
                  </div>
                </>
              ) : (
                <>
                  <ShieldCheck size={32} />
                  <div>
                    <small>Current hash = anchored hash</small>
                    <strong className="chain-authentic">AUTHENTIC</strong>
                    <span>
                      {index === 6
                        ? "Checking the public passport"
                        : "Exact certified record verified"}
                    </span>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <div className="chain-explanation">
        <div className="chain-step-number">
          {String(active + 1).padStart(2, "0")}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={state}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <h3>{descriptions[index][0]}</h3>
            <p>{descriptions[index][1]}</p>
          </motion.div>
        </AnimatePresence>
        <div className="chain-dots" aria-label="Animation stage selection">
          {stages.map((s, i) => (
            <button
              key={s.name}
              className={i === active ? "active" : ""}
              aria-label={`Explain ${s.name}`}
              aria-pressed={i === active}
              onClick={() => {
                setIndex(s.state);
                setPaused(true);
              }}
            />
          ))}
        </div>
      </div>
      <span className="chain-caption">
        Illustrated sequence. Run the connected demo to inspect real hashes and
        transactions.
      </span>
    </div>
  );
}
function AnimatedRisk() {
  const value = useMotionValue(0);
  const rounded = useTransform(value, (v) => Math.round(v));
  const reduced = useReducedMotion();
  useEffect(() => {
    const controls = animate(value, 18, { duration: reduced ? 0 : 1.5 });
    return controls.stop;
  }, [value, reduced]);
  return <motion.span>{rounded}</motion.span>;
}
