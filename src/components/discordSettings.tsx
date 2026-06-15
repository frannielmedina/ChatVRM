import React, { useCallback, useState } from "react";
import { DiscordConfig, DiscordSTTMode } from "@/features/discord/discordConfig";
import { Link } from "./link";

type Props = {
  config: DiscordConfig;
  isConnected: boolean;
  connectionError: string | null;
  onChangeConfig: (config: DiscordConfig) => void;
  onConnect: () => void;
  onDisconnect: () => void;
};

// ── VDO.Ninja share guide ─────────────────────────────────────────────────────
const VdoNinjaGuide = () => {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const roomId = "chatvrmXXXX"; // example
  const pushUrl = `https://vdo.ninja/?push=${roomId}&screenshare&autostart`;
  const viewUrl = `https://vdo.ninja/?view=${roomId}&cleanoutput&transparent`;

  return (
    <div className="my-40">
      <div className="my-16 typography-20 font-bold flex items-center gap-8">
        🎥 Share VTuber via VDO.Ninja (OBS)
      </div>

      <div className="p-16 bg-surface1 rounded-8 flex flex-col gap-16 text-sm">
        <p className="text-text-primary/70 leading-relaxed">
          Share your VTuber character with friends in OBS using VDO.Ninja — no screen
          capture software needed. Your friend adds a Browser Source in OBS.
        </p>

        {/* Step 1 */}
        <div className="border-l-4 border-primary pl-12">
          <div className="font-bold mb-4">Step 1 — Open VDO.Ninja Sender (You)</div>
          <p className="text-text-primary/60 mb-8 leading-relaxed">
            Open this URL in a <strong>new browser tab</strong>. Choose{" "}
            <em>"Share Screen"</em> and select the ChatVRM browser tab. This streams
            your VTuber over WebRTC peer-to-peer.
          </p>
          <div className="flex items-center gap-8 bg-surface3 rounded-8 p-10">
            <code className="text-xs flex-1 break-all text-primary">{pushUrl}</code>
            <button
              onClick={() => copy(pushUrl, "push")}
              className="flex-shrink-0 px-10 py-6 bg-primary hover:bg-primary/80 text-white rounded-8 text-xs font-bold"
            >
              {copied === "push" ? "✓ Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-text-primary/40 mt-4">
            Replace <code>chatvrmXXXX</code> with any unique room name you choose.
          </p>
        </div>

        {/* Step 2 */}
        <div className="border-l-4 border-secondary pl-12">
          <div className="font-bold mb-4">Step 2 — Add Browser Source in OBS (Your Friend)</div>
          <p className="text-text-primary/60 mb-8 leading-relaxed">
            In OBS, add a new <strong>Browser Source</strong> and paste this viewer URL.
            The background will be transparent — perfect for chroma key or overlay use.
          </p>
          <div className="flex items-center gap-8 bg-surface3 rounded-8 p-10">
            <code className="text-xs flex-1 break-all text-secondary">{viewUrl}</code>
            <button
              onClick={() => copy(viewUrl, "view")}
              className="flex-shrink-0 px-10 py-6 bg-secondary hover:bg-secondary/80 text-white rounded-8 text-xs font-bold"
            >
              {copied === "view" ? "✓ Copied!" : "Copy"}
            </button>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-8 text-xs text-text-primary/50">
            <div className="bg-surface3 rounded-8 p-8">
              <div className="font-bold text-text-primary/70 mb-2">OBS Browser Source settings</div>
              <ul className="space-y-1">
                <li>Width: <strong>1920</strong></li>
                <li>Height: <strong>1080</strong></li>
                <li>☑ Shutdown when not visible</li>
                <li>☑ Refresh browser when scene active</li>
              </ul>
            </div>
            <div className="bg-surface3 rounded-8 p-8">
              <div className="font-bold text-text-primary/70 mb-2">Tips</div>
              <ul className="space-y-1">
                <li>Use <strong>Green Screen</strong> bg for chroma key</li>
                <li>Use <strong>None</strong> bg for transparent overlay</li>
                <li>Add <em>Chroma Key</em> filter in OBS if needed</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="border-l-4 border-green-500 pl-12">
          <div className="font-bold mb-4">Step 3 — You&apos;re Live!</div>
          <p className="text-text-primary/60 leading-relaxed">
            Your VTuber now streams peer-to-peer to your friend&apos;s OBS. No third-party
            servers involved — the stream goes directly from your browser to theirs.
            Latency is typically under 200ms on the same network.
          </p>
          <div className="mt-8 p-10 bg-green-500/10 border border-green-500/20 rounded-8 text-xs text-green-700 leading-relaxed">
            <strong>🔒 Privacy:</strong> VDO.Ninja is peer-to-peer — your stream is NOT
            stored on any server. The room name acts as a password; share it only with
            people you trust.
          </div>
        </div>

        {/* Troubleshooting */}
        <details className="text-xs text-text-primary/50">
          <summary className="cursor-pointer font-bold hover:text-text-primary/70">
            Troubleshooting / FAQ
          </summary>
          <div className="mt-8 space-y-6 leading-relaxed">
            <div>
              <strong className="text-text-primary/70">My friend sees a black screen</strong>
              <p>Make sure you selected the <em>correct browser tab</em> (the ChatVRM tab) when sharing. Also check that the tab is not minimized.</p>
            </div>
            <div>
              <strong className="text-text-primary/70">The stream is blurry / low quality</strong>
              <p>VDO.Ninja may auto-downscale on slow connections. Try adding <code>&amp;quality=0</code> to the push URL for maximum quality.</p>
            </div>
            <div>
              <strong className="text-text-primary/70">Audio is included in the stream</strong>
              <p>Remove <code>&amp;autostart</code> from the push URL, or add <code>&amp;noaudio</code> to stream video-only.</p>
            </div>
            <div>
              <strong className="text-text-primary/70">I want a custom room name</strong>
              <p>Replace <code>chatvrmXXXX</code> with any string (e.g. your Twitch username). Both push and view URLs must use the same room name.</p>
            </div>
          </div>
        </details>

        <div className="text-xs text-text-primary/40 border-t border-surface3 pt-8">
          Need help? Visit{" "}
          <Link url="https://docs.vdo.ninja" label="docs.vdo.ninja" />
          {" "}or the{" "}
          <Link url="https://discord.gg/vdo-ninja" label="VDO.Ninja Discord" />
        </div>
      </div>
    </div>
  );
};

// ── Main Discord Settings ──────────────────────────────────────────────────────
export const DiscordSettings = ({
  config,
  isConnected,
  connectionError,
  onChangeConfig,
  onConnect,
  onDisconnect,
}: Props) => {
  const update = useCallback(
    (partial: Partial<DiscordConfig>) => onChangeConfig({ ...config, ...partial }),
    [config, onChangeConfig]
  );

  return (
    <>
      {/* ── Discord Integration ────────────────────────────────────────── */}
      <div className="my-40">
        <div className="my-16 typography-20 font-bold flex items-center gap-8">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#5865F2">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
          Discord Integration
          <span
            className={`inline-block w-10 h-10 rounded-full ${
              isConnected ? "bg-green-500" : "bg-surface3"
            }`}
          />
          <span className="text-sm font-normal text-text-primary/60">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>

        <div className="p-16 bg-surface1 rounded-8 flex flex-col gap-16">
          {/* ── Mode selector ──────────────────────────────────────────── */}
          <div>
            <div className="font-bold mb-8 text-sm">Integration Mode</div>
            <div className="grid grid-cols-2 gap-8">
              {(
                [
                  {
                    value: "bot" as DiscordSTTMode,
                    label: "🤖 Bot Token",
                    desc: "Monitor text channels & voice speaking events via a Discord bot",
                  },
                  {
                    value: "webhook" as DiscordSTTMode,
                    label: "🔗 Webhook",
                    desc: "Receive messages from Discord via an incoming webhook URL",
                  },
                ]
              ).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => update({ mode: opt.value })}
                  className={`p-12 rounded-8 border-2 text-left transition-all ${
                    config.mode === opt.value
                      ? "border-[#5865F2] bg-[#5865F2]/10"
                      : "border-surface3 bg-surface3 hover:border-[#5865F2]/40"
                  }`}
                >
                  <div className="font-bold text-sm">{opt.label}</div>
                  <div className="text-xs text-text-primary/60 mt-1 leading-tight">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Bot mode fields ─────────────────────────────────────────── */}
          {config.mode === "bot" && (
            <>
              {/* How to get a bot token */}
              <div className="p-10 bg-[#5865F2]/10 border border-[#5865F2]/20 rounded-8 text-xs text-[#5865F2] leading-relaxed">
                <strong>How to create a Discord bot:</strong>
                <ol className="mt-4 ml-12 list-decimal space-y-2">
                  <li>Go to <Link url="https://discord.com/developers/applications" label="discord.com/developers/applications" /></li>
                  <li>Click <strong>New Application</strong> → name it anything</li>
                  <li>Go to <strong>Bot</strong> tab → click <strong>Reset Token</strong> → copy it below</li>
                  <li>Under <strong>Privileged Gateway Intents</strong>, enable <strong>Message Content Intent</strong></li>
                  <li>Go to <strong>OAuth2 → URL Generator</strong>: select <em>bot</em> scope + <em>Read Messages</em> permission</li>
                  <li>Open the generated URL to invite the bot to your server</li>
                </ol>
              </div>

              <div>
                <div className="font-bold mb-4 text-sm">Bot Token</div>
                <input
                  className="px-12 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8 text-sm"
                  type="password"
                  placeholder="MTxxxxxxx.Gxxxxx.xxxxxxxxxxxxxxxxxxxxxxx"
                  value={config.botToken}
                  onChange={(e) => update({ botToken: e.target.value })}
                />
                <div className="text-xs text-text-primary/50 mt-4">
                  Never share your bot token. It stays in your browser only.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-12">
                <div>
                  <div className="font-bold mb-4 text-sm">Server (Guild) ID</div>
                  <input
                    className="px-12 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8 text-sm"
                    type="text"
                    placeholder="123456789012345678"
                    value={config.guildId}
                    onChange={(e) => update({ guildId: e.target.value })}
                  />
                </div>
                <div>
                  <div className="font-bold mb-4 text-sm">Text Channel ID</div>
                  <input
                    className="px-12 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8 text-sm"
                    type="text"
                    placeholder="123456789012345678"
                    value={config.channelId}
                    onChange={(e) => update({ channelId: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <div className="font-bold mb-4 text-sm">
                  Voice Channel ID{" "}
                  <span className="font-normal text-text-primary/50">(optional — for speaking event detection)</span>
                </div>
                <input
                  className="px-12 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8 text-sm"
                  type="text"
                  placeholder="123456789012345678"
                  value={config.voiceChannelId}
                  onChange={(e) => update({ voiceChannelId: e.target.value })}
                />
                <div className="text-xs text-text-primary/50 mt-4 leading-relaxed">
                  <strong>Getting IDs:</strong> Enable Developer Mode in Discord (Settings → Advanced → Developer Mode),
                  then right-click any server/channel and click <em>Copy ID</em>.
                </div>
              </div>

              <div className="flex flex-col gap-8">
                <label className="flex items-center gap-8 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.respondToMessages}
                    onChange={(e) => update({ respondToMessages: e.target.checked })}
                    className="w-16 h-16 accent-[#5865F2]"
                  />
                  <span className="text-sm">AI responds to Discord messages</span>
                </label>
                {config.respondToMessages && (
                  <label className="flex items-center gap-8 cursor-pointer ml-24">
                    <input
                      type="checkbox"
                      checked={config.respondToMentionsOnly}
                      onChange={(e) => update({ respondToMentionsOnly: e.target.checked })}
                      className="w-16 h-16 accent-[#5865F2]"
                    />
                    <span className="text-sm text-text-primary/70">Only respond to @mentions</span>
                  </label>
                )}
                <label className="flex items-center gap-8 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showOverlay}
                    onChange={(e) => update({ showOverlay: e.target.checked })}
                    className="w-16 h-16 accent-[#5865F2]"
                  />
                  <span className="text-sm">Show Discord chat overlay</span>
                </label>
              </div>
            </>
          )}

          {/* ── Webhook mode fields ─────────────────────────────────────── */}
          {config.mode === "webhook" && (
            <>
              <div className="p-10 bg-[#5865F2]/10 border border-[#5865F2]/20 rounded-8 text-xs text-[#5865F2] leading-relaxed">
                <strong>Webhook mode:</strong> Use this if you have an existing bot or
                automation (Zapier, n8n, etc.) that can POST to a URL. Your automation
                POSTs a JSON body <code>{`{"content": "Hello!"}`}</code> and ChatVRM
                receives it as a chat message.
                <br /><br />
                This requires a small relay server or Cloudflare Worker — ChatVRM cannot
                receive inbound HTTP requests directly from Discord (browsers don&apos;t
                accept inbound connections). See the{" "}
                <Link url="https://github.com/pixiv/ChatVRM" label="ChatVRM repo" />{" "}
                for a relay example.
              </div>
              <div>
                <div className="font-bold mb-4 text-sm">Outgoing Webhook / Relay URL</div>
                <input
                  className="px-12 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8 text-sm"
                  type="text"
                  placeholder="https://your-relay.workers.dev/discord"
                  value={config.webhookUrl}
                  onChange={(e) => update({ webhookUrl: e.target.value })}
                />
              </div>
            </>
          )}

          {/* Error message */}
          {connectionError && (
            <div className="flex items-center gap-8 text-sm text-red-700 bg-red-500/10 border border-red-500/20 rounded-8 px-12 py-8">
              <span>❌</span>
              <span>{connectionError}</span>
            </div>
          )}

          {/* Connect / Disconnect */}
          <div className="flex gap-8">
            {!isConnected ? (
              <button
                onClick={onConnect}
                disabled={config.mode === "bot" ? !config.botToken || !config.channelId : !config.webhookUrl}
                className="px-24 py-8 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold rounded-oval disabled:opacity-40 transition-colors"
              >
                Connect to Discord
              </button>
            ) : (
              <button
                onClick={onDisconnect}
                className="px-24 py-8 bg-secondary hover:bg-secondary-hover text-white font-bold rounded-oval transition-colors"
              >
                Disconnect
              </button>
            )}
          </div>

          {/* Voice STT explanation */}
          <details className="text-xs text-text-primary/50">
            <summary className="cursor-pointer font-bold hover:text-text-primary/70">
              About Voice-to-Text (STT) via Discord
            </summary>
            <div className="mt-8 space-y-6 leading-relaxed">
              <p>
                <strong className="text-text-primary/70">How speaking detection works:</strong>{" "}
                Discord&apos;s Gateway sends <code>VOICE_SPEAKING</code> events when a user in
                a monitored voice channel starts or stops talking. ChatVRM displays these
                events in the overlay so you can see who is speaking.
              </p>
              <p>
                <strong className="text-text-primary/70">Full STT (transcription) options:</strong>
              </p>
              <ul className="list-disc ml-16 space-y-2">
                <li>
                  <strong>Browser microphone (simplest):</strong> Click the mic button in
                  ChatVRM while in Discord voice. The Web Speech API transcribes your voice
                  locally — no extra setup needed.
                </li>
                <li>
                  <strong>Capture Discord audio:</strong> In ChatVRM&apos;s Screen Share
                  settings, enable <em>Chrome Screen Share</em> and select your Discord tab
                  including audio. Then enable the <em>Vision</em> feature to let the AI
                  see what you&apos;re doing too.
                </li>
                <li>
                  <strong>Discord bot with STT (advanced):</strong> Run a separate bot that
                  joins the voice channel, captures audio, and sends transcripts to ChatVRM
                  via the text channel. This requires a backend server.
                </li>
              </ul>
              <p className="text-text-primary/40">
                Discord&apos;s Terms of Service prohibit capturing other users&apos; audio
                without consent. Only use STT on your own audio or with explicit permission
                from all participants.
              </p>
            </div>
          </details>
        </div>
      </div>

      {/* ── VDO.Ninja OBS sharing guide ────────────────────────────────── */}
      <VdoNinjaGuide />
    </>
  );
};
