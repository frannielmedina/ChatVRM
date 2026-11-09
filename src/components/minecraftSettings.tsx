import React, { useCallback } from "react";
import {
  MinecraftConfig,
  MinecraftStatus,
  MINECRAFT_VERSIONS,
} from "@/features/minecraft/minecraftConfig";

type Props = {
  config: MinecraftConfig;
  status: MinecraftStatus;
  onChangeConfig: (c: MinecraftConfig) => void;
  onConnect: () => void;
  onDisconnect: () => void;
};

const Toggle = ({
  value,
  onChange,
  title,
  hint,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  title: string;
  hint?: string;
}) => (
  <div className="flex items-center justify-between gap-12">
    <div>
      <div className="font-bold text-sm">{title}</div>
      {hint && <div className="text-xs text-text-primary/60 mt-1">{hint}</div>}
    </div>
    <button
      onClick={() => onChange(!value)}
      className={`relative shrink-0 w-48 h-24 rounded-full transition-all duration-300 ${
        value ? "bg-primary" : "bg-surface3"
      }`}
    >
      <span
        className={`absolute top-2 w-20 h-20 bg-white rounded-full shadow transition-all duration-300 ${
          value ? "left-26" : "left-2"
        }`}
      />
    </button>
  </div>
);

const STATE_LABEL: Record<MinecraftStatus["state"], { icon: string; label: string; color: string }> = {
  idle:       { icon: "⏸",  label: "Not connected",          color: "text-text-primary/50" },
  bridge:     { icon: "🔌", label: "Bridge connected",       color: "text-blue-600" },
  connecting: { icon: "⏳", label: "Connecting…",            color: "text-purple-600" },
  connected:  { icon: "⛏️", label: "In the game",            color: "text-green-600" },
  kicked:     { icon: "🚫", label: "Kicked from the server", color: "text-orange-600" },
  error:      { icon: "❌", label: "Error",                  color: "text-red-600" },
};

export const MinecraftSettings = ({ config, status, onChangeConfig, onConnect, onDisconnect }: Props) => {
  const update = useCallback(
    (partial: Partial<MinecraftConfig>) => onChangeConfig({ ...config, ...partial }),
    [config, onChangeConfig]
  );

  const info = STATE_LABEL[status.state];
  const active = status.state === "connected" || status.state === "connecting" || status.state === "bridge";
  const inputCls = "px-12 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8 text-sm";

  return (
    <div className="my-40">
      <div className="my-16 typography-20 font-bold flex items-center gap-8">
        <span>⛏️ Minecraft</span>
        {status.state === "connected" && (
          <span className="text-xs bg-green-600 text-white px-8 py-2 rounded-oval font-normal">IN GAME</span>
        )}
      </div>

      <div className="mb-16 p-12 bg-surface1 rounded-8 text-sm text-text-primary/70 leading-relaxed">
        <p>
          A bot joins your Minecraft (Java) server, the AI answers in-game chat and its replies are typed back
          into the game. Needs the small local bridge running:
        </p>
        <pre className="mt-6 p-8 bg-surface3 rounded-8 text-xs overflow-x-auto">
{`cd tools/minecraft-bridge
npm install   # Node.js 22+
npm start`}
        </pre>
      </div>

      <div className="p-16 bg-surface1 rounded-8 flex flex-col gap-16">
        {/* Version */}
        <div>
          <div className="font-bold mb-8 text-sm">Minecraft Version</div>
          <div className="grid grid-cols-2 gap-6">
            {MINECRAFT_VERSIONS.map((v) => (
              <button
                key={v.id}
                onClick={() => update({ version: v.id })}
                className={`py-8 px-12 rounded-8 text-sm border-2 transition-all text-left ${
                  config.version === v.id
                    ? "border-primary bg-primary/10 font-bold"
                    : "border-surface3 bg-surface3 hover:border-primary/40"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className="text-xs text-text-primary/50 mt-4">
            {MINECRAFT_VERSIONS.find((v) => v.id === config.version)?.note}
          </div>
        </div>

        {/* Server */}
        <div className="grid grid-cols-3 gap-8">
          <div className="col-span-2">
            <div className="font-bold mb-4 text-sm">Server Address</div>
            <input
              className={inputCls}
              type="text"
              spellCheck={false}
              placeholder="play.example.com"
              value={config.host}
              onChange={(e) => update({ host: e.target.value })}
            />
          </div>
          <div>
            <div className="font-bold mb-4 text-sm">Port</div>
            <input
              className={inputCls}
              type="number"
              min={1}
              max={65535}
              value={config.port}
              onChange={(e) => update({ port: Number(e.target.value) || 25565 })}
            />
          </div>
        </div>

        {/* Bot */}
        <div>
          <div className="font-bold mb-4 text-sm">Bot Name</div>
          <input
            className={inputCls}
            type="text"
            spellCheck={false}
            maxLength={16}
            value={config.botName}
            onChange={(e) => update({ botName: e.target.value })}
          />
        </div>

        <div>
          <div className="font-bold mb-6 text-sm">Login</div>
          <div className="grid grid-cols-2 gap-6">
            {([
              { v: "offline", label: "Offline / LAN" },
              { v: "microsoft", label: "Microsoft account" },
            ] as const).map((o) => (
              <button
                key={o.v}
                onClick={() => update({ auth: o.v })}
                className={`py-6 rounded-8 text-sm border-2 transition-all font-bold ${
                  config.auth === o.v
                    ? "border-primary bg-primary/10"
                    : "border-surface3 bg-surface3 hover:border-primary/40"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {config.auth === "microsoft" && (
            <div className="text-xs text-text-primary/50 mt-4">
              Online-mode servers: you&apos;ll get a code to enter at microsoft.com/link the first time.
            </div>
          )}
        </div>

        {/* Behavior */}
        <div className="border-t border-surface3 pt-12 flex flex-col gap-12">
          <Toggle
            value={config.respondToChat}
            onChange={(v) => update({ respondToChat: v })}
            title="Respond to in-game chat"
            hint="The AI answers players' messages (and whispers)."
          />
          {config.respondToChat && (
            <Toggle
              value={config.mentionOnly}
              onChange={(v) => update({ mentionOnly: v })}
              title="Only when mentioned"
              hint="Answer only messages containing the trigger word (whispers always count)."
            />
          )}
          {config.respondToChat && config.mentionOnly && (
            <div>
              <div className="font-bold mb-4 text-sm">Trigger Word</div>
              <input
                className={inputCls}
                type="text"
                spellCheck={false}
                value={config.triggerWord}
                onChange={(e) => update({ triggerWord: e.target.value })}
              />
            </div>
          )}
          <Toggle
            value={config.sendRepliesToGame}
            onChange={(v) => update({ sendRepliesToGame: v })}
            title="Type replies into game chat"
            hint="Off = the character only speaks on stream, nothing is sent to the server."
          />
          <Toggle
            value={config.reactToEvents}
            onChange={(v) => update({ reactToEvents: v })}
            title="React to join / leave / death"
            hint="The AI comments when a player joins or leaves, or the bot dies."
          />
        </div>

        {/* Bridge address */}
        <details className="text-xs text-text-primary/60">
          <summary className="cursor-pointer font-bold hover:text-text-primary/80">Advanced</summary>
          <div className="mt-8">
            <div className="font-bold mb-4 text-sm">Bridge URL</div>
            <input
              className={inputCls}
              type="text"
              spellCheck={false}
              value={config.bridgeUrl}
              onChange={(e) => update({ bridgeUrl: e.target.value })}
            />
          </div>
        </details>

        {/* Status + connect */}
        <div className="border-t border-surface3 pt-12">
          <div className="flex items-center gap-8 mb-8">
            <span className="text-lg">{info.icon}</span>
            <span className={`font-bold text-sm ${info.color}`}>{info.label}</span>
            {status.state === "connected" && status.version && (
              <span className="text-xs text-text-primary/50 ml-auto">protocol data: {status.version}</span>
            )}
          </div>

          {status.msaCode && status.state !== "connected" && (
            <div className="text-xs bg-blue-500/10 border border-blue-500/30 rounded-8 px-12 py-8 mb-8 text-blue-700">
              Open <strong>{status.msaCode.url}</strong> and enter the code{" "}
              <strong className="font-mono text-sm">{status.msaCode.code}</strong>
            </div>
          )}

          {status.message && status.state !== "connected" && (
            <div
              className={`text-xs rounded-8 px-12 py-8 mb-8 ${
                status.state === "error" || status.state === "kicked"
                  ? "text-red-600 bg-red-500/10 border border-red-500/20"
                  : "text-text-primary/60 bg-surface3"
              }`}
            >
              {status.message}
            </div>
          )}

          {active ? (
            <button
              onClick={onDisconnect}
              className="w-full py-8 rounded-8 bg-surface3 hover:bg-surface3-hover font-bold text-sm"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={onConnect}
              disabled={!config.host.trim() || !config.botName.trim()}
              className="w-full py-8 rounded-8 bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm"
            >
              Connect
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
