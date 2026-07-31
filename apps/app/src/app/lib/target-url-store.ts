/**
 * Target URL Store — manage saved target application URLs.
 * Persisted in localStorage under sprintnex.targetUrls.v1.
 */

import { useState, useEffect } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export type TargetUrlConfig = {
  id: string;
  name: string;
  url: string;
  createdAt: string;
};

// ── Store ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "sprintnex.targetUrls.v1";
const SELECTED_KEY = "sprintnex.targetUrlId";

let cache: TargetUrlConfig[] = [];
let listeners = new Set<() => void>();
let loaded = false;

function load(): void {
  if (loaded) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = raw ? JSON.parse(raw) : [];
  } catch {
    cache = [];
  }
  loaded = true;
}

function persist(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  emit();
}

function emit(): void {
  listeners.forEach((fn) => fn());
}

export function subscribeTargetUrls(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getTargetUrls(): TargetUrlConfig[] {
  load();
  return [...cache];
}

export function createTargetUrl(name: string, url: string): TargetUrlConfig {
  load();
  const entry: TargetUrlConfig = {
    id: crypto.randomUUID(),
    name,
    url,
    createdAt: new Date().toISOString(),
  };
  cache.push(entry);
  persist();
  return entry;
}

export function updateTargetUrl(
  id: string,
  updates: { name?: string; url?: string },
): TargetUrlConfig | undefined {
  load();
  const entry = cache.find((c) => c.id === id);
  if (!entry) return undefined;
  if (updates.name !== undefined) entry.name = updates.name;
  if (updates.url !== undefined) entry.url = updates.url;
  persist();
  return entry;
}

export function deleteTargetUrl(id: string): boolean {
  load();
  const idx = cache.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  cache.splice(idx, 1);
  if (localStorage.getItem(SELECTED_KEY) === id) {
    localStorage.removeItem(SELECTED_KEY);
    localStorage.removeItem("sprintnex.targetUrl");
  }
  persist();
  return true;
}

export function getSelectedTargetUrl(): TargetUrlConfig | undefined {
  load();
  const selectedId = localStorage.getItem(SELECTED_KEY);
  if (selectedId) {
    const found = cache.find((c) => c.id === selectedId);
    if (found) return found;
  }
  return cache[0];
}

export function selectTargetUrl(id: string): void {
  load();
  if (cache.find((c) => c.id === id)) {
    localStorage.setItem(SELECTED_KEY, id);
    const entry = cache.find((c) => c.id === id)!;
    localStorage.setItem("sprintnex.targetUrl", entry.url);
    emit();
  }
}

// ── React hooks ────────────────────────────────────────────────────────────

export function useTargetUrls(): TargetUrlConfig[] {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    load();
    setVersion((v) => v + 1);
    const unsub = subscribeTargetUrls(() => setVersion((v) => v + 1));
    return unsub;
  }, []);
  return getTargetUrls();
}

export function useSelectedTargetUrl(): TargetUrlConfig | undefined {
  const [snapshot, setSnapshot] = useState<TargetUrlConfig | undefined>(() =>
    getSelectedTargetUrl(),
  );
  useEffect(() => {
    load();
    setSnapshot(getSelectedTargetUrl());
    const unsub = subscribeTargetUrls(() =>
      setSnapshot(getSelectedTargetUrl()),
    );
    return unsub;
  }, []);
  return snapshot;
}
