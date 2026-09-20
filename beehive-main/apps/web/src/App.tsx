import { Component, lazy, Suspense, useEffect, type ReactNode } from "react";
import { Routes, Route, useLocation, Link } from "react-router-dom";
import { SWRConfig } from "swr";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
import { Loading, Logo } from "./components/ui";
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Shell = lazy(() => import("./components/Shell"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Hives = lazy(() => import("./pages/Hives"));
const HiveDetail = lazy(() =>
  import("./pages/Hives").then((m) => ({ default: m.HiveDetail })),
);
const HiveReadings = lazy(() =>
  import("./pages/Hives").then((m) => ({ default: m.HiveReadings })),
);
const Batches = lazy(() => import("./pages/Batches"));
const BatchDetail = lazy(() =>
  import("./pages/Batches").then((m) => ({ default: m.BatchDetail })),
);
const BatchWizard = lazy(() => import("./pages/BatchWizard"));
const Scan = lazy(() => import("./pages/Scan"));
const ScanDetail = lazy(() =>
  import("./pages/Scan").then((m) => ({ default: m.ScanDetail })),
);
const Forecast = lazy(() => import("./pages/Forecast"));
const Verify = lazy(() => import("./pages/Verify"));
const VerifyResult = lazy(() =>
  import("./pages/Verify").then((m) => ({ default: m.VerifyResult })),
);
const Tamper = lazy(() => import("./pages/Tamper"));
const Authority = lazy(() => import("./pages/Authority"));
const AuthorityAlerts = lazy(() =>
  import("./pages/Authority").then((m) => ({ default: m.AuthorityAlerts })),
);
const AuthorityRecords = lazy(() =>
  import("./pages/Authority").then((m) => ({ default: m.AuthorityRecords })),
);
const Architecture = lazy(() => import("./pages/Architecture"));
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="error-state">
        <Logo />
        <h1>This view couldn’t be opened.</h1>
        <p>Reload BeeHive to try again.</p>
        <button
          className="btn btn-primary"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function RouteEffects() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    document.title =
      pathname === "/"
        ? "BeeHive — Every claim, verifiable."
        : `BeeHive · ${pathname
            .split("/")
            .filter(Boolean)[0]
            ?.replace(/^./, (s) => s.toUpperCase())}`;
  }, [pathname]);
  return null;
}
export default function App() {
  return (
    <ErrorBoundary>
      <SWRConfig value={{ shouldRetryOnError: false, dedupingInterval: 2000 }}>
        <MotionConfig reducedMotion="user">
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <RouteEffects />
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/verify" element={<Verify />} />
              <Route path="/verify/:publicId" element={<VerifyResult />} />
              <Route path="/architecture" element={<Architecture />} />
              <Route element={<Shell />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/hives" element={<Hives />} />
                <Route path="/hives/:id" element={<HiveDetail />} />
                <Route path="/hives/:id/readings" element={<HiveReadings />} />
                <Route path="/batches" element={<Batches />} />
                <Route path="/batches/new" element={<BatchWizard />} />
                <Route path="/batches/:id" element={<BatchDetail />} />
                <Route path="/scan" element={<Scan />} />
                <Route path="/scan/:id" element={<ScanDetail />} />
                <Route path="/forecast" element={<Forecast />} />
                <Route path="/demo/tamper" element={<Tamper />} />
                <Route path="/authority" element={<Authority />} />
                <Route path="/authority/alerts" element={<AuthorityAlerts />} />
                <Route
                  path="/authority/records"
                  element={<AuthorityRecords />}
                />
              </Route>
              <Route
                path="*"
                element={
                  <main id="main" className="error-state">
                    <Logo />
                    <h1>That page isn’t in the hive.</h1>
                    <Link className="btn btn-primary" to="/">
                      Back to home
                    </Link>
                  </main>
                }
              />
            </Routes>
          </Suspense>
          <Toaster position="bottom-right" richColors closeButton />
        </MotionConfig>
      </SWRConfig>
    </ErrorBoundary>
  );
}
