/**
 * MCP URL Store — manage remote MCP browser server URLs.
 * Persisted in localStorage under sprintnex.mcpUrls.v1.
 */

import { useState, useEffect } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export type McpUrlConfig = {
  id: string;
  name: string;
  url: string;
  createdAt: string;
};

// ── Store ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "sprintnex.mcpUrls.v1";
const SELECTED_KEY = "sprintnex.mcpBrowserUrl";

let cache: McpUrlConfig[] = [];
let listeners = new Set<() => void>();
let loaded = false;

function load(): void {
  if (loaded) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = raw ? JSON.parse(raw) : getDefaults();
  } catch {
    cache = getDefaults();
  }
  loaded = true;
}

function getDefaults(): McpUrlConfig[] {
  return [
    {
      id: "local",
      name: "Local (localhost:8812)",
      url: "http://127.0.0.1:8812",
      createdAt: new Date().toISOString(),
    },
  ];
}

function persist(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  emit();
}

function emit(): void {
  listeners.forEach((fn) => fn());
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getMcpUrls(): McpUrlConfig[] {
  load();
  return [...cache];
}

export function getMcpUrlById(id: string): McpUrlConfig | undefined {
  load();
  return cache.find((c) => c.id === id);
}

export function createMcpUrl(name: string, url: string): McpUrlConfig {
  load();
  const entry: McpUrlConfig = {
    id: crypto.randomUUID(),
    name,
    url,
    createdAt: new Date().toISOString(),
  };
  cache.push(entry);
  persist();
  return entry;
}

export function updateMcpUrl(
  id: string,
  updates: { name?: string; url?: string },
): McpUrlConfig | undefined {
  load();
  const entry = cache.find((c) => c.id === id);
  if (!entry) return undefined;
  if (updates.name !== undefined) entry.name = updates.name;
  if (updates.url !== undefined) entry.url = updates.url;
  persist();
  return entry;
}

export function deleteMcpUrl(id: string): boolean {
  load();
  const idx = cache.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  cache.splice(idx, 1);
  // Clear selected if deleting active one
  if (localStorage.getItem(SELECTED_KEY) === id) {
    localStorage.removeItem(SELECTED_KEY);
  }
  persist();
  return true;
}

export function getSelectedMcpUrl(): McpUrlConfig | undefined {
  load();
  const selectedId = localStorage.getItem(SELECTED_KEY);
  if (selectedId) {
    const found = cache.find((c) => c.id === selectedId);
    if (found) return found;
  }
  // Default to first entry
  return cache[0];
}

export function selectMcpUrl(id: string): void {
  load();
  if (cache.find((c) => c.id === id)) {
    localStorage.setItem(SELECTED_KEY, id);
    // Also set the legacy key for ensureBrowserMcp to read
    const entry = cache.find((c) => c.id === id)!;
    if (entry.id === "local") {
      localStorage.removeItem("sprintnex.mcpBrowserUrl");
    } else {
      localStorage.setItem("sprintnex.mcpBrowserUrl", entry.url);
    }
    emit();
  }
}

// ── React hooks ────────────────────────────────────────────────────────────

export function useMcpUrls(): McpUrlConfig[] {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    load();
    setVersion((v) => v + 1);
    const unsub = subscribe(() => setVersion((v) => v + 1));
    return unsub;
  }, []);
  return getMcpUrls();
}

export function useSelectedMcpUrl(): McpUrlConfig | undefined {
  const [snapshot, setSnapshot] = useState<McpUrlConfig | undefined>(() =>
    getSelectedMcpUrl(),
  );
  useEffect(() => {
    load();
    setSnapshot(getSelectedMcpUrl());
    const unsub = subscribe(() => setSnapshot(getSelectedMcpUrl()));
    return unsub;
  }, []);
  return snapshot;
}
