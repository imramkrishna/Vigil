"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ChatTurn, Mode } from "../types/vigil";

export interface ChatThread {
  id: string;
  title: string;
  mode: Mode;
  turns: ChatTurn[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_PREFIX = "vigil.chat.history.v1:";
const MAX_THREADS = 50;
const EMPTY_THREADS: ChatThread[] = [];

const listeners = new Set<() => void>();
const snapshotCache = new Map<string, { raw: string | null; parsed: ChatThread[] }>();

let storageBound = false;

function notifyAll() {
  listeners.forEach((fn) => fn());
}

function ensureStorageListener() {
  if (storageBound || typeof window === "undefined") return;
  storageBound = true;
  window.addEventListener("storage", (e) => {
    if (!e.key || e.key.startsWith(STORAGE_PREFIX)) {
      snapshotCache.clear();
      notifyAll();
    }
  });
}

function storageKeyFor(scope: string): string {
  return `${STORAGE_PREFIX}${scope || "default"}`;
}

function readThreads(scope: string): ChatThread[] {
  if (typeof window === "undefined") return EMPTY_THREADS;
  const key = storageKeyFor(scope);
  try {
    const raw = window.localStorage.getItem(key);
    const cached = snapshotCache.get(key);
    if (cached && cached.raw === raw) {
      return cached.parsed;
    }
    if (!raw) {
      snapshotCache.set(key, { raw: null, parsed: EMPTY_THREADS });
      return EMPTY_THREADS;
    }
    const parsed = JSON.parse(raw);
    const valid: ChatThread[] = Array.isArray(parsed)
      ? parsed
          .filter(
            (t): t is ChatThread =>
              Boolean(t) &&
              typeof t.id === "string" &&
              typeof t.title === "string" &&
              Array.isArray(t.turns)
          )
          .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      : EMPTY_THREADS;
    snapshotCache.set(key, { raw, parsed: valid });
    return valid;
  } catch {
    return EMPTY_THREADS;
  }
}

function writeThreads(scope: string, threads: ChatThread[]) {
  if (typeof window === "undefined") return;
  const key = storageKeyFor(scope);
  const trimmed = [...threads]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_THREADS);
  try {
    const raw = JSON.stringify(trimmed);
    window.localStorage.setItem(key, raw);
    snapshotCache.set(key, { raw, parsed: trimmed });
  } catch {
    try {
      const reduced = trimmed.slice(0, 15);
      const raw = JSON.stringify(reduced);
      window.localStorage.setItem(key, raw);
      snapshotCache.set(key, { raw, parsed: reduced });
    } catch {
      // Ignore storage failures in private browsing
    }
  }
  notifyAll();
}

export function deriveThreadTitle(turns: ChatTurn[]): string {
  const firstUser = turns.find((t) => t.role === "user")?.content?.trim();
  if (!firstUser) return "New chat";
  const singleLine = firstUser.replace(/\s+/g, " ");
  return singleLine.length > 64 ? `${singleLine.slice(0, 64)}…` : singleLine;
}

export function upsertChatThread(
  scope: string,
  params: {
    id: string;
    turns: ChatTurn[];
    mode: Mode;
    replacedId?: string;
  }
) {
  if (params.turns.length === 0) return;
  const existing = readThreads(scope);
  const now = Date.now();

  const matchId = params.replacedId ?? params.id;
  const prior =
    existing.find((t) => t.id === params.id) ??
    existing.find((t) => t.id === matchId);

  const filtered = existing.filter(
    (t) => t.id !== params.id && t.id !== matchId
  );

  const autoTitle = deriveThreadTitle(params.turns);
  const nextThread: ChatThread = {
    id: params.id,
    title: prior?.title || autoTitle,
    mode: params.mode,
    turns: params.turns,
    createdAt: prior?.createdAt ?? now,
    updatedAt: now,
  };

  writeThreads(scope, [nextThread, ...filtered]);
}

export function renameChatThread(scope: string, id: string, nextTitle: string) {
  const clean = nextTitle.trim();
  if (!clean) return;
  const existing = readThreads(scope);
  const updated = existing.map((t) =>
    t.id === id ? { ...t, title: clean } : t
  );
  writeThreads(scope, updated);
}

export function deleteChatThread(scope: string, id: string) {
  const existing = readThreads(scope);
  writeThreads(
    scope,
    existing.filter((t) => t.id !== id)
  );
}

export function clearChatThreads(scope: string) {
  writeThreads(scope, []);
}

export function useChatHistory(scope: string): ChatThread[] {
  const subscribe = useCallback((listener: () => void) => {
    ensureStorageListener();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const getSnapshot = useCallback(() => readThreads(scope), [scope]);
  const getServerSnapshot = useCallback(() => EMPTY_THREADS, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
