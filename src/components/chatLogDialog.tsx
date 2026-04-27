import { useEffect, useRef } from "react";
import { Message } from "@/features/messages/messages";

type Props = {
  messages: Message[];
  onClose: () => void;
};

export const ChatLogDialog = ({ messages, onClose }: Props) => {
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, []);

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSaveLog = () => {
    const lines = messages.map((m) => {
      const role = m.role === "assistant" ? "Character" : m.role === "user" ? "You" : "System";
      return `[${role}]: ${m.content}`;
    });
    const text = lines.join("\n\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-log-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveJson = () => {
    const json = JSON.stringify(messages, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-log-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Dialog */}
      <div className="bg-white w-full max-w-2xl mx-4 rounded-t-16 sm:rounded-16 shadow-2xl flex flex-col max-h-[80vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-20 py-14 border-b border-surface3 flex-shrink-0">
          <div className="flex items-center gap-10">
            <span className="text-lg font-bold text-text-primary">Chat History</span>
            <span className="text-sm text-text-primary/50 bg-surface1 px-8 py-2 rounded-oval">
              {messages.length} messages
            </span>
          </div>
          <div className="flex items-center gap-8">
            {/* Save as TXT */}
            <button
              onClick={handleSaveLog}
              title="Save as .txt"
              className="flex items-center gap-6 px-14 py-7 rounded-8 bg-surface1 hover:bg-surface3 border-2 border-surface3 hover:border-primary/40 text-sm font-bold transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              TXT
            </button>
            {/* Save as JSON */}
            <button
              onClick={handleSaveJson}
              title="Save as .json"
              className="flex items-center gap-6 px-14 py-7 rounded-8 bg-surface1 hover:bg-surface3 border-2 border-surface3 hover:border-primary/40 text-sm font-bold transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              JSON
            </button>
            {/* Close */}
            <button
              onClick={onClose}
              className="flex items-center justify-center w-32 h-32 rounded-8 bg-surface1 hover:bg-surface3 border-2 border-surface3 hover:border-secondary/40 text-text-primary transition-colors"
              title="Close (Esc)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto px-16 py-12 scroll-hidden">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-text-primary/40">
              <span className="text-2xl mb-8">💬</span>
              <span className="text-sm">No messages yet</span>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {messages.map((msg, i) => {
                const isAssistant = msg.role === "assistant";
                const isSystem = msg.role === "system";
                if (isSystem) return null;
                return (
                  <div
                    key={i}
                    className={`flex gap-10 ${isAssistant ? "flex-row" : "flex-row-reverse"}`}
                  >
                    {/* Avatar */}
                    <div
                      className={`flex-shrink-0 w-32 h-32 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                        isAssistant ? "bg-secondary" : "bg-primary"
                      }`}
                    >
                      {isAssistant ? "AI" : "Me"}
                    </div>
                    {/* Bubble */}
                    <div
                      className={`max-w-[80%] px-14 py-10 rounded-16 text-sm leading-relaxed ${
                        isAssistant
                          ? "bg-surface1 text-text-primary rounded-tl-4"
                          : "bg-primary text-white rounded-tr-4"
                      }`}
                    >
                      {msg.content.replace(/\[([a-zA-Z]*?)\]/g, "")}
                    </div>
                  </div>
                );
              })}
              <div ref={chatScrollRef} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-20 py-12 border-t border-surface3 flex-shrink-0 flex justify-between items-center">
          <span className="text-xs text-text-primary/40">Press Esc or click outside to close</span>
          <button
            onClick={onClose}
            className="px-20 py-8 rounded-oval bg-primary hover:bg-primary-hover text-white font-bold text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
