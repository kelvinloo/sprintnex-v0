/** @jsxImportSource react */
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { AUTH_BASE } from "../../../app/lib/api-config";

const STORAGE_KEY = "sprintnex.auth.session";

type SprintnexLoginResponse = {
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  user?: {
    id?: string;
    email?: string;
    displayName?: string;
    username?: string;
    tenantId?: string;
    organizationId?: string | null;
    teamSpaceId?: string | null;
  };
};

export type SprintnexUser = {
  id: string;
  email: string;
  name: string;
  tenantId?: string;
  organizationId?: string | null;
  organizationCode?: string;
  signedInAt: string;
};

export type SprintnexAuthStore = {
  user: SprintnexUser | null;
  isSignedIn: boolean;
  signIn: (input: {
    email: string;
    organizationCode?: string;
    password: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  signOut: () => void;
  /** Returns a valid access token, refreshing if expired. Throws if refresh fails. */
  getValidToken: () => Promise<string>;
};

const SprintnexAuthContext = createContext<SprintnexAuthStore | undefined>(
  undefined,
);

function readStoredUser(): SprintnexUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SprintnexUser>;
    if (!parsed.email || typeof parsed.email !== "string") return null;
    const email = parsed.email.trim().toLowerCase();
    return {
      id:
        typeof parsed.id === "string" && parsed.id.trim()
          ? parsed.id.trim()
          : email,
      email,
      name:
        typeof parsed.name === "string" && parsed.name.trim()
          ? parsed.name
          : email.split("@")[0] || "Sprintnex User",
      tenantId:
        typeof parsed.tenantId === "string" && parsed.tenantId.trim()
          ? parsed.tenantId.trim()
          : undefined,
      organizationId:
        typeof parsed.organizationId === "string" &&
        parsed.organizationId.trim()
          ? parsed.organizationId.trim()
          : typeof parsed.organizationCode === "string" &&
              parsed.organizationCode.trim()
            ? parsed.organizationCode.trim()
            : null,
      organizationCode:
        typeof parsed.organizationCode === "string" &&
        parsed.organizationCode.trim()
          ? parsed.organizationCode.trim()
          : undefined,
      signedInAt:
        typeof parsed.signedInAt === "string"
          ? parsed.signedInAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function writeStoredUser(user: SprintnexUser | null) {
  if (typeof window === "undefined") return;
  if (!user) {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem("userId");
    window.localStorage.removeItem("auth_token");
    window.localStorage.removeItem("accessToken");
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  window.localStorage.setItem("userId", user.id);
  if (user.tenantId) window.localStorage.setItem("tenantId", user.tenantId);
  if (user.organizationId) {
    window.localStorage.setItem("organization_id", user.organizationId);
    window.localStorage.setItem(
      "selected_organization_id",
      user.organizationId,
    );
  }
}

function displayNameFromEmail(email: string) {
  const local = email.split("@")[0]?.trim();
  if (!local) return "Sprintnex User";
  return (
    local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || "Sprintnex User"
  );
}

function sprintnexAuthBase(): string {
  return AUTH_BASE;
}

export function SprintnexAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SprintnexUser | null>(() =>
    readStoredUser(),
  );

  useEffect(() => {
    writeStoredUser(user);
  }, [user]);

  const signIn = useCallback<SprintnexAuthStore["signIn"]>(
    async ({ email, organizationCode, password }) => {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedOrganizationCode = organizationCode?.trim() || undefined;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return { ok: false, error: "Enter a valid work email." };
      }
      if (
        normalizedOrganizationCode &&
        !/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(normalizedOrganizationCode)
      ) {
        return { ok: false, error: "Enter a valid organization code." };
      }
      if (password.length < 8) {
        return { ok: false, error: "Use at least 8 characters." };
      }

      const response = await fetch(
        `${sprintnexAuthBase()}${normalizedOrganizationCode ? "/login/organization" : "/login"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Tenant-Id": "default",
          },
          body: JSON.stringify({
            email: normalizedEmail,
            password,
            ...(normalizedOrganizationCode
              ? { organizationCode: normalizedOrganizationCode }
              : {}),
          }),
        },
      );
      const text = await response.text();
      const data = text
        ? (JSON.parse(text) as SprintnexLoginResponse & { message?: string })
        : {};
      if (!response.ok) {
        return {
          ok: false,
          error:
            typeof data.message === "string" && data.message.trim()
              ? data.message
              : `Sign in failed: ${response.status}`,
        };
      }

      const accessToken = data.accessToken || data.token || "";
      if (!accessToken) {
        return { ok: false, error: "Sign in did not return an access token." };
      }
      const refreshToken = data.refreshToken || "";
      const expiresIn =
        typeof data.expiresIn === "number" ? data.expiresIn : 24 * 60 * 60;
      const backendUser = data.user ?? {};
      const userId =
        backendUser.id ||
        window.localStorage.getItem("userId")?.trim() ||
        normalizedEmail;
      const tenantId = backendUser.tenantId || "default";
      const organizationId =
        backendUser.organizationId || normalizedOrganizationCode || null;

      window.localStorage.setItem("auth_token", accessToken);
      window.localStorage.setItem("accessToken", accessToken);
      if (refreshToken)
        window.localStorage.setItem("refresh_token", refreshToken);
      window.localStorage.setItem(
        "token_expiry",
        String(Date.now() + expiresIn * 1000),
      );
      window.localStorage.setItem("tenantId", tenantId);
      window.localStorage.setItem("userId", userId);
      if (organizationId) {
        window.localStorage.setItem("organization_id", organizationId);
        window.localStorage.setItem("selected_organization_id", organizationId);
      }

      setUser({
        id: userId,
        email: backendUser.email || normalizedEmail,
        name:
          backendUser.displayName ||
          backendUser.username ||
          displayNameFromEmail(normalizedEmail),
        tenantId,
        organizationId,
        ...(normalizedOrganizationCode
          ? { organizationCode: normalizedOrganizationCode }
          : {}),
        signedInAt: new Date().toISOString(),
      });
      return { ok: true };
    },
    [],
  );

  /** Attempt to refresh the access token using the stored refresh token. */
  const refreshAccessToken = useCallback(async (): Promise<string> => {
    const currentRefreshToken = window.localStorage.getItem("refresh_token");
    if (!currentRefreshToken) throw new Error("No refresh token available");

    const response = await fetch(`${sprintnexAuthBase()}/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-Id": "default" },
      body: JSON.stringify({ refreshToken: currentRefreshToken }),
    });
    if (!response.ok)
      throw new Error(`Token refresh failed: ${response.status}`);

    const data = JSON.parse(await response.text()) as SprintnexLoginResponse;
    const newAccessToken = data.accessToken || data.token || "";
    if (!newAccessToken) throw new Error("Refresh did not return a token");

    const newRefreshToken = data.refreshToken || currentRefreshToken;
    const expiresIn =
      typeof data.expiresIn === "number" ? data.expiresIn : 24 * 60 * 60;

    window.localStorage.setItem("auth_token", newAccessToken);
    window.localStorage.setItem("accessToken", newAccessToken);
    window.localStorage.setItem("refresh_token", newRefreshToken);
    window.localStorage.setItem(
      "token_expiry",
      String(Date.now() + expiresIn * 1000),
    );
    return newAccessToken;
  }, []);

  /** Returns a valid token, refreshing if the current one is expired. */
  const getValidToken = useCallback(async (): Promise<string> => {
    const token =
      window.localStorage.getItem("auth_token") ||
      window.localStorage.getItem("accessToken") ||
      "";
    if (!token) throw new Error("No access token");

    const expiry = window.localStorage.getItem("token_expiry");
    // Refresh if expired or within 5 minutes of expiry
    if (expiry && Date.now() > Number(expiry) - 5 * 60 * 1000) {
      try {
        return await refreshAccessToken();
      } catch {
        // Refresh failed — return the current token anyway; the API call will 401
        return token;
      }
    }
    return token;
  }, [refreshAccessToken]);

  const signOut = useCallback(() => {
    setUser(null);
    if (typeof window === "undefined") return;
    const keys = [
      STORAGE_KEY,
      "userId",
      "auth_token",
      "accessToken",
      "refresh_token",
      "token_expiry",
      "tenantId",
      "organization_id",
      "selected_organization_id",
    ];
    keys.forEach((k) => window.localStorage.removeItem(k));
  }, []);

  const value = useMemo<SprintnexAuthStore>(
    () => ({
      user,
      isSignedIn: Boolean(user),
      signIn,
      signOut,
      getValidToken,
    }),
    [getValidToken, signIn, signOut, user],
  );

  return (
    <SprintnexAuthContext.Provider value={value}>
      {children}
    </SprintnexAuthContext.Provider>
  );
}

export function useSprintnexAuth(): SprintnexAuthStore {
  const context = use(SprintnexAuthContext);
  if (!context) {
    throw new Error(
      "useSprintnexAuth must be used within SprintnexAuthProvider",
    );
  }
  return context;
}
