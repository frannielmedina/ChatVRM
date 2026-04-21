import { useState, useCallback } from "react";
import { Link } from "./link";

type Props = {
  openAiKey: string;
  onChangeAiKey: (openAiKey: string) => void;
};

export const Introduction = ({ openAiKey, onChangeAiKey }: Props) => {
  const [opened, setOpened] = useState(!openAiKey);

  const handleAiKeyChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChangeAiKey(event.target.value);
    },
    [onChangeAiKey]
  );

  return opened ? (
    <div className="absolute z-40 w-full h-full px-24 py-40 bg-black/30 font-M_PLUS_2">
      <div className="mx-auto my-auto max-w-3xl max-h-full p-24 overflow-auto bg-white rounded-16">
        <div className="my-24">
          <div className="my-8 font-bold typography-20 text-secondary">
            About ChatVRM
          </div>
          <div>
            Chat with a 3D character right in your browser using microphone or text input,
            voice synthesis, and multiple TTS providers including ElevenLabs, Qwen3-TTS, and
            GPT-SoVITS. You can also connect to Twitch chat and share your screen for streaming.
          </div>
        </div>

        <div className="my-24">
          <div className="my-8 font-bold typography-20 text-secondary">Technology</div>
          <div>
            3D models use{" "}
            <Link url="https://github.com/pixiv/three-vrm" label="@pixiv/three-vrm" />,
            conversation generation uses{" "}
            <Link url="https://platform.openai.com/docs/api-reference/chat" label="ChatGPT API" />.
            Voice synthesis supports Koeiromap, ElevenLabs, Qwen3-TTS, and GPT-SoVITS.
          </div>
        </div>

        <div className="my-24">
          <div className="my-8 font-bold typography-20 text-secondary">Usage Notes</div>
          <div>
            Do not intentionally induce discriminatory, violent, or harmful speech.
            When swapping VRM models, follow the model&apos;s license terms.
          </div>
        </div>

        <div className="my-24">
          <div className="my-8 font-bold typography-20 text-secondary">OpenAI API Key</div>
          <input
            type="text"
            placeholder="sk-..."
            value={openAiKey}
            onChange={handleAiKeyChange}
            className="my-4 px-16 py-8 w-full h-40 bg-surface3 hover:bg-surface3-hover rounded-4 text-ellipsis"
          />
          <div className="mt-4 text-sm">
            Get your key at{" "}
            <Link url="https://platform.openai.com/account/api-keys" label="OpenAI" />.
            Keys are sent directly to OpenAI and never stored on any server.
          </div>
        </div>

        <div className="my-24">
          <button
            onClick={() => setOpened(false)}
            className="font-bold bg-secondary hover:bg-secondary-hover active:bg-secondary-press disabled:bg-secondary-disabled text-white px-24 py-8 rounded-oval"
          >
            {openAiKey ? "Start" : "Continue without API Key"}
          </button>
        </div>
      </div>
    </div>
  ) : null;
};
