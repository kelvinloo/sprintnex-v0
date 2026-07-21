/** @jsxImportSource react */
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, LockKeyhole, Workflow } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
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

  // Dismiss the full-screen boot overlay so it stops blocking form clicks
  useEffect(() => {
    markRouteReady();
  }, [markRouteReady]);

  useEffect(() => {
    if (auth.isSignedIn) {
      navigate(redirectPath, { replace: true });
    }
  }, [auth.isSignedIn, navigate, redirectPath]);

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
                  Continue into your local execution workspace and task runs.
                </p>
              </div>
            </div>

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
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  placeholder="Enter your password"
                  type="password"
                  value={password}
                />
              </label>

              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-[#d0d5dd]" />
                <span className="text-xs text-[#98a2b3]">
                  Organization Access
                </span>
                <div className="h-px flex-1 bg-[#d0d5dd]" />
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-[#344054]">
                  Organization Code
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
                <span className="block text-xs leading-5 text-[#667085]">
                  Required for team members. Leave empty for platform admin.
                </span>
              </label>

              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <Button
                className="h-11 w-full rounded-xl"
                disabled={busy}
                type="submit"
              >
                {busy ? "Signing in" : "Sign in"}
                <ArrowRight size={15} />
              </Button>
            </form>

            <p className="mt-4 text-xs leading-5 text-[#667085]">
              Admin: admin@aicoe.test / leave org code empty
            </p>
          </div>

          <div className="text-xs text-[#98a2b3]">
            Sprintnex local development
          </div>
        </section>

        <section className="hidden min-h-screen bg-[#111827] p-8 text-white lg:block">
          <div className="flex h-full flex-col justify-between rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,#172033,#0b1220)] p-10 shadow-2xl">
            <div className="max-w-xl">
              <div className="mb-5 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                Prompt to production execution
              </div>
              <h2 className="text-4xl font-semibold tracking-tight">
                Run structured tasks without losing control of the workflow.
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-6 text-white/65">
                Sprintnex keeps the workspace, skills, MCP rules, artifacts, and
                verification steps visible while the engine executes.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                ["Task Intake", "Title, scope, system prompt, workspace"],
                ["Execution", "Strict runtime with visible runs"],
                ["Evidence", "Artifacts, commands, and verification"],
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
