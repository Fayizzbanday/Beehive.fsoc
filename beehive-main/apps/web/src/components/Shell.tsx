import { useState } from "react";
import {
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  Boxes,
  FileCheck2,
  FlaskConical,
  Hexagon,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Plus,
  ScanEye,
  ScanLine,
  TrendingUp,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { useSWRConfig } from "swr";
import { useApi, useUser, post } from "../lib/api";
import { Logo, Loading, ErrorState } from "./ui";
import { toast } from "sonner";
export default function Shell() {
  const { data: user, error, isLoading } = useUser();
  const {
    data: health,
    isLoading: healthLoading,
    error: healthError,
  } = useApi<{ demoMode: boolean; network: string }>("/health");
  const { mutate } = useSWRConfig();
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  if (isLoading) return <Loading />;
  if (error)
    return error.status === 401 ? (
      <Navigate to="/login" state={{ from: location.pathname }} replace />
    ) : (
      <ErrorState error={error} />
    );
  if (!user) return null;
  const authority = location.pathname.startsWith("/authority");
  if (authority && user.role === "producer")
    return <Navigate to="/dashboard" replace />;
  if (location.pathname.startsWith("/demo/") && healthLoading)
    return <Loading />;
  if (location.pathname.startsWith("/demo/") && healthError)
    return <ErrorState error={healthError} />;
  if (
    location.pathname.startsWith("/demo/") &&
    (!health?.demoMode || user.role !== "admin")
  )
    return <Navigate to="/login?role=admin" replace />;
  const links = authority
    ? [
        ["/authority", "Overview", LayoutDashboard],
        ["/authority/alerts", "Alerts & reviews", TriangleAlert],
        ["/authority/records", "All records", FileCheck2],
      ]
    : [
        ["/dashboard", "Overview", LayoutDashboard],
        ["/hives", "Hive intelligence", Hexagon],
        ["/batches", "Honey batches", Boxes],
        ["/scan", "AI vision scan", ScanEye],
        ["/forecast", "Risk forecast", TrendingUp],
      ];
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "sidebar-open" : ""}`}>
        <div className="sidebar-logo">
          <Logo />
          <button
            className="icon-button mobile-only"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-label">
          <span className="workspace-icon">
            {authority ? <ShieldCheck size={18} /> : <Hexagon size={18} />}
          </span>
          <div>
            <strong>
              {authority ? "Authority workspace" : "Mountain Gold Apiary"}
            </strong>
            <span>
              {authority ? "National oversight" : "Producer workspace"}
            </span>
          </div>
        </div>
        <div className="nav-label">Workspace</div>
        <nav className="side-nav" aria-label="Workspace">
          {links.map(([to, label, Icon]) => (
            <NavLink
              key={String(to)}
              end={to === "/dashboard" || to === "/authority"}
              to={to as string}
              onClick={() => setMenu(false)}
            >
              {typeof Icon !== "string" ? <Icon size={18} /> : null}
              {label as string}
            </NavLink>
          ))}
        </nav>
        <div className="nav-label">Trust infrastructure</div>
        <nav className="side-nav" aria-label="Trust infrastructure">
          <NavLink to="/verify">
            <ScanLine size={18} />
            Verify a batch
            <ArrowUpRight size={14} className="nav-trailing" />
          </NavLink>
          <NavLink to="/architecture">
            <Network size={18} />
            System architecture
          </NavLink>
          {user.role !== "producer" ? (
            <NavLink to={authority ? "/dashboard" : "/authority"}>
              <ShieldCheck size={18} />
              {authority ? "Producer workspace" : "Authority console"}
            </NavLink>
          ) : null}
          {health?.demoMode && user.role === "admin" ? (
            <NavLink to="/demo/tamper">
              <FlaskConical size={18} />
              Tamper lab
            </NavLink>
          ) : null}
        </nav>
        <div className="sidebar-bottom">
          <div className="network-note">
            <span className="live-dot" />
            <div>
              <strong>{health?.network ?? "Connecting"}</strong>
              <small>
                {health?.demoMode
                  ? "Isolated demonstration environment"
                  : "Connected proof infrastructure"}
              </small>
            </div>
          </div>
          <div className="user-card">
            <span className="avatar">
              {user.name
                .split(" ")
                .slice(0, 2)
                .map((n) => n[0])
                .join("")}
            </span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.role}</small>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={async () => {
                try {
                  await post("/auth/logout");
                  await mutate("/auth/me", undefined, { revalidate: false });
                  navigate("/login");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {menu ? (
        <button
          className="sidebar-scrim"
          onClick={() => setMenu(false)}
          aria-label="Close menu"
        />
      ) : null}
      <div className="app-body">
        <header className="app-topbar">
          <div className="topbar-path">
            <button
              className="icon-button mobile-only"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <span>/</span>
            <strong>
              {authority
                ? "Authority console"
                : location.pathname.startsWith("/hives")
                  ? "Hive intelligence"
                  : location.pathname.startsWith("/batches")
                    ? "Honey batches"
                    : location.pathname.startsWith("/scan")
                      ? "AI vision scan"
                      : location.pathname.startsWith("/forecast")
                        ? "Risk forecast"
                        : location.pathname.startsWith("/demo")
                          ? "Tamper lab"
                          : "Overview"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="live-label">
              <span className="live-dot" />
              {health?.demoMode ? "Live demo" : "Connected"}
            </span>
            <span className="topbar-date">
              {new Intl.DateTimeFormat("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              }).format(new Date())}
            </span>
          </div>
        </header>
        <main id="main" className="workspace-main">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>
            <Activity size={13} /> From physical source to verifiable proof.
          </span>
          <span>BeeHive · SIH 2026</span>
        </footer>
      </div>
    </div>
  );
}
