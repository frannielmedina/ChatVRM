import { useState } from "react";
import { AikaPeerConfig } from "@/features/aikaPeer/aikaPeerConfig";
import type { PeerStatus } from "@/features/aikaPeer/aikaPeerClient";

type Props = {
  config: AikaPeerConfig;
  onChangeConfig: (c: AikaPeerConfig) => void;
  status: PeerStatus;
  statusDetail: string;
  canKnock: boolean;
  inSession: boolean;
  widgetViewers: number;
  log: string[];
  onConnect: () => void;
  onDisconnect: () => void;
  onRequestSession: () => void;
  onEndSession: () => void;
  getWidgetUrl: () => string;
};

const STATUS_COLOR: Record<PeerStatus, string> = {
  offline: "#888", connecting: "#e5a50a", connected: "#2ecc71", fatal: "#e74c3c",
};

export function AikaCollabPanel(p: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const set = (patch: Partial<AikaPeerConfig>) => p.onChangeConfig({ ...p.config, ...patch });
  const live = !p.config.testMode;

  const input = "w-full px-8 py-4 rounded-4 bg-white/10 text-white text-xs outline-none";
  return (
    <div className="fixed left-16 bottom-16 z-40 text-white" style={{ maxWidth: 340 }}>
      <button
        onClick={() => setOpen(!open)}
        className="px-16 py-8 rounded-8 bg-black/70 text-sm font-bold hover:bg-black/90"
      >
        <span style={{ color: STATUS_COLOR[p.status] }}>●</span> Aika collab {p.inSession ? "· ON STAGE" : ""}
      </button>

      {open && (
        <div className="mt-8 p-16 rounded-8 bg-black/85 text-xs space-y-8 backdrop-blur">
          <div className="flex items-center gap-8">
            <b style={{ color: STATUS_COLOR[p.status] }}>{p.status}</b>
            <span className="opacity-70 truncate">{p.statusDetail}</span>
          </div>

          <label className="block">Token (kept only in this browser)
            <input type="password" className={input} value={p.config.token}
              onChange={(e) => set({ token: e.target.value })} placeholder="paste your private token" />
          </label>

          <label className="block">Miko .vrm public URL (so Aika&apos;s OBS can load her)
            <input className={input} value={p.config.vrmUrl}
              onChange={(e) => set({ vrmUrl: e.target.value })} placeholder="https://…/miko.vrm" />
          </label>

          <label className="flex items-center gap-8">
            <input type="checkbox" checked={p.config.testMode} onChange={(e) => set({ testMode: e.target.checked })} />
            Test mode (dry run — nothing reaches the stream)
          </label>
          {live && (
            <div className="text-yellow-300">⚠ LIVE mode: connecting is announced on Aika&apos;s stream. Only use for sessions agreed with Samy.</div>
          )}
          <label className="flex items-center gap-8">
            <input type="checkbox" checked={p.config.autoSession} onChange={(e) => set({ autoSession: e.target.checked })} />
            Auto-knock when Aika is ready
          </label>

          <div className="flex gap-8 flex-wrap">
            {p.status === "offline" || p.status === "fatal" ? (
              <button className="px-12 py-4 rounded-4 bg-green-600" onClick={p.onConnect}>Connect</button>
            ) : (
              <button className="px-12 py-4 rounded-4 bg-red-600" onClick={p.onDisconnect}>Disconnect</button>
            )}
            <button className="px-12 py-4 rounded-4 bg-blue-600 disabled:opacity-40"
              disabled={!p.canKnock || p.inSession} onClick={p.onRequestSession}>Start session</button>
            <button className="px-12 py-4 rounded-4 bg-gray-600 disabled:opacity-40"
              disabled={!p.inSession} onClick={p.onEndSession}>End session</button>
          </div>

          <div>
            Widget URL for Samy&apos;s OBS (viewers connected: {p.widgetViewers})
            <div className="flex gap-4 mt-4">
              <input readOnly className={input} value={typeof window !== "undefined" ? p.getWidgetUrl() : ""} />
              <button className="px-8 rounded-4 bg-white/20"
                onClick={() => { navigator.clipboard?.writeText(p.getWidgetUrl()); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                {copied ? "✓" : "Copy"}
              </button>
            </div>
            <div className="opacity-60 mt-4">Keep this tab open while collabing — it runs Miko&apos;s brain and voice.</div>
          </div>

          <div className="bg-black/50 rounded-4 p-8 overflow-y-auto" style={{ maxHeight: 160 }}>
            {p.log.length === 0 ? <span className="opacity-50">log…</span> : p.log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}
