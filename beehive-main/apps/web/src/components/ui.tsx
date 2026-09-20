import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowUpRight,
  Check,
  Copy,
  Hexagon,
  Loader2,
  X,
  TriangleAlert,
} from "lucide-react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link
      className={`logo ${light ? "logo-light" : ""}`}
      to="/"
      aria-label="BeeHive home"
    >
      <svg width="35" height="39" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="currentColor" d="m24 2 20 11v22L24 46 4 35V13Z" />
        <g stroke="var(--paper)" strokeWidth="2.1" fill="none">
          <path d="m24 12 10 6v12l-10 6-10-6V18Z M14 18l10 6 10-6 M24 24v12" />
        </g>
        <g fill="var(--paper)">
          <circle cx="24" cy="12" r="2.5" />
          <circle cx="14" cy="30" r="2.5" />
          <circle cx="34" cy="30" r="2.5" />
        </g>
      </svg>
      <span>
        BeeHive<span className="logo-dot">.</span>
      </span>
    </Link>
  );
}
export function Button({
  children,
  className = "",
  variant = "primary",
  busy = false,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      className={`btn btn-${variant} ${className}`}
      disabled={disabled || busy}
    >
      {busy ? <Loader2 size={16} className="spin" /> : null}
      {children}
    </button>
  );
}
export function LinkButton({
  to,
  children,
  variant = "primary",
  className = "",
}: {
  to: string;
  children: ReactNode;
  variant?: string;
  className?: string;
}) {
  return (
    <Link to={to} className={`btn btn-${variant} ${className}`}>
      {children}
    </Link>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge badge-${tone}`}>
      <span className="badge-dot" />
      {children}
    </span>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <Badge
      tone={
        ["Healthy", "LOW", "ANCHORED", "AUTHENTIC", "RESOLVED"].includes(value)
          ? "green"
          : ["Alert", "HIGH", "TAMPERED", "REVOKED"].includes(value)
            ? "red"
            : ["Watch", "MEDIUM", "PENDING", "ANCHORING"].includes(value)
              ? "amber"
              : "neutral"
      }
    >
      {value === "ANCHORED" ? "Anchored" : value}
    </Badge>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="page-actions">{action}</div> : null}
    </div>
  );
}
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title ? (
        <div className="panel-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Hexagon size={36} />
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status" aria-label="Loading">
      <div className="skeleton sk-title" />
      <div className="skeleton sk-subtitle" />
      <div className="skeleton-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton sk-card" />
        ))}
      </div>
      <div className="skeleton sk-chart" />
      <span className="sr-only">Loading BeeHive data</span>
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry?: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <TriangleAlert size={24} />
      <h2>We couldn’t load this view</h2>
      <p>{error.message}</p>
      {retry ? <Button onClick={retry}>Try again</Button> : null}
    </div>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className="modal"
          onOpenAutoFocus={() => {
            returnFocus.current = document.activeElement as HTMLElement | null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (returnFocus.current?.isConnected) returnFocus.current.focus();
          }}
        >
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>
            {description ?? "Review the details below."}
          </Dialog.Description>
          <Dialog.Close className="icon-button modal-close" aria-label="Close">
            <X size={20} />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (copied) {
      const t = setTimeout(() => setCopied(false), 1800);
      return () => clearTimeout(t);
    }
  }, [copied]);
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("Copied to clipboard");
        } catch {
          toast.error("Clipboard is unavailable. Select and copy the value.");
        }
      }}
      aria-label={label}
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
      <span>{copied ? "Copied" : label}</span>
    </Button>
  );
}
export function Metric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: number | string;
  detail?: string;
  icon: ReactNode;
}) {
  return (
    <div className="metric">
      <div className="metric-top">
        <span>{label}</span>
        {icon}
      </div>
      <div className="metric-value">
        <Counter value={value} />
      </div>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}
function Counter({ value }: { value: number | string }) {
  const reduced = useReducedMotion();
  const element = useRef<HTMLSpanElement>(null);
  const previous = useRef(0);
  useEffect(() => {
    if (typeof value !== "number" || reduced) return;
    const controls = animate(previous.current, value, {
      duration: 0.7,
      ease: "easeOut",
      onUpdate: (latest) => {
        if (element.current)
          element.current.textContent =
            Math.round(latest).toLocaleString("en-IN");
      },
    });
    previous.current = value;
    return () => controls.stop();
  }, [value, reduced]);
  return (
    <motion.span
      ref={element}
      aria-label={String(value)}
      key={value}
      initial={reduced ? false : { opacity: 0, y: 7 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {value}
    </motion.span>
  );
}
export function RiskGauge({
  score,
  size = 120,
  label = "Risk score",
  kind = "risk",
}: {
  score: number;
  size?: number;
  label?: string;
  kind?: "risk" | "health";
}) {
  const tone =
    kind === "health"
      ? score >= 75
        ? "green"
        : score >= 45
          ? "amber"
          : "red"
      : score <= 30
        ? "green"
        : score <= 70
          ? "amber"
          : "red";
  return (
    <div className={`risk-gauge ${tone}`} style={{ width: size }}>
      <svg
        viewBox="0 0 120 100"
        role="img"
        aria-label={`${label}: ${score} out of 100`}
      >
        <path
          d="M18 80 A48 48 0 1 1 102 80"
          fill="none"
          stroke="var(--line)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M18 80 A48 48 0 1 1 102 80"
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={`${Math.max(3, score)} 100`}
        />
        <text x="60" y="58" textAnchor="middle">
          {score}
        </text>
        <text className="gauge-unit" x="60" y="77" textAnchor="middle">
          / 100
        </text>
      </svg>
      <small>{label}</small>
    </div>
  );
}
export function SectionLink({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <Link className="text-link" to={to}>
      {children}
      <ArrowUpRight size={15} />
    </Link>
  );
}
