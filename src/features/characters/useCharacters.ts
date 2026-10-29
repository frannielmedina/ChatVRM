import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Viewer } from "@/features/vrmViewer/viewer";
import { buildUrl } from "@/utils/buildUrl";
import { Message } from "@/features/messages/messages";
import { AIProviderConfig, DEFAULT_AI_CONFIG } from "@/features/chat/aiProviders";
import { TTSConfig, DEFAULT_TTS_CONFIG } from "@/features/tts/ttsConfig";
import { KoeiroParam, DEFAULT_PARAM } from "@/features/constants/koeiroParam";
import { SYSTEM_PROMPT } from "@/features/constants/systemPromptConstants";
import {
  saveCardVrm,
  loadCardVrmBlob,
  loadCardVrmUrl,
  loadLegacyVrmBlob,
  deleteCardVrm,
} from "@/features/vrmViewer/vrmStorage";
import {
  CharacterCard,
  CharacterFile,
  CharacterLibrary,
  MemoryEntry,
  KnowledgeEntry,
  blobToDataUrl,
  buildSystemPrompt,
  createCard,
  dataUrlToBlob,
  downloadJson,
  normalizeCard,
  safeFileName,
  stripSecrets,
  uid,
} from "./characterCard";
import { generateMemories } from "./memoryGenerator";

const LS_KEY = "chatVRM_characters";
const LEGACY_PARAMS_KEY = "chatVRMParams";
const LEGACY_IS_DEFAULT_KEY = "chatVRM_isDefaultVrm";
const DEFAULT_VRM = "/AvatarSample_B.vrm";

/** What the General tab's Save / Load button writes for the character library. */
export type LibrarySnapshot = CharacterLibrary & { vrm?: Record<string, string> };

type Params = {
  viewer: Viewer;
  /** True once the viewer is ready and the loading screen is gone. */
  vrmEnabled: boolean;
  aiConfig: AIProviderConfig;
  ttsConfig: TTSConfig;
  koeiroParam: KoeiroParam;
  setAiConfig: (c: AIProviderConfig) => void;
  setTtsConfig: (c: TTSConfig) => void;
  setKoeiroParam: (p: KoeiroParam) => void;
  chatLog: Message[];
};

export type CharactersApi = ReturnType<typeof useCharacters>;

export function useCharacters(p: Params) {
  const { viewer, vrmEnabled, aiConfig, ttsConfig, koeiroParam, setAiConfig, setTtsConfig, setKoeiroParam, chatLog } = p;

  const [cards, setCards] = useState<CharacterCard[]>([]);
  const [activeId, setActiveId] = useState("");
  const [ready, setReady] = useState(false);
  const [memoryBusyId, setMemoryBusyId] = useState<string | null>(null);

  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const activeCard = useMemo(
    () => cards.find((c) => c.id === activeId) ?? cards[0],
    [cards, activeId]
  );

  const applyLive = useCallback(
    (c: CharacterCard) => {
      setAiConfig(c.aiConfig);
      setTtsConfig(c.ttsConfig);
      setKoeiroParam(c.koeiroParam);
    },
    [setAiConfig, setTtsConfig, setKoeiroParam]
  );

  // ── Load (or migrate from the single-character setup) ──────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let lib: CharacterLibrary | null = null;
      try {
        const raw = window.localStorage.getItem(LS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed?.cards) && parsed.cards.length > 0) {
            const loaded = parsed.cards.map(normalizeCard);
            lib = {
              cards: loaded,
              activeId: loaded.some((c: CharacterCard) => c.id === parsed.activeId)
                ? parsed.activeId
                : loaded[0].id,
            };
          }
        }
      } catch {
        /* corrupt → fall through to migration */
      }

      if (!lib) {
        let legacy: any = {};
        try {
          legacy = JSON.parse(window.localStorage.getItem(LEGACY_PARAMS_KEY) ?? "{}");
        } catch {
          /* ignore */
        }
        const first = createCard({
          name: "Miko",
          description: "Your first character — migrated from your previous settings.",
          systemPrompt: typeof legacy.systemPrompt === "string" ? legacy.systemPrompt : SYSTEM_PROMPT,
          aiConfig: { ...DEFAULT_AI_CONFIG, ...(legacy.aiConfig ?? {}) },
          ttsConfig: { ...DEFAULT_TTS_CONFIG, ...(legacy.ttsConfig ?? {}) },
          koeiroParam: { ...DEFAULT_PARAM, ...(legacy.koeiroParam ?? {}) },
        });
        if (window.localStorage.getItem(LEGACY_IS_DEFAULT_KEY) === "false") {
          const blob = await loadLegacyVrmBlob();
          if (blob) {
            await saveCardVrm(first.id, blob);
            first.vrm = { source: "custom", fileName: "custom.vrm", version: 1 };
          }
        }
        lib = { cards: [first], activeId: first.id };
      }
      if (cancelled) return;

      const active = lib.cards.find((c) => c.id === lib!.activeId)!;
      setCards(lib.cards);
      setActiveId(active.id);
      applyLive(active);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify({ cards, activeId }));
    } catch (e) {
      console.warn("[characters] couldn't persist", e);
    }
  }, [cards, activeId, ready]);

  // ── The LLM / TTS tabs edit the live config; mirror it into the active card ─
  useEffect(() => {
    if (!ready) return;
    setCards((prev) => {
      let changed = false;
      const next = prev.map((c) => {
        if (c.id !== activeIdRef.current) return c;
        if (
          JSON.stringify([c.aiConfig, c.ttsConfig, c.koeiroParam]) ===
          JSON.stringify([aiConfig, ttsConfig, koeiroParam])
        )
          return c;
        changed = true;
        return { ...c, aiConfig, ttsConfig, koeiroParam, updatedAt: Date.now() };
      });
      return changed ? next : prev;
    });
  }, [aiConfig, ttsConfig, koeiroParam, ready]);

  // ── Load the active character's VRM ────────────────────────────────────────
  const vrmKey = activeCard ? `${activeCard.id}:${activeCard.vrm.source}:${activeCard.vrm.version}` : "";
  const loadActiveVrm = useCallback(async () => {
    const card = cardsRef.current.find((c) => c.id === activeIdRef.current);
    if (!card) return;
    const url =
      card.vrm.source === "custom" ? await loadCardVrmUrl(card.id) : null;
    viewer.loadVrm(url ?? buildUrl(DEFAULT_VRM));
  }, [viewer]);

  useEffect(() => {
    if (!ready || !vrmEnabled || !vrmKey) return;
    loadActiveVrm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, vrmEnabled, vrmKey]);

  // ── Card operations ────────────────────────────────────────────────────────
  const selectCard = useCallback(
    (id: string) => {
      const c = cardsRef.current.find((x) => x.id === id);
      if (!c || id === activeIdRef.current) return;
      applyLive(c);
      setActiveId(id);
    },
    [applyLive]
  );

  const updateCard = useCallback((id: string, patch: Partial<CharacterCard>) => {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c))
    );
  }, []);

  const mutateCard = useCallback((id: string, fn: (c: CharacterCard) => CharacterCard) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...fn(c), updatedAt: Date.now() } : c)));
  }, []);

  /** New cards start with the active card's LLM / TTS (and keys), so they work immediately. */
  const addCard = useCallback((): string => {
    const base = cardsRef.current.find((c) => c.id === activeIdRef.current);
    const card = createCard({
      aiConfig: base ? { ...base.aiConfig } : undefined,
      ttsConfig: base ? { ...base.ttsConfig } : undefined,
      koeiroParam: base ? { ...base.koeiroParam } : undefined,
    });
    setCards((prev) => [...prev, card]);
    return card.id;
  }, []);

  const duplicateCard = useCallback(async (id: string): Promise<string | null> => {
    const src = cardsRef.current.find((c) => c.id === id);
    if (!src) return null;
    const copy: CharacterCard = normalizeCard({
      ...JSON.parse(JSON.stringify(src)),
      id: uid(),
      name: `${src.name} (copy)`,
      createdAt: Date.now(),
    });
    if (src.vrm.source === "custom") {
      const blob = await loadCardVrmBlob(src.id);
      if (blob) await saveCardVrm(copy.id, blob);
      else copy.vrm = { source: "default", version: 0 };
    }
    setCards((prev) => [...prev, copy]);
    return copy.id;
  }, []);

  const deleteCard = useCallback(
    async (id: string): Promise<boolean> => {
      const prev = cardsRef.current;
      if (prev.length <= 1) return false;
      const remaining = prev.filter((c) => c.id !== id);
      if (id === activeIdRef.current) {
        applyLive(remaining[0]);
        setActiveId(remaining[0].id);
      }
      setCards(remaining);
      await deleteCardVrm(id);
      return true;
    },
    [applyLive]
  );

  // ── VRM per card ───────────────────────────────────────────────────────────
  const setCardVrm = useCallback(
    async (id: string, file: File) => {
      await saveCardVrm(id, file);
      mutateCard(id, (c) => ({
        ...c,
        vrm: { source: "custom", fileName: file.name, version: c.vrm.version + 1 },
      }));
    },
    [mutateCard]
  );

  const resetCardVrm = useCallback(
    async (id: string) => {
      await deleteCardVrm(id);
      mutateCard(id, (c) => ({ ...c, vrm: { source: "default", version: c.vrm.version + 1 } }));
    },
    [mutateCard]
  );

  // ── Knowledge ──────────────────────────────────────────────────────────────
  const addKnowledge = useCallback(
    (id: string, title: string, content: string) => {
      if (!content.trim()) return;
      const entry: KnowledgeEntry = { id: uid(), title: title.trim(), content: content.trim() };
      mutateCard(id, (c) => ({ ...c, knowledge: [...c.knowledge, entry] }));
    },
    [mutateCard]
  );
  const deleteKnowledge = useCallback(
    (id: string, entryId: string) =>
      mutateCard(id, (c) => ({ ...c, knowledge: c.knowledge.filter((k) => k.id !== entryId) })),
    [mutateCard]
  );

  // ── Long-term memory ───────────────────────────────────────────────────────
  const addMemory = useCallback(
    (id: string, text: string) => {
      if (!text.trim()) return;
      const entry: MemoryEntry = { id: uid(), text: text.trim(), createdAt: Date.now(), source: "manual" };
      mutateCard(id, (c) => ({ ...c, memory: { ...c.memory, entries: [...c.memory.entries, entry] } }));
    },
    [mutateCard]
  );
  const deleteMemory = useCallback(
    (id: string, entryId: string) =>
      mutateCard(id, (c) => ({
        ...c,
        memory: { ...c.memory, entries: c.memory.entries.filter((m) => m.id !== entryId) },
      })),
    [mutateCard]
  );
  const clearMemory = useCallback(
    (id: string) => mutateCard(id, (c) => ({ ...c, memory: { ...c.memory, entries: [] } })),
    [mutateCard]
  );
  const setMemorySettings = useCallback(
    (id: string, patch: Partial<Pick<CharacterCard["memory"], "autoGenerate" | "autoEvery">>) =>
      mutateCard(id, (c) => ({ ...c, memory: { ...c.memory, ...patch } })),
    [mutateCard]
  );

  const memoryBusyRef = useRef(false);
  /** Asks the LLM to write memories from the recent chat. Returns a short status line. */
  const generateMemoryNow = useCallback(
    async (id: string): Promise<{ ok: boolean; message: string }> => {
      if (memoryBusyRef.current) return { ok: false, message: "Already generating…" };
      const card = cardsRef.current.find((c) => c.id === id);
      if (!card) return { ok: false, message: "Character not found." };
      memoryBusyRef.current = true;
      setMemoryBusyId(id);
      try {
        const cfg = id === activeIdRef.current ? aiConfig : card.aiConfig;
        const res = await generateMemories(card, chatLog, cfg);
        if (!res.ok) return { ok: false, message: res.error };
        if (res.added.length === 0) return { ok: true, message: "Nothing new worth remembering." };
        mutateCard(id, (c) => ({
          ...c,
          memory: { ...c.memory, entries: [...c.memory.entries, ...res.added] },
        }));
        return { ok: true, message: `Added ${res.added.length} new ${res.added.length === 1 ? "memory" : "memories"}.` };
      } finally {
        memoryBusyRef.current = false;
        setMemoryBusyId(null);
      }
    },
    [aiConfig, chatLog, mutateCard]
  );

  // Auto-generate: every N user messages, once the character has finished replying.
  const lastMemoryCountRef = useRef(0);
  useEffect(() => {
    if (!ready || !activeCard) return;
    const userCount = chatLog.filter((m) => m.role === "user").length;
    if (userCount < lastMemoryCountRef.current) lastMemoryCountRef.current = userCount; // history cleared
    const last = chatLog[chatLog.length - 1];
    if (!activeCard.memory.autoGenerate || last?.role !== "assistant") return;
    if (userCount - lastMemoryCountRef.current < Math.max(2, activeCard.memory.autoEvery)) return;
    lastMemoryCountRef.current = userCount;
    generateMemoryNow(activeCard.id);
  }, [chatLog, ready, activeCard, generateMemoryNow]);

  // ── Export / import ────────────────────────────────────────────────────────
  const exportCard = useCallback(async (id: string, includeVrm: boolean) => {
    const card = cardsRef.current.find((c) => c.id === id);
    if (!card) return;
    const file: CharacterFile = {
      _type: "chatvrm-character",
      _version: 1,
      _savedAt: new Date().toISOString(),
      card: stripSecrets(card),
    };
    if (includeVrm && card.vrm.source === "custom") {
      const blob = await loadCardVrmBlob(id);
      if (blob) file.vrmData = await blobToDataUrl(blob);
    }
    downloadJson(file, `${safeFileName(card.name)}.character.json`);
  }, []);

  const importCardFile = useCallback(
    async (file: File): Promise<{ ok: boolean; message: string }> => {
      let parsed: any;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        return { ok: false, message: "That file isn't valid JSON." };
      }
      const raw = parsed?._type === "chatvrm-character" ? parsed.card : parsed?.card ?? parsed;
      if (!raw || typeof raw !== "object" || typeof raw.name !== "string") {
        return { ok: false, message: "That doesn't look like a character card file." };
      }
      const card = normalizeCard({ ...raw, id: uid() });
      card.updatedAt = Date.now();

      // Files never contain API keys — borrow the active card's so it works right away.
      const base = cardsRef.current.find((c) => c.id === activeIdRef.current);
      if (base) {
        const ai: any = card.aiConfig;
        if (!ai.apiKey && base.aiConfig.provider === card.aiConfig.provider) ai.apiKey = base.aiConfig.apiKey;
        const tts: any = card.ttsConfig;
        const baseTts: any = base.ttsConfig;
        for (const k of ["koeiromapKey", "elevenLabsKey", "elevenLabsKeys", "fishAudioKey"]) {
          if (!parsed?.card?.ttsConfig?.[k] && baseTts[k]) tts[k] = baseTts[k];
        }
      }

      let vrmNote = "";
      if (typeof parsed?.vrmData === "string") {
        await saveCardVrm(card.id, await dataUrlToBlob(parsed.vrmData));
        card.vrm = { source: "custom", fileName: card.vrm.fileName, version: 1 };
      } else if (card.vrm.source === "custom") {
        card.vrm = { source: "default", version: 0 };
        vrmNote = " Its VRM model wasn't in the file — pick one in the card.";
      }
      setCards((prev) => [...prev, card]);
      return { ok: true, message: `Imported “${card.name}”.${vrmNote}` };
    },
    []
  );

  const buildLibrary = useCallback(async (includeVrm: boolean): Promise<LibrarySnapshot> => {
    const lib: LibrarySnapshot = { cards: cardsRef.current, activeId: activeIdRef.current };
    if (includeVrm) {
      lib.vrm = {};
      for (const c of cardsRef.current) {
        if (c.vrm.source !== "custom") continue;
        const blob = await loadCardVrmBlob(c.id);
        if (blob) lib.vrm[c.id] = await blobToDataUrl(blob);
      }
    }
    return lib;
  }, []);

  const loadLibrary = useCallback(
    async (lib: LibrarySnapshot) => {
      const loaded = (lib.cards ?? []).map(normalizeCard);
      if (loaded.length === 0) return;
      for (const c of loaded) {
        const data = lib.vrm?.[c.id];
        if (data) {
          await saveCardVrm(c.id, await dataUrlToBlob(data));
          c.vrm = { ...c.vrm, source: "custom", version: c.vrm.version + 1 };
        } else if (c.vrm.source === "custom" && !(await loadCardVrmBlob(c.id))) {
          c.vrm = { source: "default", version: c.vrm.version + 1 };
        }
      }
      const active = loaded.find((c) => c.id === lib.activeId) ?? loaded[0];
      setCards(loaded);
      setActiveId(active.id);
      applyLive(active);
    },
    [applyLive]
  );

  const buildPrompt = useCallback(
    (userText: string) => (activeCard ? buildSystemPrompt(activeCard, userText) : SYSTEM_PROMPT),
    [activeCard]
  );

  return {
    ready,
    cards,
    activeId: activeCard?.id ?? "",
    activeCard,
    memoryBusyId,
    selectCard,
    addCard,
    duplicateCard,
    deleteCard,
    updateCard,
    setCardVrm,
    resetCardVrm,
    addKnowledge,
    deleteKnowledge,
    addMemory,
    deleteMemory,
    clearMemory,
    setMemorySettings,
    generateMemoryNow,
    exportCard,
    importCardFile,
    buildLibrary,
    loadLibrary,
    reloadActiveVrm: loadActiveVrm,
    buildPrompt,
  };
}
