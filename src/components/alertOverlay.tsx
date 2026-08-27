import React, { useEffect, useState, useRef } from "react";
import { alertQueue, AlertItem } from "@/features/alerts/alertQueue";
import { pollPredictionStore, ActivePollPrediction } from "@/features/pollPrediction/pollPredictionStore";

// ── Per-kind accent color so different alert types are readable at a glance.
// Add a line here whenever a new AlertKind is introduced in a later phase.
const KIND_STYLES: Record<string, { bg: string; icon: string }> = {
  test: { bg: "#514062", icon: "🔔" },
  ad_countdown: { bg: "#FF617F", icon: "📢" },
  follow: { bg: "#9146FF", icon: "💜" },
  raid: { bg: "#FF4500", icon: "⚔️" },
  sub: { bg: "#00C7AC", icon: "⭐" },
  resub: { bg: "#00C7AC", icon: "🔁" },
  bits: { bg: "#FFB800", icon: "💎" },
  streak: { bg: "#FF9146", icon: "🔥" },
  poll: { bg: "#856292", icon: "📊" },
  prediction: { bg: "#856292", icon: "🔮" },
};

const AlertCard = ({
  alert,
  onDone,
}: {
  alert: AlertItem;
  onDone: (id: string) => void;
}) => {
  const [entered, setEntered] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (alert.durationMs && alert.durationMs > 0) {
      timerRef.current = setTimeout(() => {
        setLeaving(true);
        setTimeout(() => onDone(alert.id), 300);
      }, alert.durationMs);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alert.id, alert.durationMs]);

  const style = KIND_STYLES[alert.kind] ?? KIND_STYLES.test;

  return (
    <div
      className="pointer-events-auto flex items-center gap-12 rounded-12 shadow-2xl px-16 py-12 mb-8 min-w-[260px] max-w-[360px]"
      style={{
        background: "rgba(255,255,255,0.97)",
        borderLeft: `6px solid ${style.bg}`,
        transform: entered && !leaving ? "translateX(0)" : "translateX(120%)",
        opacity: entered && !leaving ? 1 : 0,
        transition: "transform 300ms cubic-bezier(0.34,1.56,0.64,1), opacity 250ms ease",
      }}
    >
      {alert.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={alert.imageUrl}
          alt=""
          className="w-36 h-36 rounded-8 object-cover flex-shrink-0"
        />
      ) : (
        <div
          className="w-36 h-36 rounded-8 flex-shrink-0 flex items-center justify-center text-[20px]"
          style={{ background: `${style.bg}22` }}
        >
          {style.icon}
        </div>
      )}
      <div className="min-w-0">
        <div className="font-bold text-sm text-text-primary truncate">
          {alert.title}
        </div>
        {alert.subtitle && (
          <div className="text-xs text-text-primary/70 truncate">
            {alert.subtitle}
          </div>
        )}
      </div>
    </div>
  );
};

// Poll/prediction card — richer than a plain alert (live option bars), but
// stacks in the same top-right corner, above the alert cards.
const PollPredictionCard = ({ state }: { state: ActivePollPrediction }) => {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const rows =
    state.kind === "poll"
      ? state.options.map((o) => ({ title: o.title, count: o.votes }))
      : state.outcomes.map((o) => ({ title: o.title, count: o.users }));
  const total = Math.max(1, rows.reduce((s, r) => s + r.count, 0));

  const statusLabel =
    state.status === "active"
      ? state.kind === "poll"
        ? "Voting…"
        : "Predicting…"
      : state.status === "locked"
      ? "Locked"
      : "Final results";

  return (
    <div
      className="pointer-events-auto rounded-12 shadow-2xl px-16 py-12 mb-8 w-[300px]"
      style={{
        background: "rgba(255,255,255,0.97)",
        borderLeft: `6px solid #856292`,
        transform: entered ? "translateX(0)" : "translateX(120%)",
        opacity: entered ? 1 : 0,
        transition: "transform 300ms cubic-bezier(0.34,1.56,0.64,1), opacity 250ms ease",
      }}
    >
      <div className="flex items-center gap-6 mb-6">
        <span>{state.kind === "poll" ? "📊" : "🔮"}</span>
        <span className="font-bold text-sm text-text-primary truncate flex-1">
          {state.title}
        </span>
      </div>
      <div className="text-xs text-text-primary/60 mb-8">{statusLabel}</div>
      <div className="space-y-6">
        {rows.map((r, i) => {
          const pct = Math.round((r.count / total) * 100);
          return (
            <div key={i}>
              <div className="flex justify-between text-xs text-text-primary/80 mb-2">
                <span className="truncate">{r.title}</span>
                <span className="flex-shrink-0 ml-8">{pct}%</span>
              </div>
              <div className="h-6 bg-surface3 rounded-4 overflow-hidden">
                <div
                  className="h-full bg-[#856292] transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Mount this once near the root of the app (in index.tsx). It subscribes to
// the alertQueue singleton and renders whatever's in it, stacked in the
// top-right corner. Every future alert type (Twitch events, ad countdown,
// polls) is rendered here automatically just by calling alertQueue.push().
export const AlertOverlay = () => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [poll, setPoll] = useState<ActivePollPrediction | null>(null);

  useEffect(() => {
    const unsubscribe = alertQueue.subscribe(setAlerts);
    return unsubscribe;
  }, []);

  useEffect(() => {
    return pollPredictionStore.subscribe(setPoll);
  }, []);

  if (alerts.length === 0 && !poll) return null;

  return (
    <div
      className="fixed top-16 right-16 z-40 flex flex-col items-end pointer-events-none"
      style={{ maxHeight: "calc(100vh - 32px)" }}
    >
      {poll && <PollPredictionCard state={poll} />}
      {alerts.map((alert) => (
        <AlertCard
          key={alert.id}
          alert={alert}
          onDone={(id) => alertQueue.remove(id)}
        />
      ))}
    </div>
  );
};
