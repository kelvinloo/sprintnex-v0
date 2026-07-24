/** @jsxImportSource react */

import { useEffect, useMemo, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { captureAnalyticsEvent, initAnalytics } from "../../app/lib/analytics";
import { evalRelaunchDesktopApp } from "../../app/lib/desktop";
import { SprintnexLoginPage } from "../domains/auth/sprintnex-login-page";
import { SprintnexMappingPage } from "../domains/sprintnex/sprintnex-mapping-page";
import { SprintnexTasksPage } from "../domains/sprintnex/sprintnex-tasks-page";
import { SprintnexKnowledgePage } from "../domains/sprintnex/sprintnex-knowledge";
import { SprintnexKnowledgeDetailPage } from "../domains/sprintnex/sprintnex-knowledge-detail";
import { SprintnexSkillsPage } from "../domains/sprintnex/sprintnex-skills-page";
import { SprintnexSkillDetailPage } from "../domains/sprintnex/sprintnex-skill-detail";
import { SprintnexSkillEditPage } from "../domains/sprintnex/sprintnex-skill-edit";
import { SprintnexMarketplacePage } from "../domains/sprintnex/sprintnex-skill-marketplace";
import { SprintnexActiveSkillsPage } from "../domains/sprintnex/sprintnex-active-skills";
import { useSprintnexAuth } from "../domains/auth/sprintnex-auth-provider";
import { NewProvidersListener } from "./new-providers-listener";
import { useDesktopFontZoomBehavior } from "./font-zoom";
import { LoadingOverlay } from "./loading-overlay";
import { DevProfiler, DevProfilerOverlay } from "./dev-profiler";
import { ReactRenderWatchdogOverlay } from "./react-render-watchdog-overlay";
import { AppMenuProvider } from "./app-menu";
import {
  OpenworkControlProvider,
  OpenworkRouteControlActions,
  useControlAction,
  type OpenworkControlAction,
} from "./control/control-provider";
import { SessionRoute } from "./session-route";
import { SettingsRoute } from "./settings-route";
import { ShellConfigProvider } from "./shell-config";
import { WelcomeRoute } from "./welcome-route";

type SprintnexAuthGateProps = {
  children: ReactNode;
};

function SprintnexAuthGate({ children }: SprintnexAuthGateProps) {
  const auth = useSprintnexAuth();
  const location = useLocation();

  if (!auth.isSignedIn) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

/**
 * Control action for eval automation: inject brand theme (logo, icon, accent color)
 * via the dev-only desktop config bridge. Placed inside OpenworkControlProvider.
 */
function BrandThemeControlActions() {
  const applyAction = useMemo<OpenworkControlAction | null>(() => {
    if (!import.meta.env.DEV) return null;
    return {
      id: "eval.brand_theme.apply",
      label: "Apply brand theme override",
      description:
        "Inject brand theme (logo, icon, accent color) via desktop config for eval testing.",
      sideEffect: "mutation",
      args: [
        { name: "brandLogoUrl", type: "string", description: "Logo URL" },
        { name: "brandIconUrl", type: "string", description: "Icon URL" },
        {
          name: "brandAccentColor",
          type: "string",
          description: "Radix color family",
        },
      ],
      execute: (args) => {
        const bridge = (window as unknown as Record<string, unknown>)
          .__openworkApplyDesktopConfig;
        if (typeof bridge !== "function") {
          return {
            ok: false,
            error: "Desktop config bridge not available (dev mode only).",
          };
        }
        bridge(args);
        return { applied: args };
      },
    };
  }, []);
  useControlAction(applyAction);

  const relaunchAction = useMemo<OpenworkControlAction | null>(() => {
    if (!import.meta.env.DEV) return null;
    return {
      id: "eval.app.relaunch",
      label: "Relaunch app for eval",
      description: "Dev-only eval hook that relaunches the Electron app.",
      sideEffect: "mutation",
      execute: () => evalRelaunchDesktopApp(),
    };
  }, []);
  useControlAction(relaunchAction);

  return null;
}

let appOpenedCaptured = false;

export function AppRoot() {
  useDesktopFontZoomBehavior();

  // Module-level dedupe keeps StrictMode double-mounts from double-counting.
  useEffect(() => {
    if (appOpenedCaptured) return;
    appOpenedCaptured = true;
    initAnalytics();
    captureAnalyticsEvent("app_opened", {});
  }, []);

  return (
    <>
      <DevProfiler id="AppRoot">
        <ShellConfigProvider>
          <AppMenuProvider>
            <OpenworkControlProvider>
              <OpenworkRouteControlActions />
              <BrandThemeControlActions />
              <Routes>
                <Route
                  path="/login"
                  element={
                    <DevProfiler id="SprintnexLoginRoute">
                      <SprintnexLoginPage />
                    </DevProfiler>
                  }
                />
                <Route
                  path="/signin"
                  element={<Navigate to="/login" replace />}
                />
                <Route
                  path="/onboarding"
                  element={<Navigate to="/session" replace />}
                />
                <Route
                  path="/welcome"
                  element={
                    <DevProfiler id="WelcomeRoute">
                      <SprintnexAuthGate>
                        <WelcomeRoute />
                      </SprintnexAuthGate>
                    </DevProfiler>
                  }
                />
                <Route
                  path="/session"
                  element={
                    <DevProfiler id="SessionRoute">
                      <SprintnexAuthGate>
                        <SessionRoute />
                      </SprintnexAuthGate>
                    </DevProfiler>
                  }
                />
                <Route
                  path="/session/:sessionId"
                  element={
                    <DevProfiler id="SessionRoute">
                      <SprintnexAuthGate>
                        <SessionRoute />
                      </SprintnexAuthGate>
                    </DevProfiler>
                  }
                />
                <Route
                  path="/workspace/:workspaceId/session"
                  element={
                    <DevProfiler id="SessionRoute">
                      <SprintnexAuthGate>
                        <SessionRoute />
                      </SprintnexAuthGate>
                    </DevProfiler>
                  }
                />
                <Route
                  path="/workspace/:workspaceId/session/:sessionId"
                  element={
                    <DevProfiler id="SessionRoute">
                      <SprintnexAuthGate>
                        <SessionRoute />
                      </SprintnexAuthGate>
                    </DevProfiler>
                  }
                />
                <Route
                  path="/workspace/:workspaceId/settings/*"
                  element={
                    <DevProfiler id="SettingsRoute">
                      <SprintnexAuthGate>
                        <SettingsRoute />
                      </SprintnexAuthGate>
                    </DevProfiler>
                  }
                />
                <Route
                  path="/settings/*"
                  element={
                    <DevProfiler id="SettingsRoute">
                      <SprintnexAuthGate>
                        <SettingsRoute />
                      </SprintnexAuthGate>
                    </DevProfiler>
                  }
                />
                <Route
                  path="/sprintnex/mappings"
                  element={
                    <DevProfiler id="SprintnexMappingRoute">
                      <SprintnexAuthGate>
                        <SprintnexMappingPage />
                      </SprintnexAuthGate>
                    </DevProfiler>
                  }
                />{" "}
                <Route
                  path="/sprintnex/tasks"
                  element={
                    <DevProfiler id="SprintnexTasksRoute">
                      <SprintnexAuthGate>
                        <SprintnexTasksPage />
                      </SprintnexAuthGate>
                    </DevProfiler>
                  }
                />{" "}
                <Route
                  path="/sprintnex/knowledge"
                  element={
                    <DevProfiler id="SprintnexKnowledgeRoute">
                      <SprintnexAuthGate>
                        <SprintnexKnowledgePage />
                      </SprintnexAuthGate>
                    </DevProfiler>
                  }
                />{" "}
                <Route
                  path="/sprintnex/knowledge/:id"
                  element={
                    <DevProfiler id="SprintnexKnowledgeDetailRoute">
                      <SprintnexAuthGate>
                        <SprintnexKnowledgeDetailPage />
                      </SprintnexAuthGate>
                    </DevProfiler>
                  }
                />{" "}
                <Route
                  path="/sprintnex/skills"
                  element={
                    <DevProfiler id="SprintnexSkillsRoute">
                      <SprintnexAuthGate>
                        <SprintnexSkillsPage />
                      </SprintnexAuthGate>
                    </DevProfiler>
                  }
                />{" "}
                <Route
                  path="/sprintnex/skills/:id"
                  element={
                    <DevProfiler id="SprintnexSkillDetailRoute">
                      <SprintnexAuthGate>
                        <SprintnexSkillDetailPage />
                      </SprintnexAuthGate>
                    </DevProfiler>
                  }
                />{" "}
                <Route
                  path="/sprintnex/skills/:id/edit"
                  element={
                    <DevProfiler id="SprintnexSkillEditRoute">
                      <SprintnexAuthGate>
                        <SprintnexSkillEditPage />
                      </SprintnexAuthGate>
                    </DevProfiler>
                  }
                />{" "}
                <Route
                  path="/sprintnex/skills/marketplace"
                  element={
                    <DevProfiler id="SprintnexMarketplaceRoute">
                      <SprintnexAuthGate>
                        <SprintnexMarketplacePage />
                      </SprintnexAuthGate>
                    </DevProfiler>
                  }
                />{" "}
                <Route
                  path="/sprintnex/skills/active"
                  element={
                    <DevProfiler id="SprintnexActiveSkillsRoute">
                      <SprintnexAuthGate>
                        <SprintnexActiveSkillsPage />
                      </SprintnexAuthGate>
                    </DevProfiler>
                  }
                />{" "}
                {/* Default + fallback: land on the session view. Users open
                  settings deliberately via the sidebar or command palette. */}
                <Route path="/" element={<Navigate to="/session" replace />} />
                <Route path="*" element={<Navigate to="/session" replace />} />
              </Routes>
            </OpenworkControlProvider>
          </AppMenuProvider>
        </ShellConfigProvider>
        <LoadingOverlay />
      </DevProfiler>
      {/*
        DevProfilerOverlay sits OUTSIDE the AppRoot <Profiler> zone on
        purpose. The overlay re-renders on every emit() to refresh its
        table, and any commit inside a <Profiler> is recorded as a
        commit on that zone. Mounting the overlay inside AppRoot would
        inflate AppRoot's commit count by hundreds of overlay
        self-renders for every real user-visible commit, masking the
        true app-level signal.
      */}
      <NewProvidersListener />
      <DevProfilerOverlay />
      <ReactRenderWatchdogOverlay />
    </>
  );
}
