/** @jsxImportSource react */
import { useState } from "react";
import {
  Activity,
  ArrowLeft,
  Bot,
  Bug,
  Play,
  RotateCw,
  Terminal,
  History,
  Settings2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { t } from "@/i18n";
import { readSprintnexAicoeScope } from "@/app/lib/sprintnex-aicoe-api";
import { createClient } from "@/app/lib/opencode";
import { resolveOpenworkConnection } from "@/react-app/shell/openwork-connection";
import { ensureBrowserMcp, executeQaTask } from "@/app/lib/qa-agent";
import { SprintnexTabBar } from "./sprintnex-tab-bar";
import type { TabDefinition } from "./sprintnex-tab-bar";

type LogEntry = {
  ts: string;
  text: string;
};

export default function SprintnexQaPage() {
  const navigate = useNavigate();
  const scope = readSprintnexAicoeScope();

  const [activeTab, setActiveTab] = useState("manual");
  const [targetUrl, setTargetUrl] = useState("");
  const [testSteps, setTestSteps] = useState("");
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);

  const qaTabs: TabDefinition[] = [
    {
      id: "manual",
      label: t("sprintnex.qa.manual"),
      icon: Bug,
      onClick: () => setActiveTab("manual"),
    },
    {
      id: "sessions",
      label: t("sprintnex.qa.sessions"),
      icon: History,
      onClick: () => setActiveTab("sessions"),
    },
  ];

  const addLog = (text: string) => {
    setLogs((prev) => [...prev, { ts: new Date().toLocaleTimeString(), text }]);
  };

  const handleRun = async () => {
    if (!targetUrl.trim()) {
      setError(t("sprintnex.qa.error_target_url_required"));
      return;
    }
    if (!testSteps.trim()) {
      setError(t("sprintnex.qa.error_test_steps_required"));
      return;
    }

    setRunning(true);
    setError("");
    setLogs([]);
    setSessionId(null);
    addLog(t("sprintnex.qa.initializing_agent"));

    try {
      // 1. Ensure MCP browser server is running
      addLog(t("sprintnex.qa.checking_mcp"));
      await ensureBrowserMcp();
      addLog(t("sprintnex.qa.mcp_ready"));

      // 2. Connect to OpenWork
      addLog(t("sprintnex.qa.connecting_openwork"));
      const { normalizedBaseUrl, resolvedToken } =
        await resolveOpenworkConnection();
      if (!normalizedBaseUrl || !resolvedToken) {
        throw new Error(t("sprintnex.qa.openwork_not_connected"));
      }
      addLog(t("sprintnex.qa.connected_openwork"));

      // 3. Create OpenCode session
      addLog(t("sprintnex.qa.creating_session"));
      const opencodeClient = createClient(
        `${normalizedBaseUrl}/workspace/${scope.projectId}/opencode`,
        undefined,
        { token: resolvedToken, mode: "openwork" },
      );
      const { unwrap } = await import("@/app/lib/opencode");
      const created = unwrap(
        await opencodeClient.session.create({
          directory: undefined,
        }),
      );
      const sid = created.id;
      setSessionId(sid);
      addLog(t("sprintnex.qa.session_created", { id: sid.slice(0, 8) }));

      // 4. Execute QA task
      addLog(t("sprintnex.qa.sending_instructions"));
      const result = await executeQaTask(sid, opencodeClient, {
        targetUrl: targetUrl.trim(),
        testSteps: testSteps.trim(),
      });
      addLog(t("sprintnex.qa.log_instructions_sent"));

      if (result.error) {
        addLog(t("sprintnex.common.error_with_message", { message: result.error }));
        setError(result.error);
      } else {
        addLog(t("sprintnex.qa.executing_tests"));
        addLog(t("sprintnex.qa.log_watch_progress"));
      }
    } catch (err) {
      const msg = String(err);
      addLog(t("sprintnex.common.error_with_message", { message: msg }));
      setError(msg);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-dls-bg">
      {/* Header */}
      <div className="shrink-0 border-b border-dls-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7 shrink-0"
              onClick={() => navigate("/session")}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#111827] text-white">
              <Bug size={16} />
            </div>
            <div>
              <h1 className="text-base font-semibold text-dls-text">
                QA Browser Testing
              </h1>
              <p className="text-xs text-dls-secondary">
                Run browser-based tests against a target URL
                {scope.projectName ? ` · ${scope.projectName}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sessionId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/session/${sessionId}`)}
              >
                <Terminal className="size-3.5" />
                Open Session
              </Button>
            )}
          </div>
        </div>
        <SprintnexTabBar activeTab={activeTab} customTabs={qaTabs} />
      </div>

      {/* Content */}
      <div className="flex min-h-0 flex-1 gap-4 overflow-auto px-6 py-4">
        {activeTab === "manual" ? (
          <>
            {/* Left: Form */}
            <div className="flex w-1/2 flex-col gap-4">
              <div className="rounded-lg border border-dls-border bg-dls-surface p-4">
                <h2 className="mb-3 text-sm font-semibold text-dls-text">
                  Test Configuration
                </h2>

                {error && (
                  <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                  </div>
                )}

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-dls-text">
                      Target URL *
                    </Label>
                    <Input
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      placeholder="http://localhost:5173"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-dls-text">
                      Test Steps (markdown) *
                    </Label>
                    <Textarea
                      value={testSteps}
                      onChange={(e) => setTestSteps(e.target.value)}
                      placeholder={`## Test: Login Flow\n\n1. Navigate to /login\n2. Enter "admin" into #username\n3. Enter "password" into #password\n4. Click #submit-btn\n5. Verify dashboard loads`}
                      className="min-h-[200px] text-xs font-mono"
                    />
                  </div>

                  <Button
                    size="sm"
                    onClick={handleRun}
                    disabled={running}
                    className="w-full"
                  >
                    {running ? (
                      <>
                        <RotateCw className="size-3.5 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="size-3.5" />
                        Run QA Tests
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Right: Logs */}
            <div className="flex w-1/2 flex-col">
              <div className="flex flex-1 flex-col rounded-lg border border-dls-border bg-dls-surface">
                <div className="flex items-center gap-2 border-b border-dls-border px-3 py-2">
                  <Activity size={14} className="text-dls-secondary" />
                  <span className="text-xs font-medium text-dls-text">
                    Output
                  </span>
                  {running && (
                    <Bot
                      size={14}
                      className="ml-auto animate-pulse text-blue-500"
                    />
                  )}
                </div>
                <div className="flex-1 overflow-auto p-3">
                  {logs.length === 0 ? (
                    <p className="text-xs text-dls-secondary">
                      Configure the test and click "Run QA Tests" to start.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {logs.map((log, i) => (
                        <div
                          key={i}
                          className="flex gap-2 text-[11px] font-mono leading-relaxed"
                        >
                          <span className="shrink-0 text-dls-muted">
                            {log.ts}
                          </span>
                          <span
                            className={
                    log.text.startsWith(t("sprintnex.common.error"))
                                ? "text-red-400"
                                : "text-dls-text"
                            }
                          >
                            {log.text}
                          </span>
                        </div>
                      ))}
                      {running && (
                        <span className="inline-block size-2 animate-pulse rounded-full bg-blue-500" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <History className="mx-auto size-8 text-dls-muted" />
              <p className="mt-2 text-sm text-dls-secondary">
                QA Session History
              </p>
              <p className="text-xs text-dls-muted">
                Past QA execution sessions will appear here
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
