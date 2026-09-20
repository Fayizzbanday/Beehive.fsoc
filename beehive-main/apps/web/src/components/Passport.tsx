import { useEffect, useState } from "react";
import { Download, ExternalLink, ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button, CopyButton, LinkButton } from "./ui";
import { downloadDocument, post, useUser } from "../lib/api";
import { toast } from "sonner";
import type { Batch } from "../../../../packages/shared/src/index";
export function QRCode({
  value,
  size = 180,
}: {
  value: string;
  size?: number;
}) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    void import("qrcode").then(async (QR) => {
      const uri = await QR.toDataURL(value, {
        width: size * 2,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#20271f", light: "#ffffff" },
      });
      if (alive) setSrc(uri);
    });
    return () => {
      alive = false;
    };
  }, [value, size]);
  return src ? (
    <img
      className="qr-image"
      src={src}
      width={size}
      height={size}
      alt="QR code containing this batch’s public verification URL"
    />
  ) : (
    <div className="skeleton" style={{ width: size, height: size }} />
  );
}
export default function Passport({ batch }: { batch: Batch }) {
  const reduced = useReducedMotion();
  const { data: user } = useUser();
  const [reportBusy, setReportBusy] = useState(false);
  const value = `${window.location.origin}/verify/${batch.publicId}`;
  async function download() {
    const QR = await import("qrcode");
    const svg = await QR.toString(value, {
      type: "svg",
      margin: 2,
      errorCorrectionLevel: "M",
    });
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${batch.publicId}-passport.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function downloadReport() {
    setReportBusy(true);
    try {
      const report = await post<{ reportId: string }>(
        `/batches/${batch.publicId}/passport`,
      );
      await downloadDocument(report.reportId, `${batch.publicId}-report.json`);
      toast.success("Traceability report downloaded");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setReportBusy(false);
    }
  }
  return (
    <div className="passport-certificate">
      <div className="passport-top">
        <span className="tiny-logo">⬡ BeeHive</span>
        <ShieldCheck size={20} />
      </div>
      <span className="certificate-label">Digital product passport</span>
      <h2>{batch.record.honeyType} honey</h2>
      <p>{batch.record.producerName}</p>
      <motion.div
        className="qr-frame"
        initial={reduced ? false : { opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <QRCode value={value} />
      </motion.div>
      <strong className="mono">{batch.publicId}</strong>
      <p className="muted">
        {batch.record.origin.region} · {batch.record.quantity} kg
      </p>
      <div className="passport-note">
        Scan to check the current record against its immutable fingerprint.
      </div>
      <LinkButton to={`/verify/${batch.publicId}`} variant="secondary">
        Open public passport
        <ExternalLink size={15} />
      </LinkButton>
      <Button
        variant="ghost"
        onClick={() =>
          void download().catch(() =>
            toast.error("QR download failed. Please try again."),
          )
        }
      >
        <Download size={15} />
        Download QR label
      </Button>
      {user && user.role !== "authority" ? (
        <Button
          variant="ghost"
          busy={reportBusy}
          onClick={() => void downloadReport()}
        >
          <Download size={15} />
          Download traceability report
        </Button>
      ) : null}
      <CopyButton value={value} label="Copy verification URL" />
    </div>
  );
}
