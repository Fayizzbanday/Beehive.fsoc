import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Globe2,
  Hexagon,
  Leaf,
  Menu,
  Network,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Users,
  Wifi,
  X,
} from "lucide-react";
import { useInView } from "framer-motion";
import HeroSystem from "../components/HeroSystem";
import { Badge, Logo, Status } from "../components/ui";
import { useApi } from "../lib/api";
import type { Hive } from "../../../../packages/shared/src/index";
const TrustChainAnimation = lazy(
  () => import("../components/TrustChainAnimation"),
);
const SystemArchitecture = lazy(
  () => import("../components/SystemArchitecture"),
);
export default function Home() {
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const architectureRef = useRef<HTMLDivElement>(null);
  const showArchitecture = useInView(architectureRef, {
    once: true,
    margin: "250px",
  });
  useEffect(() => {
    const handle = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handle, { passive: true });
    return () => window.removeEventListener("scroll", handle);
  }, []);
  return (
    <div className="home-page">
      <header className={`home-navbar ${scrolled ? "scrolled" : ""}`}>
        <div className="nav-container">
          <Logo />
          <nav
            className={menu ? "home-nav open" : "home-nav"}
            aria-label="Main navigation"
          >
            <a href="#platform" onClick={() => setMenu(false)}>
              Platform
            </a>
            <a href="#traceability" onClick={() => setMenu(false)}>
              Traceability
            </a>
            <a href="#intelligence" onClick={() => setMenu(false)}>
              Hive intelligence
            </a>
            <a href="#authorities" onClick={() => setMenu(false)}>
              For authorities
            </a>
            <Link to="/architecture" onClick={() => setMenu(false)}>
              Architecture
            </Link>
          </nav>
          <div className="home-nav-actions">
            <Link to="/verify" className="nav-verify">
              <ScanLine size={17} />
              Scan / Verify
            </Link>
            <Link to="/dashboard" className="btn btn-dark">
              Launch dashboard
              <ArrowUpRight size={16} />
            </Link>
            <button
              className="icon-button mobile-only"
              onClick={() => setMenu(!menu)}
              aria-label={menu ? "Close menu" : "Open menu"}
              aria-expanded={menu}
            >
              {menu ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>
      <main id="main">
        <section className="hero container" id="platform">
          <div className="hero-copy">
            <div className="hero-kicker">
              <span className="kicker-hex">
                <Hexagon size={14} />
              </span>
              <span>A better future for honey starts at the hive.</span>
            </div>
            <p className="hero-credit">Created by fsociety</p>
            <h1>
              From hive
              <br />
              to honey.
              <br />
              Every claim,
              <br />
              verifiable.
            </h1>
            <p>
              AI watches the risk. Blockchain protects the proof.
              <br className="desktop-only" /> One QR connects you to the whole
              story.
            </p>
            <div className="hero-actions">
              <a href="#traceability" className="btn btn-primary">
                Explore the trust chain
                <ArrowRight size={17} />
              </a>
              <Link to="/verify" className="btn btn-outline">
                <ScanLine size={17} />
                Verify a batch
              </Link>
            </div>
            <div className="hero-bottom-note">
              <span className="mini-avatars">
                <i>BK</i>
                <i>PR</i>
                <i>AU</i>
              </span>
              <span>
                Built for beekeepers.
                <br />
                <strong>Trusted by everyone.</strong>
              </span>
              <span className="hero-note-divider" />
              <Leaf size={24} className="hero-leaf" />
            </div>
          </div>
          <HeroSystem />
          <a className="hero-scroll" href="#traceability">
            <ArrowDown size={14} />
            Follow the honey. Find the proof.
          </a>
        </section>
        <div className="trust-strip">
          <div className="container">
            <span>
              <Hexagon size={19} />
              Hive intelligence
            </span>
            <span className="strip-plus">+</span>
            <span>
              <Sparkles size={19} />
              Explainable AI
            </span>
            <span className="strip-plus">+</span>
            <span>
              <ShieldCheck size={19} />
              Blockchain integrity
            </span>
            <span className="strip-plus">+</span>
            <span>
              <ScanLine size={19} />A public QR passport
            </span>
            <span className="strip-outcome">
              One connected ecosystem
              <ArrowUpRight size={16} />
            </span>
          </div>
        </div>
        <section className="flow-section" id="traceability">
          <div className="container">
            <div className="section-heading light-heading">
              <div>
                <span className="section-index">
                  01 / Traceability, made visible
                </span>
                <h2>
                  One continuous
                  <br />
                  chain of trust.
                </h2>
              </div>
              <p>
                A record travels from the hive to your hands.
                <br />
                See what makes it trusted. Then see what
                <br className="desktop-only" /> happens when someone changes it.
              </p>
            </div>
            <Suspense
              fallback={
                <div className="animation-loading">
                  Loading the interactive trust chain…
                </div>
              }
            >
              <TrustChainAnimation />
            </Suspense>
            <div className="flow-bottom">
              <span>
                <ShieldCheck size={16} />
                The fingerprint is immutable. The verification is always fresh.
              </span>
              <Link to="/login?role=admin">
                Try the real tamper demonstration
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
        </section>
        <section className="intelligence-section container" id="intelligence">
          <div className="section-heading">
            <div>
              <span className="section-index">
                02 / Connected to the source
              </span>
              <h2>
                Healthy hives.
                <br />A stronger foundation.
              </h2>
            </div>
            <div>
              <p>
                Traceability doesn’t start at the bottle.
                <br />
                It starts with a living colony, and the
                <br className="desktop-only" /> people who care for it.
              </p>
              <Link to="/hives" className="text-link">
                Explore hive intelligence
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
          <LivePreview />
        </section>
        <section className="pipeline-section container">
          <div className="pipeline-heading">
            <span className="section-index">
              Three technologies. One purpose.
            </span>
            <h2>Intelligence meets integrity.</h2>
            <p>
              Each part does one thing well. Together, they make the whole story
              accountable.
            </p>
          </div>
          <div className="pipeline-cards">
            <article>
              <div className="pipeline-card-art ai-art">
                <span className="radar-ring" />
                <Sparkles size={38} />
                <span className="art-tag">Risk: 18 / 100</span>
              </div>
              <div className="pipeline-card-content">
                <span className="pipeline-step">01 / Assess</span>
                <h3>AI brings attention.</h3>
                <p>
                  Detect suspicious data before it becomes trusted. Understand
                  the reasons behind every risk score.
                </p>
                <span className="pipeline-footnote">
                  Metadata screening, not a purity test
                </span>
              </div>
            </article>
            <span className="pipeline-connector">
              <ArrowRight size={19} />
            </span>
            <article>
              <div className="pipeline-card-art chain-art">
                <span className="mini-block">0x8f2</span>
                <span className="mini-block">0xa91</span>
                <span className="mini-block">0xc04</span>
                <span className="art-tag">
                  <ShieldCheck size={12} />
                  Fingerprint protected
                </span>
              </div>
              <div className="pipeline-card-content">
                <span className="pipeline-step">02 / Preserve</span>
                <h3>Blockchain keeps proof.</h3>
                <p>
                  Freeze the fingerprint, not the private data. Preserve exactly
                  what was certified, when it was certified.
                </p>
                <span className="pipeline-footnote">
                  SHA-256 + a Solidity registry
                </span>
              </div>
            </article>
            <span className="pipeline-connector">
              <ArrowRight size={19} />
            </span>
            <article>
              <div className="pipeline-card-art qr-art">
                <ScanLine size={58} strokeWidth={1.2} />
                <span className="art-tag">Anyone. Any phone.</span>
              </div>
              <div className="pipeline-card-content">
                <span className="pipeline-step">03 / Connect</span>
                <h3>QR opens the story.</h3>
                <p>
                  Turn cryptographic verification into a one-second consumer
                  action. No account. No technical knowledge.
                </p>
                <span className="pipeline-footnote">
                  One link to a public digital passport
                </span>
              </div>
            </article>
          </div>
        </section>
        <section className="home-architecture-section" ref={architectureRef}>
          <div className="container">
            <div className="section-heading">
              <div>
                <span className="section-index">03 / Under the honeycomb</span>
                <h2>
                  Nothing hidden.
                  <br />
                  Everything connected.
                </h2>
              </div>
              <div>
                <p>
                  Follow a request through the real architecture.
                  <br />
                  See where data lives, how proof is created,
                  <br className="desktop-only" /> and who gets alerted when it
                  changes.
                </p>
                <Link className="text-link" to="/architecture">
                  Open the architecture explorer
                  <ArrowUpRight size={16} />
                </Link>
              </div>
            </div>
            {showArchitecture ? (
              <Suspense fallback={<div className="skeleton sk-chart" />}>
                <SystemArchitecture />
              </Suspense>
            ) : (
              <div className="architecture-placeholder" />
            )}
          </div>
        </section>
        <section className="impact-section container" id="authorities">
          <div className="section-heading">
            <div>
              <span className="section-index">04 / A shared ecosystem</span>
              <h2>
                Better for the hive.
                <br />
                Better for everyone.
              </h2>
            </div>
            <p>
              One platform brings the people behind
              <br />
              your honey onto the same page.
            </p>
          </div>
          <div className="impact-grid">
            {[
              {
                icon: Leaf,
                title: "The beekeeper",
                text: "Understand colony health. Catch stressful conditions early. Connect every harvest to its physical source.",
                tag: "Care with confidence",
              },
              {
                icon: Hexagon,
                title: "The producer",
                text: "Create traceable batches, preserve your evidence and give your honey a verifiable digital identity.",
                tag: "Stand behind your story",
              },
              {
                icon: ScanLine,
                title: "The consumer",
                text: "Scan a bottle. See its origin, risk assessment and record integrity, without needing an account.",
                tag: "Know what you’re buying",
              },
              {
                icon: ShieldCheck,
                title: "The authority",
                text: "Receive suspicious cases and integrity incidents. Spend time investigating what deserves attention.",
                tag: "Focus on what matters",
              },
            ].map((p, i) => (
              <article key={p.title}>
                <span className={`persona-icon persona-${i}`}>
                  <p.icon size={27} />
                </span>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
                <span>
                  {p.tag}
                  <ArrowUpRight size={14} />
                </span>
              </article>
            ))}
          </div>
        </section>
        <section className="final-cta">
          <div className="container">
            <div>
              <span className="section-index">
                A small label. A bigger promise.
              </span>
              <h2>Scan. Verify. Trust.</h2>
              <p>Let every jar tell a story you can check.</p>
            </div>
            <div className="final-cta-actions">
              <Link to="/verify" className="btn btn-primary">
                <ScanLine size={18} />
                Verify a batch
              </Link>
              <Link to="/dashboard" className="btn btn-light">
                Open BeeHive
                <ArrowUpRight size={17} />
              </Link>
            </div>
            <Hexagon size={280} strokeWidth={0.5} className="cta-hex" />
          </div>
        </section>
      </main>
      <footer className="home-footer container">
        <div>
          <Logo />
          <p>
            From hive to honey.
            <br />
            Every claim, verifiable.
          </p>
        </div>
        <div className="footer-links">
          <Link to="/dashboard">Platform</Link>
          <Link to="/verify">Verify a batch</Link>
          <Link to="/architecture">Architecture</Link>
          <Link to="/authority">For authorities</Link>
        </div>
        <div className="footer-meta">
          <span>Built for Smart India Hackathon 2026</span>
          <span>Problem statement SIH26021</span>
          <small>© 2026 BeeHive. A working prototype.</small>
        </div>
      </footer>
    </div>
  );
}
function LivePreview() {
  const { data, error } = useApi<Hive[]>("/public/preview", 15000);
  return (
    <div className="live-preview">
      <div className="preview-toolbar">
        <div>
          <span className="preview-logo">
            <Hexagon size={19} />
          </span>
          <strong>Apiary overview</strong>
          <span className="preview-divider" />
          <span>Mountain Gold Apiary</span>
        </div>
        <Badge tone="green">Demo telemetry</Badge>
      </div>
      <div className="preview-hives">
        {data?.slice(0, 4).map((h, i) => (
          <Link
            to={`/hives/${h.public_id}`}
            className="preview-hive"
            key={h.id}
          >
            <div>
              <span className="preview-hive-id">
                Hive H-{String(i + 1).padStart(3, "0")}
              </span>
              <Status value={h.status} />
            </div>
            <div className="preview-health">
              <span className={`hive-small ${h.status.toLowerCase()}`}>
                <Hexagon size={25} />
              </span>
              <strong>
                {h.healthScore}
                <small>/ 100</small>
              </strong>
              <span>
                Colony
                <br />
                health
              </span>
            </div>
            <div className="preview-sparkline">
              <svg viewBox="0 0 220 45" aria-hidden="true">
                <path
                  d={
                    h.status === "Healthy"
                      ? "M0 30 15 28 30 30 45 19 60 23 75 17 90 20 105 14 120 18 135 12 150 14 165 7 180 10 200 5 220 8"
                      : h.status === "Watch"
                        ? "M0 13 20 14 40 8 60 20 80 18 100 30 120 22 140 31 160 25 180 36 200 30 220 34"
                        : "M0 8 20 12 40 4 60 15 80 10 100 25 120 21 140 35 160 30 180 38 200 36 220 42"
                  }
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
            </div>
            <div className="preview-readings">
              <span>
                <small>Temperature</small>
                <strong>{h.temperature}°C</strong>
              </span>
              <span>
                <small>Humidity</small>
                <strong>{h.humidity}%</strong>
              </span>
              <span>
                <small>Weight</small>
                <strong>{h.weight} kg</strong>
              </span>
            </div>
          </Link>
        )) ??
          [0, 1, 2, 3].map((i) => <div className="skeleton sk-card" key={i} />)}
      </div>
      <div className="preview-bottom">
        <span>
          <Wifi size={14} />
          {error
            ? "Start the local demo to load hive telemetry."
            : "Readings from the connected demo API · refreshes every 15 seconds"}
        </span>
        <Link to="/dashboard">
          Open live dashboard
          <ArrowUpRight size={15} />
        </Link>
      </div>
    </div>
  );
}
