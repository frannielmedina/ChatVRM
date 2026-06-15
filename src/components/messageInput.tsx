import { IconButton } from "./iconButton";

type Props = {
  userMessage: string;
  isMicRecording: boolean;
  isChatProcessing: boolean;
  onChangeUserMessage: (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  onClickSendButton: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onClickMicButton: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

export const MessageInput = ({
  userMessage,
  isMicRecording,
  isChatProcessing,
  onChangeUserMessage,
  onClickMicButton,
  onClickSendButton,
}: Props) => {
  return (
    <div className="absolute bottom-0 z-20 w-screen">
      <div className="bg-base text-black">
        <div className="mx-auto max-w-4xl p-16">
          <div className="grid grid-flow-col gap-[8px] grid-cols-[min-content_1fr_min-content]">
            {/* Mic button — red pulsing when recording, normal otherwise */}
            <IconButton
              iconName="24/Microphone"
              className={
                isMicRecording
                  ? "bg-red-500 hover:bg-red-600 active:bg-red-700 disabled:bg-red-300 animate-pulse"
                  : "bg-secondary hover:bg-secondary-hover active:bg-secondary-press disabled:bg-secondary-disabled"
              }
              isProcessing={false}
              disabled={isChatProcessing}
              onClick={onClickMicButton}
            />

            <input
              type="text"
              placeholder={
                isMicRecording
                  ? "Listening… (auto-sends when you stop talking)"
                  : "Type a message..."
              }
              onChange={onChangeUserMessage}
              disabled={isChatProcessing}
              className="bg-surface1 hover:bg-surface1-hover focus:bg-surface1 disabled:bg-surface1-disabled disabled:text-primary-disabled rounded-16 w-full px-16 text-text-primary typography-16 font-bold"
              value={userMessage}
            />

            {/* Send button — enabled when there's text, even while mic is on */}
            <IconButton
              iconName="24/Send"
              className="bg-secondary hover:bg-secondary-hover active:bg-secondary-press disabled:bg-secondary-disabled"
              isProcessing={isChatProcessing}
              disabled={isChatProcessing || !userMessage.trim()}
              onClick={onClickSendButton}
            />
          </div>
        </div>
        <div className="py-4 bg-[#413D43] text-center text-white font-Montserrat text-sm">
          powered by VRoid · ChatGPT · ElevenLabs · Qwen3-TTS · GPT-SoVITS
        </div>
      </div>
    </div>
  );
};
