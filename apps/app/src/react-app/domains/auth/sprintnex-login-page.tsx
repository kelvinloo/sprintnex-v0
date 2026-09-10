/** @jsxImportSource react */
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, LockKeyhole, Workflow } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { SPRINTNEX_PORTAL_URL } from "../../../app/lib/api-config";
import {
  openDesktopUrl,
  subscribeDesktopDeepLinks,
} from "../../../app/lib/desktop";
import { isDesktopRuntime } from "../../../app/lib/runtime-env";
import { useSprintnexAuth } from "./sprintnex-auth-provider";
import { useBootState } from "../../shell/boot-state";

type LocationState = {
  from?: {
    pathname?: string;
    search?: string;
    hash?: string;
  };
};

export function SprintnexLoginPage() {
  const { markRouteReady } = useBootState();
  const auth = useSprintnexAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;
  const redirectPath = `${state?.from?.pathname || "/session"}${state?.from?.search || ""}${state?.from?.hash || ""}`;

  const [organizationCode, setOrganizationCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // SSO ticket resolution state
  const [ssoPhase, setSsoPhase] = useState<"idle" | "resolving" | "org-select">(
    "idle",
  );
  const [ssoError, setSsoError] = useState<string | null>(null);
  const [ssoTicket, setSsoTicket] = useState<string | null>(null);
  const [ssoOrganizations, setSsoOrganizations] = useState<
    Array<{
      organizationId: string;
      organizationName: string;
      organizationCode: string;
      role: string;
    }>
  >([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>();
  const ssoResolvedRef = useRef(false);

  // Resolve a ticket once (guard handles StrictMode double-invocation).
  const handleSsoTicket = useCallback(
    (ticket: string) => {
      if (ssoResolvedRef.current) return;
      ssoResolvedRef.current = true;
      setSsoPhase("resolving");
      setSsoError(null);

      auth
        .resolveSsoTicket(ticket)
        .then((resolution) => {
          if (resolution.status === "OWNER") {
            auth.persistSsoLogin(resolution.login);
            // isSignedIn flips true → the existing redirect effect navigates.
          } else if (resolution.status === "ORG_USER") {
            setSsoTicket(ticket);
            setSsoOrganizations(resolution.organizations);
            setSsoPhase("org-select");
          } else {
            // NEW identity → send to the web portal for plan selection/checkout.
            const portalUrl = `${SPRINTNEX_PORTAL_URL}/signup?sso_ticket=${encodeURIComponent(ticket)}`;
            if (isDesktopRuntime()) {
              void openDesktopUrl(portalUrl);
            } else {
              window.location.assign(portalUrl);
            }
          }
        })
        .catch((err) => {
          setSsoError(
            err instanceof Error
              ? err.message
              : "Unable to complete SSO sign-in",
          );
          setSsoPhase("idle");
        });
    },
    [auth],
  );

  // Web: the IdP callback returns to the login route with ?sso_ticket=...
  useEffect(() => {
    const ticket = auth.consumeSsoTicketFromUrl();
    if (ticket) handleSsoTicket(ticket);
  }, [auth, handleSsoTicket]);

  // Desktop: the IdP callback returns via the openwork:// deep link.
  useEffect(() => {
    if (!isDesktopRuntime()) return;
    let unsub: (() => void) | undefined;
    void subscribeDesktopDeepLinks((urls) => {
      for (const raw of urls) {
        if (
          raw.startsWith("openwork://auth/callback") ||
          raw.startsWith("openwork-dev://auth/callback")
        ) {
          try {
            const parsed = new URL(raw);
            const ticket = parsed.searchParams.get("sso_ticket");
            if (ticket) handleSsoTicket(ticket);
          } catch {
            // ignore malformed deep links
          }
        }
      }
    }).then((fn) => {
      unsub = fn;
    });
    return () => {
      unsub?.();
    };
  }, [auth, handleSsoTicket]);

  // Dismiss the full-screen boot overlay so it stops blocking form clicks
  useEffect(() => {
    markRouteReady();
  }, [markRouteReady]);

  useEffect(() => {
    if (auth.isSignedIn) {
      navigate(redirectPath, { replace: true });
    }
  }, [auth.isSignedIn, navigate, redirectPath]);

  async function handleSso(event: FormEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      const result = await auth.startSso({ email: "" });
      if (!result.ok) {
        setError(result.error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      const result = await auth.signIn({ email, organizationCode, password });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      navigate(redirectPath, { replace: true });
    } finally {
      setBusy(false);
    }
  }

  async function handleSsoOrgSelect() {
    if (!ssoTicket || !selectedOrgId) return;
    setSsoError(null);
    const result = await auth.selectSsoOrganization(ssoTicket, selectedOrgId);
    if (!result.ok) {
      setSsoError(result.error);
      return;
    }
    // isSignedIn flips true → the existing redirect effect navigates.
  }

  function resetSso() {
    setSsoPhase("idle");
    setSsoError(null);
    setSsoTicket(null);
    setSsoOrganizations([]);
    setSelectedOrgId(undefined);
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-[#101828]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="flex min-h-screen flex-col justify-between px-6 py-8 sm:px-10 lg:px-14">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#111827] text-white">
              <Workflow size={20} />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide">
                Sprintnex
              </div>
              <div className="text-xs text-[#667085]">Execution Workbench</div>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
            <div className="mb-8 space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d0d5dd] bg-white px-3 py-1 text-xs font-medium text-[#475467] shadow-sm">
                <LockKeyhole size={13} />
                Workspace access
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-[#101828]">
                  Sign in to Sprintnex
                </h1>
                <p className="mt-2 text-sm leading-6 text-[#667085]">
                  Sign in with local credentials, or use Sprintnex SSO for your
                  organization.
                </p>
              </div>
            </div>

            {ssoPhase === "org-select" ? (
              <div className="space-y-4">
                <span className="block text-sm font-medium text-[#344054]">
                  Choose organization
                </span>
                <select
                  className="h-11 w-full rounded-lg border border-[#d0d5dd] bg-white px-3 py-1 text-[#101828] outline-none focus:border-[#111827] focus:ring-2 focus:ring-[#111827]/20"
                  onChange={(event) =>
                    setSelectedOrgId(event.currentTarget.value || undefined)
                  }
                  value={selectedOrgId ?? ""}
                >
                  <option value="">Select an organization</option>
                  {ssoOrganizations.map((org) => (
                    <option key={org.organizationId} value={org.organizationId}>
                      {org.organizationName}
                      {org.role === "OWNER" ? " (owner)" : ""}
                    </option>
                  ))}
                </select>
                <span className="block text-xs leading-5 text-[#667085]">
                  Your account belongs to more than one organization. Choose one
                  to continue.
                </span>
                {ssoError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {ssoError}
                  </div>
                ) : null}
                <Button
                  className="h-11 w-full rounded-xl"
                  disabled={!selectedOrgId}
                  onClick={() => void handleSsoOrgSelect()}
                >
                  Continue <ArrowRight size={15} />
                </Button>
                <Button
                  className="h-11 w-full rounded-xl"
                  onClick={resetSso}
                  type="button"
                  variant="outline"
                >
                  Use a different sign-in method
                </Button>
              </div>
            ) : ssoPhase === "resolving" ? (
              <div className="space-y-4 py-10 text-center text-sm text-[#667085]">
                Completing SSO sign-in...
              </div>
            ) : (
              <div className="space-y-4">
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-[#344054]">
                      Email
                    </span>
                    <input
                      autoComplete="email"
                      autoFocus
                      className="h-11 w-full rounded-lg border border-[#d0d5dd] bg-white px-3 py-1 text-[#101828] outline-none focus:border-[#111827] focus:ring-2 focus:ring-[#111827]/20"
                      inputMode="email"
                      onChange={(event) => setEmail(event.currentTarget.value)}
                      placeholder="Enter your email"
                      type="email"
                      value={email}
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-[#344054]">
                      Password
                    </span>
                    <input
                      autoComplete="current-password"
                      className="h-11 w-full rounded-lg border border-[#d0d5dd] bg-white px-3 py-1 text-[#101828] outline-none focus:border-[#111827] focus:ring-2 focus:ring-[#111827]/20"
                      onChange={(event) =>
                        setPassword(event.currentTarget.value)
                      }
                      placeholder="Enter your password"
                      type="password"
                      value={password}
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-[#344054]">
                      Organization code{" "}
                      <span className="font-normal text-[#667085]">
                        (optional)
                      </span>
                    </span>
                    <input
                      autoCapitalize="characters"
                      autoComplete="organization"
                      className="h-11 w-full rounded-lg border border-[#d0d5dd] bg-white px-3 py-1 text-[#101828] outline-none focus:border-[#111827] focus:ring-2 focus:ring-[#111827]/20"
                      onChange={(event) =>
                        setOrganizationCode(event.currentTarget.value)
                      }
                      placeholder="e.g. default"
                      value={organizationCode}
                    />
                  </label>

                  <Button
                    className="h-11 w-full rounded-xl"
                    disabled={busy}
                    type="submit"
                  >
                    {busy ? "Signing in" : "Sign in"}
                    <ArrowRight size={15} />
                  </Button>
                </form>

                <div className="flex items-center gap-3 py-1">
                  <div className="h-px flex-1 bg-[#d0d5dd]" />
                  <span className="text-xs text-[#98a2b3]">or</span>
                  <div className="h-px flex-1 bg-[#d0d5dd]" />
                </div>

                {error ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}
                <Button
                  className="h-11 w-full rounded-xl"
                  disabled={busy}
                  type="button"
                  onClick={handleSso}
                  variant="outline"
                >
                  {busy
                    ? "Signing in with Sprintnex SSO"
                    : "Continue with Sprintnex SSO"}
                  <ArrowRight size={15} />
                </Button>
              </div>
            )}
          </div>

          <div className="text-xs text-[#98a2b3]">Sprintnex Development</div>
        </section>

        <section className="hidden min-h-screen bg-[#111827] p-8 text-white lg:block">
          <div className="flex h-full flex-col justify-between rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#172033,#0b1220)] p-10 shadow-2xl">
            <div className="max-w-xl">
              <div className="mb-5 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                Governed AI delivery
              </div>
              <h2 className="text-4xl font-semibold tracking-tight">
                Turn approved work into controlled agent execution.
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-6 text-white/65">
                Sprintnex keeps scope, workspace context, MCP access, artifacts,
                and verification visible from intake through delivery.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                ["Intake", "Scope, owner, workspace, and acceptance criteria"],
                ["Execution", "Agent runs with governed tools and rules"],
                ["Verification", "Artifacts, commands, results, and evidence"],
              ].map(([title, body]) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"
                >
                  <div className="text-sm font-medium">{title}</div>
                  <div className="mt-2 text-xs leading-5 text-white/55">
                    {body}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
