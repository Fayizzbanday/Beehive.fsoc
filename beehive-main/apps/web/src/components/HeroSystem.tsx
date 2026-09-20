import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  Check,
  Hash,
  Hexagon,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Wifi,
} from "lucide-react";
import { Link } from "react-router-dom";
export default function HeroSystem() {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref);
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!visible || reduced) return;
    const timer = setInterval(() => setStage((s) => (s + 1) % 4), 2600);
    return () => clearInterval(timer);
  }, [visible, reduced]);
  return (
    <div
      className={`hero-system stage-${stage}`}
      ref={ref}
      aria-label="Animated hive telemetry flowing through AI, a cryptographic fingerprint and a QR passport"
    >
      <div className="hero-visual-grid" />
      <svg
        className="topographic-terrain"
        viewBox="0 0 600 550"
        fill="none"
        aria-hidden="true"
      >
        {Array.from({ length: 13 }, (_, i) => (
          <path
            key={i}
            d={`M ${-50 + i * 9} ${430 - i * 10} C ${100 + i * 4} ${230 - i * 7} ${150 + i * 12} ${520 - i * 16} ${280 + i * 5} ${420 - i * 12} S ${520 - i * 4} ${410 - i * 10} ${660 - i * 8} ${210 - i * 6}`}
            stroke="#b9bfa7"
            strokeWidth=".75"
            opacity={0.16 + i * 0.028}
          />
        ))}
        <path
          d="M100 146H265Q300 146 300 180V225 M350 235H480V325 M430 400H270V440H135"
          stroke="#a5ad91"
          strokeWidth="1.3"
          strokeDasharray="3 5"
        />
        {!reduced && visible ? (
          <>
            <circle r="3" fill="#b98922">
              <animateMotion
                dur="6s"
                repeatCount="indefinite"
                path="M100 146H265Q300 146 300 180V225"
              />
            </circle>
            <circle r="3" fill="#849766">
              <animateMotion
                dur="6s"
                begin="2s"
                repeatCount="indefinite"
                path="M350 235H480V325"
              />
            </circle>
            <circle r="3" fill="#b98922">
              <animateMotion
                dur="6s"
                begin="4s"
                repeatCount="indefinite"
                path="M430 400H270V440H135"
              />
            </circle>
          </>
        ) : null}
      </svg>
      <div className="hero-field-label">
        <span className="live-dot" />A living source. A digital proof.
      </div>
      <motion.div
        className="apiary-illustration"
        animate={visible && !reduced ? { y: [0, -7, 0] } : { y: 0 }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg
          viewBox="0 0 390 390"
          aria-label="Isometric connected beehive with honey-colored frames"
        >
          <defs>
            <linearGradient id="hive-front" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#faf5df" />
              <stop offset="1" stopColor="#dfd3b2" />
            </linearGradient>
            <linearGradient id="honey-front" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#f5c963" />
              <stop offset="1" stopColor="#dca331" />
            </linearGradient>
            <linearGradient id="honey-side">
              <stop stopColor="#c6922c" />
              <stop offset="1" stopColor="#b98227" />
            </linearGradient>
            <filter
              id="hive-shadow"
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur stdDeviation="12" />
            </filter>
          </defs>
          <ellipse
            cx="199"
            cy="326"
            rx="112"
            ry="29"
            fill="#72745a"
            opacity=".15"
            filter="url(#hive-shadow)"
          />
          <path
            d="m89 294 110 49 104-60-110-45Z"
            fill="#dcdfca"
            stroke="#c7cbb5"
          />
          <path d="m89 294 110 49v11L89 305Z" fill="#c4c9b3" />
          <path d="m199 343 104-60v11l-104 60Z" fill="#b5bea4" />
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(0 ${-i * 53})`}>
              <path
                d="m110 223 88 41v59l-88-41Z"
                fill={i === 1 ? "url(#honey-front)" : "url(#hive-front)"}
                stroke={i === 1 ? "#d2a044" : "#c7bda0"}
                strokeWidth="1"
              />
              <path
                d="m198 264 86-49v59l-86 49Z"
                fill={i === 1 ? "url(#honey-side)" : "#c7bda0"}
                stroke="#b7aa87"
              />
              <path
                d="m110 223 85-48 89 40-86 49Z"
                fill={i === 1 ? "#f7d58a" : "#f0e9d4"}
                stroke="#d4c8a8"
              />
              <path
                d="m123 240 62 28v3l-62-28Z"
                fill={i === 1 ? "#f8de9b" : "#bfb18a"}
                opacity=".7"
              />
              <path d="m218 267 46-26v5l-46 26Z" fill="#938363" opacity=".6" />
            </g>
          ))}
          <path
            d="m101 112 94-53 98 45-95 55Z"
            fill="#e8e3cf"
            stroke="#c6bd9f"
          />
          <path d="m101 112 97 47v12l-97-46Z" fill="#c9bda0" />
          <path d="m198 159 95-55v13l-95 54Z" fill="#ada787" />
          <path
            d="m147 104 47-26 49 22-47 28Z"
            fill="#eeb547"
            stroke="#d59c2e"
          />
          <path d="m161 104 32-18 34 15-32 19Z" fill="#f4d380" />
          <path d="m134 282 46 21v8l-46-21Z" fill="#5d604b" />
          <path d="m134 290 46 21-15 8-45-21Z" fill="#b3a27d" />
          <g transform="translate(250 133)">
            <path d="M0 0v-40" stroke="#737b57" strokeWidth="3" />
            <circle cy="-43" r="4" fill="#829164" />
            <path
              d="M-12-48q12-14 24 0 M-19-54q19-22 38 0"
              fill="none"
              stroke="#829164"
              strokeWidth="1.5"
              opacity=".55"
            />
          </g>
          <g fill="#708263">
            <path d="M83 275q-27-28-14-38 22 6 14 38 M82 282q-30-8-31-24 20-6 31 24" />
            <path d="M300 305q-5-40 12-44 17 19-12 44 M302 312q25-31 36-19-7 24-36 19" />
          </g>
          <path
            d="m78 275 10 35 M306 285l-10 39"
            stroke="#748064"
            strokeWidth="2"
          />
        </svg>
      </motion.div>
      <button
        className={`hero-data-card telemetry-float ${stage === 0 ? "illuminated" : ""}`}
        onClick={() => setStage(0)}
      >
        <span className="float-icon">
          <Wifi size={15} />
        </span>
        <div>
          <small>Hive intelligence</small>
          <strong>
            34.1<span> °C</span>
            <i className="mini-chart">▁▃▂▅▄▅▃▅</i>
          </strong>
          <span className="float-caption">
            <span className="live-dot" />
            Healthy colony
          </span>
        </div>
      </button>
      <button
        className={`hero-data-card risk-float ${stage === 1 ? "illuminated" : ""}`}
        onClick={() => setStage(1)}
      >
        <span className="float-icon amber">
          <Sparkles size={16} />
        </span>
        <div>
          <small>AI risk analysis</small>
          <strong>
            18<span> / 100</span>
          </strong>
          <span className="float-caption">
            Low risk <Check size={12} />
          </span>
        </div>
      </button>
      <button
        className={`hero-data-card proof-float ${stage === 2 ? "illuminated" : ""}`}
        onClick={() => setStage(2)}
      >
        <span className="float-icon">
          <Hash size={16} />
        </span>
        <div>
          <small>Fingerprint protected</small>
          <strong className="mono">SHA-256</strong>
          <span className="float-caption">
            Anchored on-chain
            <ShieldCheck size={12} />
          </span>
        </div>
      </button>
      <Link
        className={`hero-data-card verify-float ${stage === 3 ? "illuminated" : ""}`}
        to="/verify/BH-2026-000042"
      >
        <span className="float-icon">
          <ScanLine size={20} />
        </span>
        <div>
          <small>The consumer passport</small>
          <strong>Scan. Verify. Trust.</strong>
        </div>
        <ArrowUpRight size={16} />
      </Link>
      <div className="hero-orbit-label">
        <span>Physical world</span>
        <div />
        <span>Verifiable record</span>
      </div>
    </div>
  );
}
