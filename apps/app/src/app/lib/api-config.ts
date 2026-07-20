/**
 * Single source of truth for the Sprintnex API root URL.
 *
 * All API clients must import from here — never hardcode the URL elsewhere.
 *
 * Resolution priority:
 *  1. VITE_API_URL env var (set at build/dev time)
 *  2. DEFAULT_API_ROOT (production)
 */

export const DEFAULT_API_ROOT = "https://platform.sprintnex.com/api";

export function normalizeApiRoot(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_API_ROOT;
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

export const API_ROOT: string =
  typeof import.meta.env?.VITE_API_URL === "string" &&
  import.meta.env.VITE_API_URL.trim()
    ? normalizeApiRoot(import.meta.env.VITE_API_URL)
    : DEFAULT_API_ROOT;

export const AICOE_BASE = `${API_ROOT}/aicoe`;

export const AUTH_BASE = `${API_ROOT}/aicoe/auth`;
