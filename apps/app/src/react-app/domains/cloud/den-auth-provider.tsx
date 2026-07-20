/** @jsxImportSource react */
import {
  createContext,
  use,
  useMemo,
  type ReactNode,
} from "react";

import {
  DenApiError,
  type DenUser,
} from "../../../app/lib/den";

export type DenAuthStatus =
  | "checking"
  | "signed_in"
  | "unavailable"
  | "signed_out";

export const DEN_AUTH_SIGNAL_RETRY_COOLDOWN_MS = 5_000;
export const DEN_AUTH_UNAVAILABLE_RETRY_INTERVAL_MS = 30_000;

export function resolveDenAuthFailureStatus(
  error: unknown,
): Extract<DenAuthStatus, "signed_out" | "unavailable"> {
  return error instanceof DenApiError && error.status === 401
    ? "signed_out"
    : "unavailable";
}

export function hasRetainedDenSession(status: DenAuthStatus): boolean {
  return status === "signed_in" || status === "unavailable";
}

export function shouldRetryDenAuthOnSignal(input: {
  status: DenAuthStatus;
  online: boolean;
  now: number;
  lastAttemptAt: number | null;
}): boolean {
  if (input.status !== "unavailable" || !input.online) return false;
  if (input.lastAttemptAt === null || input.now < input.lastAttemptAt) return true;
  return input.now - input.lastAttemptAt >= DEN_AUTH_SIGNAL_RETRY_COOLDOWN_MS;
}

export type DenAuthStore = {
  status: DenAuthStatus;
  user: DenUser | null;
  error: string | null;
  isSignedIn: boolean;
  refresh: () => Promise<void>;
};

const DenAuthContext = createContext<DenAuthStore | undefined>(undefined);

export function DenAuthProvider({ children }: { children: ReactNode }) {
  const value = useMemo<DenAuthStore>(() => ({
    status: "signed_out",
    user: null,
    error: null,
    isSignedIn: false,
    refresh: async () => undefined,
  }), []);

  return (
    <DenAuthContext.Provider value={value}>
      {children}
    </DenAuthContext.Provider>
  );
}

export function useDenAuth(): DenAuthStore {
  const context = use(DenAuthContext);
  if (!context) {
    throw new Error("useDenAuth must be used within DenAuthProvider");
  }
  return context;
}
