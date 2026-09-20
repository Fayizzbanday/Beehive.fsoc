import { Link } from "react-router-dom";
import { ArrowUpRight, Database, Hash, ShieldCheck } from "lucide-react";
import SystemArchitecture from "../components/SystemArchitecture";
import { Badge, Logo } from "../components/ui";
export default function Architecture() {
  return (
    <div className="architecture-page">
      <header className="public-header">
        <Logo />
        <Link className="btn btn-secondary" to="/dashboard">
          Launch dashboard
          <ArrowUpRight size={15} />
        </Link>
      </header>
      <main id="main" className="container">
        <div className="architecture-page-intro">
          <Badge tone="green">Built to be understood</Badge>
          <h1>
            Trace the request.
            <br />
            Understand the trust.
          </h1>
          <p>
            Choose a scenario to see how a physical source becomes a verifiable
            record, and exactly where each technology does its work.
          </p>
        </div>
        <SystemArchitecture />
        <div className="architecture-principles">
          <div>
            <Database size={23} />
            <h3>Records stay private.</h3>
            <p>
              D1 stores source and batch data. R2 preserves certificates and
              generated reports. Authenticated roles govern access.
            </p>
          </div>
          <div>
            <Hash size={23} />
            <h3>Fingerprints stay fixed.</h3>
            <p>
              A versioned canonical schema and SHA-256 certify the exact record.
              The Solidity registry prevents duplicate public references.
            </p>
          </div>
          <div>
            <ShieldCheck size={23} />
            <h3>Every check starts fresh.</h3>
            <p>
              Public verification rehashes current data and reads the EVM
              registry. A network failure stays unconfirmed; a mismatch creates
              an alert.
            </p>
          </div>
        </div>
        <div className="architecture-end">
          <Link to="/verify/BH-2026-000042" className="btn btn-primary">
            Inspect a public proof
            <ArrowUpRight size={16} />
          </Link>
          <Link to="/login?role=admin" className="btn btn-secondary">
            Open the tamper lab
          </Link>
        </div>
      </main>
      <footer className="public-footer">
        <Logo />
        <span>BeeHive · SIH26021 · Smart India Hackathon 2026</span>
        <Link to="/">Back to home</Link>
      </footer>
    </div>
  );
}
