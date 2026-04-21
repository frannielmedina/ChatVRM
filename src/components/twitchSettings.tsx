import React, { useCallback } from "react";
import { TwitchConfig } from "@/features/twitch/twitchClient";
import { Link } from "./link";

type Props = {
  config: TwitchConfig;
  isConnected: boolean;
  onChangeConfig: (config: TwitchConfig) => void;
  onConnect: () => void;
  onDisconnect: () => void;
};

export const TwitchSettings = ({
  config,
  isConnected,
  onChangeConfig,
  onConnect,
  onDisconnect,
}: Props) => {
  const update = useCallback(
    (partial: Partial<TwitchConfig>) => {
      onChangeConfig({ ...config, ...partial });
    },
    [config, onChangeConfig]
  );

  return (
    <div className="my-40">
      <div className="my-16 typography-20 font-bold flex items-center gap-8">
        <span>Twitch Integration</span>
        <span
          className={`inline-block w-10 h-10 rounded-full ${
            isConnected ? "bg-green-500" : "bg-surface3"
          }`}
        />
        <span className="text-sm font-normal text-text-primary/60">
          {isConnected ? "Connected" : "Disconnected"}
        </span>
      </div>

      <div className="p-16 bg-surface1 rounded-8">
        {/* Channel */}
        <div className="mb-12">
          <div className="font-bold mb-4">Channel Name</div>
          <input
            className="text-ellipsis px-16 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8"
            type="text"
            placeholder="yourchannel"
            value={config.channel}
            onChange={(e) => update({ channel: e.target.value })}
          />
        </div>

        {/* OAuth (optional for read-only) */}
        <div className="mb-12">
          <div className="font-bold mb-4">
            OAuth Token{" "}
            <span className="text-sm font-normal text-text-primary/60">(optional — for read-only, leave blank)</span>
          </div>
          <input
            className="text-ellipsis px-16 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8"
            type="password"
            placeholder="oauth:xxxxxx"
            value={config.oauthToken || ""}
            onChange={(e) => update({ oauthToken: e.target.value })}
          />
          <div className="text-xs text-text-primary/60 mt-4">
            Get token at{" "}
            <Link url="https://twitchapps.com/tmi/" label="twitchapps.com/tmi" />
          </div>
        </div>

        {/* Options */}
        <div className="mb-16 flex flex-col gap-8">
          <label className="flex items-center gap-8 cursor-pointer">
            <input
              type="checkbox"
              checked={config.readChat}
              onChange={(e) => update({ readChat: e.target.checked })}
              className="w-16 h-16 accent-primary"
            />
            <span>Show chat messages in overlay</span>
          </label>
          <label className="flex items-center gap-8 cursor-pointer">
            <input
              type="checkbox"
              checked={config.respondToChat}
              onChange={(e) => update({ respondToChat: e.target.checked })}
              className="w-16 h-16 accent-primary"
            />
            <span>AI responds to chat messages</span>
          </label>
        </div>

        {/* Connect / Disconnect */}
        <div className="flex gap-8">
          {!isConnected ? (
            <button
              onClick={onConnect}
              disabled={!config.channel}
              className="px-24 py-8 bg-[#9146FF] hover:bg-[#a970ff] text-white font-bold rounded-oval disabled:opacity-40"
            >
              Connect to Twitch
            </button>
          ) : (
            <button
              onClick={onDisconnect}
              className="px-24 py-8 bg-secondary hover:bg-secondary-hover text-white font-bold rounded-oval"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
