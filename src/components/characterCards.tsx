import React, { useRef, useState } from "react";
import { TextButton } from "./textButton";
import { CharactersApi } from "@/features/characters/useCharacters";
import { CharacterCard } from "@/features/characters/characterCard";
import { SYSTEM_PROMPT } from "@/features/constants/systemPromptConstants";
import { AI_PROVIDERS } from "@/features/chat/aiProviders";
import { TTS_PROVIDERS } from "@/features/tts/ttsConfig";

type Props = {
  characters: CharactersApi;
  /** Jump to another settings tab (used by the "change in LLM / TTS tab" buttons). */
  onGoToTab: (tab: "llm" | "tts") => void;
};

const fieldCls = "px-16 py-8 bg-surface3 hover:bg-surface3-hover rounded-8 w-full";
const smallBtn =
  "px-12 py-4 rounded-oval border-2 border-surface3 bg-surface1 hover:bg-surface3 font-bold text-sm disabled:opacity-50";

const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <div className="my-32">
    <div className="typography-20 font-bold mb-4">{title}</div>
    {hint && <div className="text-sm text-text-primary/70 mb-12">{hint}</div>}
    <div className="p-16 bg-surface1 rounded-8">{children}</div>
  </div>
);

// ── List view ─────────────────────────────────────────────────────────────────
const CardList = ({
  characters,
  onEdit,
}: {
  characters: CharactersApi;
  onEdit: (id: string) => void;
}) => {
  const importRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStatus(await characters.importCardFile(file));
  };

  return (
    <>
      <div className="flex flex-wrap gap-8 mb-16">
        <TextButton
          onClick={() => {
            const id = characters.addCard();
            onEdit(id);
          }}
        >
          + New character
        </TextButton>
        <button className={smallBtn} onClick={() => importRef.current?.click()}>
          Import from file
        </button>
        <input ref={importRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImport} />
      </div>
      {status && (
        <div className={`text-sm mb-12 ${status.ok ? "text-green-600" : "text-secondary"}`}>{status.message}</div>
      )}

      <div className="grid gap-12">
        {characters.cards.map((card) => {
          const active = card.id === characters.activeId;
          return (
            <div
              key={card.id}
              className={`p-16 rounded-8 bg-surface1 border-2 ${active ? "border-primary" : "border-transparent"}`}
            >
              <div className="flex items-start justify-between gap-12">
                <div className="min-w-0">
                  <div className="font-bold typography-20 truncate">{card.name || "Unnamed"}</div>
                  <div className="text-sm text-text-primary/70 mt-4 line-clamp-2">
                    {card.description || "No description yet."}
                  </div>
                </div>
                {active && (
                  <span className="shrink-0 text-xs font-bold text-white bg-primary rounded-oval px-8 py-2">
                    Active
                  </span>
                )}
              </div>
              <div className="flex gap-8 mt-12">
                <TextButton onClick={() => onEdit(card.id)}>Edit</TextButton>
                {!active && (
                  <button className={smallBtn} onClick={() => characters.selectCard(card.id)}>
                    Use
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

// ── Editor view ───────────────────────────────────────────────────────────────
const CardEditor = ({
  card,
  characters,
  onBack,
  onGoToTab,
}: {
  card: CharacterCard;
  characters: CharactersApi;
  onBack: () => void;
  onGoToTab: Props["onGoToTab"];
}) => {
  const vrmRef = useRef<HTMLInputElement>(null);
  const kbFileRef = useRef<HTMLInputElement>(null);
  const [kbTitle, setKbTitle] = useState("");
  const [kbContent, setKbContent] = useState("");
  const [memText, setMemText] = useState("");
  const [memStatus, setMemStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [includeVrm, setIncludeVrm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isActive = card.id === characters.activeId;
  const busy = characters.memoryBusyId === card.id;
  const providerLabel = AI_PROVIDERS.find((p) => p.value === card.aiConfig.provider)?.label ?? card.aiConfig.provider;
  const ttsLabel = TTS_PROVIDERS.find((p) => p.value === card.ttsConfig.provider)?.label ?? card.ttsConfig.provider;

  const goConfigure = (tab: "llm" | "tts") => {
    characters.selectCard(card.id); // the LLM / TTS tabs edit the active character
    onGoToTab(tab);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-8 mb-16">
        <button className={smallBtn} onClick={onBack}>
          ← All characters
        </button>
        {!isActive && <TextButton onClick={() => characters.selectCard(card.id)}>Use this character</TextButton>}
        {isActive && <span className="text-sm font-bold text-primary">Active character</span>}
      </div>

      <Section title="Character">
        <div className="font-bold mb-4 text-sm">Name</div>
        <input
          className={`${fieldCls} mb-12`}
          value={card.name}
          onChange={(e) => characters.updateCard(card.id, { name: e.target.value })}
        />
        <div className="font-bold mb-4 text-sm">Description</div>
        <textarea
          className={`${fieldCls} h-[80px]`}
          placeholder="Shown on the character card"
          value={card.description}
          onChange={(e) => characters.updateCard(card.id, { description: e.target.value })}
        />
      </Section>

      <Section
        title="System Prompt"
        hint="Personality and rules only. Emotion and pose tags are added automatically — no need to write them here."
      >
        <textarea
          className={`${fieldCls} h-[280px]`}
          value={card.systemPrompt}
          onChange={(e) => characters.updateCard(card.id, { systemPrompt: e.target.value })}
        />
        <div className="mt-8">
          <button className={smallBtn} onClick={() => characters.updateCard(card.id, { systemPrompt: SYSTEM_PROMPT })}>
            Reset to default
          </button>
        </div>
      </Section>

      <Section title="LLM & Voice" hint="Chosen in the LLM and TTS tabs; each character remembers its own.">
        <div className="flex flex-wrap items-center justify-between gap-8 mb-8">
          <div className="text-sm">
            <span className="font-bold">LLM:</span> {providerLabel}
            {card.aiConfig.model ? ` · ${card.aiConfig.model}` : ""}
          </div>
          <button className={smallBtn} onClick={() => goConfigure("llm")}>
            Change in LLM tab
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-8">
          <div className="text-sm">
            <span className="font-bold">TTS:</span> {ttsLabel}
          </div>
          <button className={smallBtn} onClick={() => goConfigure("tts")}>
            Change in TTS tab
          </button>
        </div>
      </Section>

      <Section title="VRM Model">
        <div className="text-sm mb-8">
          {card.vrm.source === "custom" ? `Custom model${card.vrm.fileName ? `: ${card.vrm.fileName}` : ""}` : "Default avatar"}
        </div>
        <div className="flex flex-wrap gap-8">
          <TextButton onClick={() => vrmRef.current?.click()}>Select VRM file</TextButton>
          {card.vrm.source === "custom" && (
            <button className={smallBtn} onClick={() => characters.resetCardVrm(card.id)}>
              Use default avatar
            </button>
          )}
        </div>
        <input
          ref={vrmRef}
          type="file"
          accept=".vrm"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f && f.name.toLowerCase().endsWith(".vrm")) characters.setCardVrm(card.id, f);
          }}
        />
      </Section>

      <Section title="Knowledge Base" hint="Facts this character knows. Entries are given to the LLM with every message (the most relevant ones if the base gets large).">
        {card.knowledge.length === 0 && <div className="text-sm text-text-primary/60 mb-8">No knowledge yet.</div>}
        {card.knowledge.map((k) => (
          <div key={k.id} className="flex items-start gap-8 mb-8 p-8 bg-surface3 rounded-8">
            <div className="min-w-0 flex-1 text-sm">
              {k.title && <div className="font-bold">{k.title}</div>}
              <div className="whitespace-pre-wrap break-words line-clamp-4">{k.content}</div>
            </div>
            <button className={smallBtn} onClick={() => characters.deleteKnowledge(card.id, k.id)}>
              Delete
            </button>
          </div>
        ))}
        <input
          className={`${fieldCls} mb-8`}
          placeholder="Title (optional)"
          value={kbTitle}
          onChange={(e) => setKbTitle(e.target.value)}
        />
        <textarea
          className={`${fieldCls} h-[90px] mb-8`}
          placeholder="What should the character know?"
          value={kbContent}
          onChange={(e) => setKbContent(e.target.value)}
        />
        <div className="flex flex-wrap gap-8">
          <TextButton
            disabled={!kbContent.trim()}
            onClick={() => {
              characters.addKnowledge(card.id, kbTitle, kbContent);
              setKbTitle("");
              setKbContent("");
            }}
          >
            Add knowledge
          </TextButton>
          <button className={smallBtn} onClick={() => kbFileRef.current?.click()}>
            Add from .txt / .md file
          </button>
        </div>
        <input
          ref={kbFileRef}
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) characters.addKnowledge(card.id, f.name.replace(/\.[^.]+$/, ""), await f.text());
          }}
        />
      </Section>

      <Section
        title="Long-Term Memory"
        hint="Things the character remembers between conversations. Memories are always used; the switch below only controls whether the LLM writes new ones on its own."
      >
        <label className="flex items-center gap-8 cursor-pointer mb-8">
          <input
            type="checkbox"
            className="w-16 h-16 accent-primary"
            checked={card.memory.autoGenerate}
            onChange={(e) => characters.setMemorySettings(card.id, { autoGenerate: e.target.checked })}
          />
          <span>Generate memory automatically</span>
        </label>
        {card.memory.autoGenerate && (
          <div className="flex items-center gap-8 mb-12 text-sm">
            <span>Every</span>
            <input
              type="number"
              min={2}
              className="px-8 py-4 w-[72px] bg-surface3 rounded-8"
              value={card.memory.autoEvery}
              onChange={(e) =>
                characters.setMemorySettings(card.id, { autoEvery: Math.max(2, Number(e.target.value) || 2) })
              }
            />
            <span>messages from you</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-8 mb-12">
          <TextButton
            disabled={busy}
            onClick={async () => setMemStatus(await characters.generateMemoryNow(card.id))}
          >
            {busy ? "Generating…" : "Generate memory with AI"}
          </TextButton>
          {card.memory.entries.length > 0 && (
            <button
              className={smallBtn}
              onClick={() => {
                if (window.confirm("Delete all memories of this character?")) characters.clearMemory(card.id);
              }}
            >
              Clear all
            </button>
          )}
        </div>
        {memStatus && (
          <div className={`text-sm mb-8 ${memStatus.ok ? "text-green-600" : "text-secondary"}`}>{memStatus.message}</div>
        )}

        {card.memory.entries.length === 0 && <div className="text-sm text-text-primary/60 mb-8">No memories yet.</div>}
        {card.memory.entries.map((m) => (
          <div key={m.id} className="flex items-start gap-8 mb-8 p-8 bg-surface3 rounded-8">
            <div className="min-w-0 flex-1 text-sm break-words">
              {m.text}
              {m.source === "ai" && <span className="ml-8 text-xs text-primary font-bold">AI</span>}
            </div>
            <button className={smallBtn} onClick={() => characters.deleteMemory(card.id, m.id)}>
              Delete
            </button>
          </div>
        ))}
        <div className="flex gap-8 mt-8">
          <input
            className={fieldCls}
            placeholder="Add a memory manually…"
            value={memText}
            onChange={(e) => setMemText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && memText.trim()) {
                characters.addMemory(card.id, memText);
                setMemText("");
              }
            }}
          />
          <TextButton
            disabled={!memText.trim()}
            onClick={() => {
              characters.addMemory(card.id, memText);
              setMemText("");
            }}
          >
            Add
          </TextButton>
        </div>
      </Section>

      <Section title="Share / Backup" hint="Saves this character — knowledge base and long-term memory included — to a file. API keys are never written to it.">
        <label className="flex items-center gap-8 cursor-pointer mb-12 text-sm">
          <input
            type="checkbox"
            className="w-16 h-16 accent-primary"
            checked={includeVrm}
            onChange={(e) => setIncludeVrm(e.target.checked)}
            disabled={card.vrm.source !== "custom"}
          />
          <span>Include the VRM model (bigger file)</span>
        </label>
        <div className="flex flex-wrap gap-8">
          <TextButton onClick={() => characters.exportCard(card.id, includeVrm)}>Save to file</TextButton>
          <button
            className={smallBtn}
            onClick={async () => {
              await characters.duplicateCard(card.id);
            }}
          >
            Duplicate
          </button>
          {!confirmDelete ? (
            <button
              className={`${smallBtn} text-secondary`}
              disabled={characters.cards.length <= 1}
              title={characters.cards.length <= 1 ? "You need at least one character" : undefined}
              onClick={() => setConfirmDelete(true)}
            >
              Delete character
            </button>
          ) : (
            <>
              <button
                className="px-12 py-4 rounded-oval bg-secondary text-white font-bold text-sm"
                onClick={async () => {
                  if (await characters.deleteCard(card.id)) onBack();
                }}
              >
                Yes, delete “{card.name || "Unnamed"}”
              </button>
              <button className={smallBtn} onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </>
          )}
        </div>
      </Section>
    </>
  );
};

// ── Tab content ───────────────────────────────────────────────────────────────
export const CharacterCards = ({ characters, onGoToTab }: Props) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = editingId ? characters.cards.find((c) => c.id === editingId) : undefined;

  return editing ? (
    <CardEditor card={editing} characters={characters} onBack={() => setEditingId(null)} onGoToTab={onGoToTab} />
  ) : (
    <CardList characters={characters} onEdit={setEditingId} />
  );
};

// ── Compact switcher (used in Screen Share / gaming mode) ─────────────────────
// Gaming mode talks through the same chat pipeline, so whichever character is
// active here is the one that reacts to the game — prompt, knowledge, memory,
// LLM, voice and VRM included.
export const CharacterQuickSwitch = ({
  characters,
  onManage,
}: {
  characters: CharactersApi;
  onManage: () => void;
}) => (
  <div className="my-40">
    <div className="my-16 typography-20 font-bold">Character</div>
    <div className="p-16 bg-surface1 rounded-8">
      <div className="text-sm text-text-primary/70 mb-8">
        The character that reacts while you play. Switching also changes its voice, LLM and VRM model.
      </div>
      <div className="flex flex-wrap items-center gap-8">
        <select
          className="px-16 py-8 bg-surface3 hover:bg-surface3-hover rounded-8 min-w-[200px]"
          value={characters.activeId}
          onChange={(e) => characters.selectCard(e.target.value)}
        >
          {characters.cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name || "Unnamed"}
            </option>
          ))}
        </select>
        <button className={smallBtn} onClick={onManage}>
          Manage characters
        </button>
      </div>
      {characters.activeCard?.description && (
        <div className="text-sm text-text-primary/60 mt-8 line-clamp-2">{characters.activeCard.description}</div>
      )}
    </div>
  </div>
);
