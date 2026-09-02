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
import { openDesktopUrl } from "../../../app/lib/desktop";
import { isDesktopRuntime } from "../../../app/lib/runtime-env";

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

type OrganizationAuthResolution = {
  organizationId: string;
  organizationCode: string;
  organizationName: string;
  authMode: "LOCAL" | "SSO" | "HYBRID";
  localLoginAllowed: boolean;
  ssoLoginAllowed: boolean;
};

type SsoOrganization = {
  organizationId: string;
  organizationName: string;
  organizationCode: string;
  role: string;
};

type SsoResolution =
  | { status: "OWNER"; login: SprintnexLoginResponse }
  | { status: "ORG_USER"; organizations: SsoOrganization[] }
  | { status: "NEW" };

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
  startSso: (input: {
    email: string;
    organizationCode?: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  consumeSsoTicketFromUrl: () => string | null;
  resolveSsoTicket: (ticket: string) => Promise<SsoResolution>;
  selectSsoOrganization: (
    ticket: string,
    organizationId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  persistSsoLogin: (login: SprintnexLoginResponse) => void;
  signOut: () => Promise<void>;
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

function buildSprintnexSsoRedirectUrl(input: {
  email: string;
  organizationCode?: string;
  returnTo: string;
}): string {
  const url = new URL(
    `${sprintnexAuthBase()}/sso/redirect`,
    window.location.origin,
  );
  url.searchParams.set("email", input.email.trim().toLowerCase());
  url.searchParams.set("returnTo", input.returnTo);
  if (input.organizationCode?.trim()) {
    url.searchParams.set(
      "organizationCode",
      input.organizationCode.trim().toLowerCase(),
    );
  }
  return url.toString();
}

function consumeSsoCallbackFromUrl(): SprintnexUser | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const accessToken = url.searchParams.get("auth_token");
  if (!accessToken) {
    return null;
  }

  const refreshToken = url.searchParams.get("refresh_token") || "";
  const expiresIn = Number(url.searchParams.get("expires_in") || "900");
  const tenantId = url.searchParams.get("tenant_id") || "default";
  const userId = url.searchParams.get("user_id") || "";
  const email = url.searchParams.get("email") || "";
  const displayName = url.searchParams.get("display_name") || email;
  const organizationId = url.searchParams.get("organization_id");
  const organizationCode =
    url.searchParams.get("organization_code") || undefined;

  window.localStorage.setItem("auth_token", accessToken);
  window.localStorage.setItem("accessToken", accessToken);
  if (refreshToken) window.localStorage.setItem("refresh_token", refreshToken);
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

  [
    "auth_token",
    "refresh_token",
    "expires_in",
    "tenant_id",
    "user_id",
    "email",
    "display_name",
    "organization_id",
    "organization_code",
  ].forEach((key) => url.searchParams.delete(key));
  window.history.replaceState({}, document.title, url.toString());

  return {
    id: userId || email,
    email,
    name: displayName || displayNameFromEmail(email),
    tenantId,
    organizationId: organizationId || null,
    organizationCode,
    signedInAt: new Date().toISOString(),
  };
}

export function SprintnexAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SprintnexUser | null>(
    () => consumeSsoCallbackFromUrl() || readStoredUser(),
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
      let resolvedOrg: OrganizationAuthResolution | null = null;
      if (normalizedOrganizationCode) {
        const resolveResponse = await fetch(
          `${sprintnexAuthBase()}/organization/resolve`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Tenant-Id": "default",
            },
            body: JSON.stringify({
              organizationCode: normalizedOrganizationCode,
            }),
          },
        );
        if (!resolveResponse.ok) {
          const message = await resolveResponse.text();
          return { ok: false, error: message || "Organization lookup failed." };
        }
        resolvedOrg =
          (await resolveResponse.json()) as OrganizationAuthResolution;
      }

      if (resolvedOrg?.authMode === "SSO") {
        window.location.assign(
          buildSprintnexSsoRedirectUrl({
            email: normalizedEmail,
            organizationCode: normalizedOrganizationCode,
            returnTo: `${window.location.pathname}${window.location.search}`,
          }),
        );
        return { ok: true };
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

  const startSso = useCallback<SprintnexAuthStore["startSso"]>(async () => {
    // Global SSO — identity comes from the IdP, so no email/org code is
    // needed upfront. Organization resolution happens after auth via the
    // ticket flow (owner → dashboard, org user → picker, new → web portal).
    const url = new URL(
      `${sprintnexAuthBase()}/sso/redirect`,
      window.location.origin,
    );
    const desktop = isDesktopRuntime();
    // On desktop, the SSO callback returns to the app via the openwork://
    // deep link (opened in the system browser). On web it returns to the
    // login route where the ticket is read from the URL.
    const returnTo = desktop
      ? "openwork://auth/callback"
      : `${window.location.origin}${window.location.pathname}${window.location.search}`;
    url.searchParams.set("returnTo", returnTo);
    if (desktop) {
      await openDesktopUrl(url.toString());
    } else {
      window.location.assign(url.toString());
    }
    return { ok: true };
  }, []);

  /** Read and strip the sso_ticket from the URL. */
  const consumeSsoTicketFromUrl = useCallback((): string | null => {
    if (typeof window === "undefined") return null;
    const url = new URL(window.location.href);
    const ticket = url.searchParams.get("sso_ticket");
    if (!ticket) return null;
    url.searchParams.delete("sso_ticket");
    window.history.replaceState({}, document.title, url.toString());
    return ticket;
  }, []);

  /** Resolve the identity behind an SSO ticket into OWNER / ORG_USER / NEW. */
  const resolveSsoTicket = useCallback(
    async (ticket: string): Promise<SsoResolution> => {
      const response = await fetch(`${sprintnexAuthBase()}/sso/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": "default",
        },
        body: JSON.stringify({ ticket }),
      });
      const text = await response.text();
      const data = text
        ? (JSON.parse(text) as SsoResolution & { message?: string })
        : {};
      if (!response.ok) {
        throw new Error(
          typeof data.message === "string" && data.message.trim()
            ? data.message
            : `SSO resolution failed: ${response.status}`,
        );
      }
      return data as SsoResolution;
    },
    [],
  );

  /** Persist a successful SSO login (tokens + user) and sign the user in. */
  const persistSsoLogin = useCallback((login: SprintnexLoginResponse): void => {
    const accessToken = login.accessToken || login.token || "";
    const refreshToken = login.refreshToken || "";
    const expiresIn =
      typeof login.expiresIn === "number" ? login.expiresIn : 900;
    const backendUser = login.user ?? {};
    const userId = backendUser.id || "";
    const email = backendUser.email || "";
    const tenantId = backendUser.tenantId || "default";
    const organizationId = backendUser.organizationId || null;

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
      id: userId || email,
      email,
      name:
        backendUser.displayName ||
        backendUser.username ||
        displayNameFromEmail(email),
      tenantId,
      organizationId,
      signedInAt: new Date().toISOString(),
    });
  }, []);

  /** Complete SSO login for an organization user into a chosen organization. */
  const selectSsoOrganization = useCallback(
    async (
      ticket: string,
      organizationId: string,
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      try {
        const response = await fetch(
          `${sprintnexAuthBase()}/sso/select-organization`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Tenant-Id": "default",
            },
            body: JSON.stringify({ ticket, organizationId }),
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
                : `Selection failed: ${response.status}`,
          };
        }
        persistSsoLogin(data);
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Unable to complete SSO sign-in",
        };
      }
    },
    [persistSsoLogin],
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

  const clearLocalSession = useCallback(() => {
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

  /** Clear the local session and terminate the IdP (SSO) session as well, so
   *  the next sign-in is not silently re-authenticated with the same account. */
  const signOut = useCallback(async (): Promise<void> => {
    const refreshToken =
      typeof window !== "undefined"
        ? window.localStorage.getItem("refresh_token") || undefined
        : undefined;
    // Clear the local session immediately — never blocked on the network.
    clearLocalSession();
    // Best-effort: revoke the IdP refresh token and end the IdP session.
    try {
      const response = await fetch(`${sprintnexAuthBase()}/sso/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": "default",
        },
        body: JSON.stringify({
          refreshToken,
          redirect:
            typeof window !== "undefined"
              ? `${window.location.origin}/login`
              : undefined,
        }),
      });
      const text = await response.text();
      const data = text
        ? (JSON.parse(text) as { endSessionUrl?: string })
        : {};
      const endSessionUrl = data?.endSessionUrl;
      if (endSessionUrl) {
        if (isDesktopRuntime()) {
          await openDesktopUrl(endSessionUrl);
        } else {
          window.location.assign(endSessionUrl);
        }
      }
    } catch (error) {
      // Local session is already cleared; IdP termination is best-effort.
      console.warn("IdP SSO logout failed", error);
    }
  }, [clearLocalSession]);

  const value = useMemo<SprintnexAuthStore>(
    () => ({
      user,
      isSignedIn: Boolean(user),
      signIn,
      startSso,
      consumeSsoTicketFromUrl,
      resolveSsoTicket,
      selectSsoOrganization,
      persistSsoLogin,
      signOut,
      getValidToken,
    }),
    [
      consumeSsoTicketFromUrl,
      getValidToken,
      persistSsoLogin,
      resolveSsoTicket,
      selectSsoOrganization,
      signIn,
      signOut,
      startSso,
      user,
    ],
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
