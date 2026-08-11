import React, { useEffect, useState, useRef } from "react";
import { alertQueue, AlertItem } from "@/features/alerts/alertQueue";

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

// Mount this once near the root of the app (in index.tsx). It subscribes to
// the alertQueue singleton and renders whatever's in it, stacked in the
// top-right corner. Every future alert type (Twitch events, ad countdown,
// polls) is rendered here automatically just by calling alertQueue.push().
export const AlertOverlay = () => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  useEffect(() => {
    const unsubscribe = alertQueue.subscribe(setAlerts);
    return unsubscribe;
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div
      className="fixed top-16 right-16 z-40 flex flex-col items-end pointer-events-none"
      style={{ maxHeight: "calc(100vh - 32px)" }}
    >
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
