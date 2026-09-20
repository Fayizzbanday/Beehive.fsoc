import { lazy, Suspense, useState } from "react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
  MessageSquare,
  QrCode,
  Star,
  TrendingUp,
} from "lucide-react";
import type {
  ConsumerReview,
  ReputationForecast,
} from "../../../../packages/shared/src/index";
import { post, useApi, useUser } from "../lib/api";
import {
  Badge,
  Button,
  Empty,
  ErrorState,
  LinkButton,
  Loading,
  Metric,
  PageHeader,
  Panel,
  RiskGauge,
  Status,
} from "../components/ui";
const ReviewTrendChart = lazy(() =>
  import("../components/Charts").then((m) => ({ default: m.ReviewTrendChart })),
);
function Stars({ rating }: { rating: number }) {
  return (
    <span className="stars" role="img" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          size={13}
          fill={value <= rating ? "var(--amber)" : "none"}
          stroke={value <= rating ? "var(--amber)" : "var(--line)"}
        />
      ))}
    </span>
  );
}
export default function Forecast() {
  const { data: user } = useUser();
  const { data: health } = useApi<{ demoMode: boolean }>("/health");
  const {
    data: forecast,
    error,
    mutate,
  } = useApi<ReputationForecast>("/scans/forecast");
  const { data: reviews, mutate: mutateReviews } =
    useApi<ConsumerReview[]>("/scans/reviews");
  const { mutate: globalMutate } = useSWRConfig();
  const [busy, setBusy] = useState(false);
  if (error) return <ErrorState error={error} retry={() => void mutate()} />;
  if (!forecast) return <Loading />;
  const maxImpact = Math.max(
    ...forecast.drivers.map((d) => Math.abs(d.impact)),
    1,
  );
  return (
    <>
      <PageHeader
        eyebrow="Market signal · no camera required"
        title="Predicted reputation risk"
        description="What buyers reported, what verifiers saw and what the batch risk engine already decided, combined into one forward-looking score."
        action={
          health?.demoMode && user?.role !== "authority" ? (
            <Button
              variant="secondary"
              busy={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await post("/scans/reviews/simulate");
                  await Promise.all([
                    mutate(),
                    mutateReviews(),
                    globalMutate("/activity"),
                  ]);
                  toast.success(
                    "A new consumer review landed. Forecast updated.",
                  );
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <MessageSquare size={16} />
              Receive a consumer review
            </Button>
          ) : (
            <LinkButton to="/scan" variant="secondary">
              AI vision scan
            </LinkButton>
          )
        }
      />
      <Panel className="scan-verdict">
        <RiskGauge score={forecast.score} label="Predicted risk" size={170} />
        <div>
          <div className="scan-verdict-badges">
            <Status value={forecast.classification} />
            <Badge tone="neutral">{forecast.reviewCount} reviews</Badge>
            <Badge tone={forecast.ratingTrend >= 0 ? "green" : "amber"}>
              {forecast.ratingTrend >= 0 ? "+" : ""}
              {forecast.ratingTrend} rating movement
            </Badge>
          </div>
          <h2>
            {forecast.classification === "LOW"
              ? "Buyers trust what they are opening."
              : forecast.classification === "MEDIUM"
                ? "A fixable complaint is shaping the next quarter."
                : "Reputation exposure needs action this month."}
          </h2>
          <p>
            {forecast.drivers[0]?.detail}{" "}
            {forecast.complaints[0]
              ? `The dominant theme is ${forecast.complaints[0].label.toLowerCase()}.`
              : ""}
          </p>
          <p className="scope-note">{forecast.scope}</p>
        </div>
      </Panel>
      <div className="metrics-grid four">
        <Metric
          label="Average rating"
          value={forecast.averageRating.toFixed(2)}
          detail={`${forecast.sentimentSplit.positive} positive · ${forecast.sentimentSplit.negative} negative`}
          icon={<Star />}
        />
        <Metric
          label="30-day movement"
          value={`${forecast.ratingTrend >= 0 ? "+" : ""}${forecast.ratingTrend}`}
          detail="Against the previous 60 days"
          icon={<TrendingUp />}
        />
        <Metric
          label="Reviews after a QR scan"
          value={`${forecast.verifiedShare}%`}
          detail="Buyers who verified before reviewing"
          icon={<QrCode />}
        />
        <Metric
          label="Model confidence"
          value={`${Math.round(forecast.confidence * 100)}%`}
          detail={forecast.version}
          icon={<MessageSquare />}
        />
      </div>
      <div className="dashboard-grid">
        <Panel
          title="What drives the score"
          subtitle="Every point in the forecast is attributable"
        >
          <ul className="driver-list">
            {forecast.drivers.map((driver) => (
              <li key={driver.key}>
                <div className="driver-head">
                  <strong>{driver.label}</strong>
                  <span className={driver.impact > 0 ? "red-text" : "green"}>
                    {driver.impact > 0 ? (
                      <ArrowUpRight size={14} />
                    ) : (
                      <ArrowDownRight size={14} />
                    )}
                    {driver.impact > 0 ? "+" : ""}
                    {driver.impact}
                  </span>
                </div>
                <i className={driver.impact > 0 ? "bar up" : "bar down"}>
                  <b
                    style={{
                      width: `${(Math.abs(driver.impact) / maxImpact) * 100}%`,
                    }}
                  />
                </i>
                <p>{driver.detail}</p>
              </li>
            ))}
          </ul>
        </Panel>
        <div className="forecast-side">
          <Panel title="Rating trend" subtitle="Last six months">
            <Suspense fallback={<div className="skeleton sk-chart" />}>
              <ReviewTrendChart monthly={forecast.monthly} />
            </Suspense>
          </Panel>
          <Panel title="Where the score goes next">
            <div className="projection-grid compact">
              {forecast.projection.map((point) => (
                <div className="projection" key={point.horizonDays}>
                  <span className="eyebrow">{point.horizonDays} days</span>
                  <strong>{point.score}</strong>
                  <small>{point.label}</small>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
      <div className="dashboard-grid">
        <Panel
          title="Complaint clusters"
          subtitle="Themes extracted from one, two and three-star reviews"
        >
          {forecast.complaints.length ? (
            <ul className="cluster-list">
              {forecast.complaints.map((complaint) => (
                <li key={complaint.tag}>
                  <div>
                    <strong>{complaint.label}</strong>
                    <small>
                      {complaint.count} reviews · {complaint.severity} severity
                    </small>
                  </div>
                  <i>
                    <b
                      style={{
                        width: `${Math.min(100, complaint.share * 3)}%`,
                      }}
                    />
                  </i>
                  <span>{complaint.share}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty
              title="No complaint cluster"
              description="Not enough low-rated reviews to form a theme yet."
            />
          )}
        </Panel>
        <Panel title="Signals used" subtitle="Beyond the review corpus">
          <div className="signal-grid">
            {forecast.signals.map((signal) => (
              <div key={signal.label}>
                <span>{signal.label}</span>
                <strong>{signal.value}</strong>
                <small>{signal.detail}</small>
              </div>
            ))}
          </div>
          <ol className="recommendation-list">
            {forecast.recommendations.map((recommendation) => (
              <li key={recommendation}>{recommendation}</li>
            ))}
          </ol>
        </Panel>
      </div>
      <Panel
        title="Consumer reviews"
        subtitle={`${forecast.channels.map((c) => `${c.channel} ${c.averageRating}★`).join(" · ")}`}
      >
        {reviews?.length ? (
          <ul className="review-feed">
            {reviews.slice(0, 12).map((review) => (
              <li key={review.id}>
                <div className="review-head">
                  <Stars rating={review.rating} />
                  <strong>{review.title}</strong>
                  {review.verified_scan ? (
                    <Badge tone="green">Verified scan</Badge>
                  ) : null}
                </div>
                <p>{review.body}</p>
                <small>
                  {review.reviewer} · {review.channel}
                  {review.batch_public_id
                    ? ` · ${review.batch_public_id}`
                    : ""}{" "}
                  · {new Date(review.created_at).toLocaleDateString("en-IN")}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <Empty
            title="No reviews yet"
            description="Consumer feedback arrives once passports are scanned in the market."
          />
        )}
      </Panel>
    </>
  );
}
