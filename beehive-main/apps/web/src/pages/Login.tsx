import { useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowRight,
  Hexagon,
  ShieldCheck,
  FlaskConical,
  LockKeyhole,
} from "lucide-react";
import { useSWRConfig } from "swr";
import { api, post, useApi } from "../lib/api";
import { Logo, Button, Badge } from "../components/ui";
import type { Role, User } from "../../../../packages/shared/src/index";
export default function Login() {
  const { data: health } = useApi<{ demoMode: boolean }>("/health");
  const [search] = useSearchParams();
  const [role, setRole] = useState<Role>(
    search.get("role") === "admin" ? "admin" : "producer",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { mutate } = useSWRConfig();
  const navigate = useNavigate();
  const location = useLocation();
  async function login(demo: boolean, form?: HTMLFormElement) {
    setBusy(true);
    setError("");
    try {
      const data = form ? new FormData(form) : null;
      const user = await post<User>(
        demo ? "/auth/demo" : "/auth/login",
        demo
          ? { role }
          : { email: data?.get("email"), password: data?.get("password") },
      );
      await mutate("/auth/me", user, { revalidate: false });
      const next = location.state?.from;
      navigate(
        next?.startsWith("/") && !next.startsWith("//")
          ? next
          : user.role === "authority"
            ? "/authority"
            : user.role === "admin"
              ? "/demo/tamper"
              : "/dashboard",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="login-page">
      <div className="login-story">
        <Logo light />
        <div className="login-story-body">
          <span className="outline-hex">
            <Hexagon size={54} />
          </span>
          <h1>
            Good honey.
            <br />
            Honest records.
            <br />
            Visible proof.
          </h1>
          <p>
            One connected workspace for the people who care for our hives, and
            the people who trust what comes from them.
          </p>
          <div className="login-trust">
            <ShieldCheck size={20} />
            <span>Private records. Public confidence.</span>
          </div>
        </div>
        <span className="login-credit">
          BeeHive / Smart India Hackathon 2026
        </span>
      </div>
      <div className="login-form-area">
        <Link to="/" className="back-link">
          ← Back to BeeHive
        </Link>
        <div className="login-form">
          <Badge tone="green">Your trust network</Badge>
          <h2>Welcome to the hive.</h2>
          <p>Sign in to your BeeHive workspace.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void login(false, e.currentTarget);
            }}
          >
            <label>
              Email address
              <input
                name="email"
                type="email"
                placeholder="you@apiary.in"
                required
                autoComplete="username"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
            </label>
            <Button type="submit" busy={busy} className="w-full">
              Sign in
              <ArrowRight size={17} />
            </Button>
          </form>
          {error ? (
            <p role="alert" className="form-error">
              {error}
            </p>
          ) : null}
          {health?.demoMode ? (
            <>
              <div className="or-divider">
                <span>Explore the working prototype</span>
              </div>
              <div className="role-picker">
                {(
                  [
                    { id: "producer", label: "Producer", icon: Hexagon },
                    { id: "authority", label: "Authority", icon: ShieldCheck },
                    { id: "admin", label: "Demo admin", icon: FlaskConical },
                  ] as const
                ).map((r) => (
                  <button
                    className={role === r.id ? "selected" : ""}
                    key={r.id}
                    onClick={() => setRole(r.id)}
                    aria-pressed={role === r.id}
                  >
                    <r.icon size={19} />
                    {r.label}
                  </button>
                ))}
              </div>
              <Button
                className="w-full"
                variant="secondary"
                busy={busy}
                onClick={() => void login(true)}
              >
                Enter demo workspace
                <ArrowRight size={17} />
              </Button>
              <small className="login-note">
                <LockKeyhole size={13} /> Demo access is restricted to this
                isolated environment.
              </small>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
