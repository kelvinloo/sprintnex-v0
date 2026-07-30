/** @jsxImportSource react */
import { useState, useEffect, useRef } from "react";
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  Bot,
  Bug,
  ChevronDown,
  FileEdit,
  FileText,
  History,
  LayoutTemplate,
  MessageSquare,
  Play,
  Plus,
  RotateCw,
  Search,
  Send,
  Terminal,
  Trash2,
  Workflow,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  createScenario,
  getAllScenarios,
  deleteScenario,
  duplicateScenario,
  updateScenario,
  addStepToScenario,
  removeStepFromScenario,
  updateStepInScenario,
  reorderStepsInScenario,
  getPlanScenarios,
  type TestScenario,
  type TestStep,
} from "@/app/lib/scenario-store";
import {
  useTestPlans,
  useTestRuns,
  deleteTestPlan,
  createTestPlan,
  updateTestPlan,
  type TestPlan,
  type TestRun,
} from "@/app/lib/test-plan-store";
import {
  readSprintnexAicoeScope,
  getMappedWorkspaceForSprintnexProject,
} from "@/app/lib/sprintnex-aicoe-api";
import { createClient } from "@/app/lib/opencode";
import { resolveOpenworkConnection } from "@/react-app/shell/openwork-connection";
import { ensureBrowserMcp, executeQaTask } from "@/app/lib/qa-agent";
import { SprintnexTabBar } from "./sprintnex-tab-bar";
import { McpUrlSelector } from "./mcp-url-manager";
import type { TabDefinition } from "./sprintnex-tab-bar";

// ── Constants ──────────────────────────────────────────────────────────────

const TEST_TYPE_COLORS: Record<string, string> = {
  regression:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  smoke:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  functional:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  e2e: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  ready:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  archived: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

type LogEntry = { ts: string; text: string };

// ── QA Runner sub-component ────────────────────────────────────────────────

function QaRunnerView({ scopeProjectName }: { scopeProjectName: string }) {
  const navigate = useNavigate();
  const [targetUrl, setTargetUrl] = useState("");
  const [testSteps, setTestSteps] = useState("");
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);

  const addLog = (text: string) => {
    setLogs((prev) => [...prev, { ts: new Date().toLocaleTimeString(), text }]);
  };

  const handleRun = async () => {
    if (!targetUrl.trim()) {
      setError("Target URL is required");
      return;
    }
    if (!testSteps.trim()) {
      setError("Test steps are required");
      return;
    }

    setRunning(true);
    setError("");
    setLogs([]);
    setSessionId(null);
    addLog("Initializing QA agent...");

    try {
      addLog("Checking MCP browser server...");
      await ensureBrowserMcp();
      addLog("MCP browser server ready");

      addLog("Connecting to OpenWork...");
      const { normalizedBaseUrl, resolvedToken } =
        await resolveOpenworkConnection();
      if (!normalizedBaseUrl || !resolvedToken) {
        throw new Error("OpenWork server not connected");
      }
      addLog("Connected to OpenWork");

      addLog("Creating agent session...");
      const scope = readSprintnexAicoeScope();
      const mappedWsId = getMappedWorkspaceForSprintnexProject(scope.projectId);
      if (!mappedWsId) {
        throw new Error("No workspace mapped for this project");
      }
      const opencodeClient = createClient(
        `${normalizedBaseUrl}/workspace/${mappedWsId}/opencode`,
        undefined,
        { token: resolvedToken, mode: "openwork" },
      );
      const { unwrap } = await import("@/app/lib/opencode");
      const created = unwrap(
        await opencodeClient.session.create({ directory: undefined }),
      );
      const sid = created.id;
      setSessionId(sid);
      addLog(`Session created: ${sid.slice(0, 8)}...`);

      addLog("Sending test instructions to QA agent...");
      const result = await executeQaTask(sid, opencodeClient, {
        targetUrl: targetUrl.trim(),
        testSteps: testSteps.trim(),
      });
      addLog("Test instructions sent to agent");

      if (result.error) {
        addLog(`Error: ${result.error}`);
        setError(result.error);
      } else {
        addLog("QA agent is executing tests in the session...");
        addLog("Navigate to the session to watch progress");
      }
    } catch (err) {
      const msg = String(err);
      addLog(`Error: ${msg}`);
      setError(msg);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 gap-4 overflow-auto">
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
            <McpUrlSelector />

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
            <span className="text-xs font-medium text-dls-text">Output</span>
            {running && (
              <Bot size={14} className="ml-auto animate-pulse text-blue-500" />
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
                    <span className="shrink-0 text-dls-muted">{log.ts}</span>
                    <span
                      className={
                        log.text.startsWith("Error")
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
        {sessionId && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => navigate(`/session/${sessionId}`)}
          >
            <Terminal className="size-3.5" />
            Open Session
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Test Plans sub-component ────────────────────────────────────────────────

function TestPlansView({
  scopeProjectName,
  onNewPlan,
}: {
  scopeProjectName: string;
  onNewPlan?: (trigger: () => void) => void;
}) {
  const navigate = useNavigate();
  const plans = useTestPlans();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newType, setNewType] = useState<TestPlan["testType"]>("functional");

  // Expose toggleCreate to parent via effect (not during render)
  useEffect(() => {
    if (onNewPlan) onNewPlan(() => setShowCreate((v) => !v));
  }, [onNewPlan]);

  const filtered = plans.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCreate = () => {
    if (!newName.trim()) return;
    createTestPlan({
      name: newName.trim(),
      description: newDescription.trim(),
      testType: newType,
    });
    setNewName("");
    setNewDescription("");
    setNewType("functional");
    setShowCreate(false);
  };

  const handleGenerateWithAI = async () => {
    if (!newName.trim()) return;
    setGenerating(true);
    try {
      const { normalizedBaseUrl, resolvedToken } =
        await resolveOpenworkConnection();
      if (!normalizedBaseUrl || !resolvedToken) {
        console.error("[test-plans] OpenWork server not connected");
        return;
      }
      const scope = readSprintnexAicoeScope();
      const mappedWsId = getMappedWorkspaceForSprintnexProject(scope.projectId);
      if (!mappedWsId) {
        console.error("[test-plans] No workspace mapped for project");
        return;
      }
      const opencodeClient = createClient(
        `${normalizedBaseUrl}/workspace/${mappedWsId}/opencode`,
        undefined,
        { token: resolvedToken, mode: "openwork" },
      );
      const { unwrap } = await import("@/app/lib/opencode");
      const created = unwrap(
        await opencodeClient.session.create({ directory: undefined }),
      );
      const sessionId = created.id;

      const generatePrompt = `You are a QA test planner. Generate a comprehensive test plan for the following request.

Name: ${newName.trim()}
Description: ${newDescription.trim() || "No description provided"}
Type: ${newType}

Return your response as a JSON array of scenarios. Each scenario must have:
- "name": string (scenario name)
- "description": string (what this scenario validates)
- "tags": string[] (relevant tags like "login", "auth", "regression")
- "steps": array of { "action": string, "expectedResult": string }

Return ONLY valid JSON, no markdown, no explanation.`;

      await opencodeClient.session.promptAsync({
        sessionID: sessionId,
        parts: [{ type: "text", text: generatePrompt }],
      });

      // Poll for assistant response
      let responseText = "";
      const pollStart = Date.now();
      while (Date.now() - pollStart < 30000) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const msgsResult = await opencodeClient.session.messages({
            sessionID: sessionId,
            limit: 5,
          });
          const msgsData =
            msgsResult && typeof msgsResult === "object" && "data" in msgsResult
              ? (msgsResult as { data?: unknown }).data
              : null;
          if (!Array.isArray(msgsData)) continue;
          const assistantMsg = [...msgsData].reverse().find((m: unknown) => {
            if (!m || typeof m !== "object") return false;
            const info = (m as Record<string, unknown>).info;
            return (
              info &&
              typeof info === "object" &&
              (info as Record<string, unknown>).role === "assistant"
            );
          });
          if (!assistantMsg) continue;
          const parts = (assistantMsg as Record<string, unknown>).parts;
          if (!Array.isArray(parts)) continue;
          const text = parts
            .filter(
              (p: unknown) =>
                p &&
                typeof p === "object" &&
                (p as Record<string, unknown>).type === "text",
            )
            .map((p: unknown) => (p as Record<string, unknown>).text as string)
            .filter(Boolean)
            .join("\n");
          if (text) {
            responseText = text;
            break;
          }
        } catch {
          /* poll */
        }
      }

      // Extract JSON array from response
      let rawScenarios: unknown[] = [];

      const codeBlockMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        try {
          rawScenarios = JSON.parse(codeBlockMatch[1]);
        } catch {
          /* ignore */
        }
      }

      if (!Array.isArray(rawScenarios)) {
        const firstBracket = responseText.indexOf("[");
        const lastBracket = responseText.lastIndexOf("]");
        if (firstBracket !== -1 && lastBracket > firstBracket) {
          try {
            rawScenarios = JSON.parse(
              responseText.slice(firstBracket, lastBracket + 1),
            );
          } catch {
            rawScenarios = [];
          }
        }
      }

      const scenarios = rawScenarios as Array<{
        name?: string;
        description?: string;
        tags?: string[];
        steps?: { action: string; expectedResult: string }[];
      }>;

      const plan = createTestPlan({
        name: newName.trim(),
        description: newDescription.trim(),
        testType: newType,
      });

      if (Array.isArray(scenarios)) {
        const scenarioIds = scenarios.map(
          (
            s: {
              name?: string;
              description?: string;
              tags?: string[];
              steps?: { action: string; expectedResult: string }[];
            },
            i: number,
          ) => {
            const sc = createScenario({
              name: s.name || `Scenario ${i + 1}`,
              description: s.description || "",
              steps: (s.steps || []).map(
                (
                  step: { action: string; expectedResult: string },
                  j: number,
                ) => ({
                  id: crypto.randomUUID(),
                  action: step.action,
                  expectedResult: step.expectedResult,
                  order: j,
                }),
              ),
              tags: s.tags || [],
            });
            return sc.id;
          },
        );
        updateTestPlan(plan.id, { scenarioIds });
      }

      setNewName("");
      setNewDescription("");
      setNewType("functional");
      setShowCreate(false);
    } catch (err) {
      console.error("[test-plans] AI generation failed", err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
      {/* Create form */}
      {showCreate && (
        <div className="rounded-lg border border-dls-border bg-dls-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-dls-text">
            Create Test Plan
          </h2>
          <div className="space-y-3">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Test plan name"
              className="h-8 text-xs"
              autoFocus
            />
            <Input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Describe what this test plan covers..."
              className="h-8 text-xs"
            />
            <select
              value={newType}
              onChange={(e) =>
                setNewType(e.target.value as TestPlan["testType"])
              }
              className="h-8 w-full rounded-md border border-dls-border bg-background px-2 text-xs text-foreground"
            >
              <option value="functional">Functional</option>
              <option value="regression">Regression</option>
              <option value="smoke">Smoke</option>
              <option value="e2e">End-to-End</option>
            </select>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleGenerateWithAI}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <RotateCw className="size-3.5 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <Workflow className="size-3.5" /> Generate with AI
                  </>
                )}
              </Button>
              <Button size="sm" variant="outline" onClick={handleCreate}>
                Create Empty
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-dls-secondary" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search test plans..."
          className="h-8 pl-8 text-xs"
        />
      </div>

      {/* Test plan list */}
      {filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <FileText className="mx-auto size-8 text-dls-muted" />
            <p className="mt-2 text-sm text-dls-secondary">No test plans yet</p>
            <p className="text-xs text-dls-muted">
              {showCreate
                ? "Fill in the form above to create your first plan"
                : 'Click "New Plan" to get started'}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((plan) => (
            <div
              key={plan.id}
              className="group flex cursor-pointer items-center gap-3 rounded-lg border border-dls-border bg-dls-surface p-3 transition-colors hover:bg-dls-accent/50"
              onClick={() => navigate(`/sprintnex/test-plans/${plan.id}`)}
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#111827] text-white">
                <FileText size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-dls-text">
                    {plan.name}
                  </span>
                  <Badge
                    className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[plan.status]}`}
                  >
                    {plan.status}
                  </Badge>
                  <Badge
                    className={`text-[10px] px-1.5 py-0 ${TEST_TYPE_COLORS[plan.testType]}`}
                  >
                    {plan.testType}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-dls-secondary">
                  {plan.description || "No description"}
                </p>
                <p className="mt-0.5 text-[10px] text-dls-muted">
                  {getPlanScenarios(plan).length} scenario
                  {getPlanScenarios(plan).length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/sprintnex/test-plans/${plan.id}`);
                  }}
                >
                  <FileEdit className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 text-red-500 hover:text-red-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete "${plan.name}"?`))
                      deleteTestPlan(plan.id);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Chat sub-component ─────────────────────────────────────────────────────

function ChatView() {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);

    try {
      const { normalizedBaseUrl, resolvedToken } =
        await resolveOpenworkConnection();
      if (!normalizedBaseUrl || !resolvedToken) {
        return;
      }

      const scope = readSprintnexAicoeScope();
      const mappedWsId = getMappedWorkspaceForSprintnexProject(scope.projectId);
      if (!mappedWsId) {
        return;
      }

      const opencodeClient = createClient(
        `${normalizedBaseUrl}/workspace/${mappedWsId}/opencode`,
        undefined,
        { token: resolvedToken, mode: "openwork" },
      );
      const { unwrap } = await import("@/app/lib/opencode");
      const created = unwrap(
        await opencodeClient.session.create({ directory: undefined }),
      );
      const sid = created.id;
      setLastSessionId(sid);

      // Infer plan name from the request
      const planName = text.length > 60 ? text.slice(0, 57) + "..." : text;

      // Send prompt asking for both a conversational answer AND JSON scenarios
      const prompt = `You are a QA test planner assistant. The user wants: ${text}

Respond in two parts:

1. A helpful conversational answer about the test plan.

2. Then output a JSON block with exactly this structure (no other text after it):
\`\`\`json
[
  {
    "name": "Scenario name",
    "description": "What this scenario validates",
    "tags": ["tag1", "tag2"],
    "steps": [
      { "action": "Step description", "expectedResult": "Expected outcome" }
    ]
  }
]
\`\`\`

The JSON must be a valid array of scenario objects. Include relevant scenarios based on the user's request. If the user is just asking a question without requesting a plan, output an empty array [].`;

      await opencodeClient.session.promptAsync({
        sessionID: sid,
        parts: [{ type: "text", text: prompt }],
      });

      // Poll for assistant response
      let responseText = "";
      const pollStart = Date.now();
      while (Date.now() - pollStart < 30000) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const msgsResult = await opencodeClient.session.messages({
            sessionID: sid,
            limit: 5,
          });
          const msgsData =
            msgsResult && typeof msgsResult === "object" && "data" in msgsResult
              ? (msgsResult as { data?: unknown }).data
              : null;
          if (!Array.isArray(msgsData)) continue;
          const assistantMsg = [...msgsData].reverse().find((m: unknown) => {
            if (!m || typeof m !== "object") return false;
            const info = (m as Record<string, unknown>).info;
            return (
              info &&
              typeof info === "object" &&
              (info as Record<string, unknown>).role === "assistant"
            );
          });
          if (!assistantMsg) continue;
          const parts = (assistantMsg as Record<string, unknown>).parts;
          if (!Array.isArray(parts)) continue;
          const combined = parts
            .filter(
              (p: unknown) =>
                p &&
                typeof p === "object" &&
                (p as Record<string, unknown>).type === "text",
            )
            .map((p: unknown) => (p as Record<string, unknown>).text as string)
            .filter(Boolean)
            .join("\n");
          if (combined) {
            responseText = combined;
            break;
          }
        } catch {
          /* poll */
        }
      }

      // Extract JSON array from response
      let rawScenarios: unknown[] = [];

      const codeBlockMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        try {
          rawScenarios = JSON.parse(codeBlockMatch[1]);
        } catch {
          /* ignore */
        }
      }

      if (!Array.isArray(rawScenarios)) {
        const firstBracket = responseText.indexOf("[");
        const lastBracket = responseText.lastIndexOf("]");
        if (firstBracket !== -1 && lastBracket > firstBracket) {
          try {
            rawScenarios = JSON.parse(
              responseText.slice(firstBracket, lastBracket + 1),
            );
          } catch {
            rawScenarios = [];
          }
        }
      }

      const scenarios = rawScenarios as Array<{
        name?: string;
        description?: string;
        tags?: string[];
        steps?: { action: string; expectedResult: string }[];
      }>;

      if (scenarios.length > 0) {
        const plan = createTestPlan({
          name: planName,
          description: text,
          testType: "functional",
        });

        const scenarioIds = scenarios.map(
          (
            s: {
              name?: string;
              description?: string;
              tags?: string[];
              steps?: { action: string; expectedResult: string }[];
            },
            i: number,
          ) => {
            const sc = createScenario({
              name: s.name || `Scenario ${i + 1}`,
              description: s.description || "",
              steps: (s.steps || []).map(
                (
                  step: { action: string; expectedResult: string },
                  j: number,
                ) => ({
                  id: crypto.randomUUID(),
                  action: step.action,
                  expectedResult: step.expectedResult,
                  order: j,
                }),
              ),
              tags: s.tags || [],
            });
            return sc.id;
          },
        );
        updateTestPlan(plan.id, { scenarioIds });
      }

      // Navigate to the session chat
      navigate(`/session/${sid}`);
    } catch {
      // silent
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
      <div className="w-full max-w-lg text-center">
        <MessageSquare className="mx-auto size-10 text-dls-muted" />
        <p className="mt-3 text-sm font-medium text-dls-text">
          Test Plan Assistant
        </p>
        <p className="mt-1 text-xs text-dls-muted">
          Type a request to generate a test plan. The AI will create scenarios
          and save them to Test Plans automatically
        </p>

        <div className="mt-6 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Write a regression test plan for login..."
            className="h-9 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={busy}
          />
          <Button
            size="sm"
            className="h-9 shrink-0"
            onClick={handleSend}
            disabled={busy || !input.trim()}
          >
            {busy ? (
              <RotateCw className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
          </Button>
        </div>

        {lastSessionId && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => navigate(`/session/${lastSessionId}`)}
          >
            <MessageSquare className="size-3.5" />
            Reopen last session
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Runs View ──────────────────────────────────────────────────────────────

function RunsView() {
  const navigate = useNavigate();
  const runs = useTestRuns();

  const statusColor = (status: TestRun["status"]) => {
    switch (status) {
      case "running":
        return "text-blue-500";
      case "completed":
        return "text-emerald-500";
      case "failed":
        return "text-red-500";
      case "aborted":
        return "text-gray-500";
    }
  };

  const statusLabel = (status: TestRun["status"]) => {
    switch (status) {
      case "running":
        return "Running";
      case "completed":
        return "Passed";
      case "failed":
        return "Failed";
      case "aborted":
        return "Aborted";
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
      {runs.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <BarChart3 className="mx-auto size-8 text-dls-muted" />
            <p className="mt-2 text-sm text-dls-secondary">No runs yet</p>
            <p className="text-xs text-dls-muted">
              Run a test plan to see execution results here
            </p>
          </div>
        </div>
      ) : (
        runs.map((run) => (
          <div
            key={run.id}
            className="rounded-lg border border-dls-border bg-dls-surface p-3"
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-dls-text">
                    {run.planName}
                  </span>
                  <span
                    className={`text-xs font-medium ${statusColor(run.status)}`}
                  >
                    {statusLabel(run.status)}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-dls-muted">
                  {new Date(run.startedAt).toLocaleString()}
                  {run.completedAt &&
                    ` · ${Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-[11px]">
                <span className="text-emerald-500">{run.passed} pass</span>
                <span className="text-red-500">{run.failed} fail</span>
                <span className="text-orange-500">{run.errors} err</span>
              </div>
            </div>
            {run.scenarioResults.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-dls-border pt-2">
                {run.scenarioResults.map((sr, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <span
                      className={`size-1.5 shrink-0 rounded-full ${
                        sr.status === "pass"
                          ? "bg-emerald-500"
                          : sr.status === "fail"
                            ? "bg-red-500"
                            : sr.status === "error"
                              ? "bg-orange-500"
                              : "bg-gray-400"
                      }`}
                    />
                    <span className="flex-1 truncate text-dls-text">
                      {sr.scenarioName}
                    </span>
                    <span className="text-dls-muted">{sr.status}</span>
                    {sr.screenshots.length > 0 && (
                      <span className="text-dls-muted">
                        📷 {sr.screenshots.length}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ── Scenarios View ─────────────────────────────────────────────────────────

function ScenariosView() {
  const all = getAllScenarios();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  // Step editing state
  const [stepEditId, setStepEditId] = useState<string | null>(null);
  const [stepEditAction, setStepEditAction] = useState("");
  const [stepEditExpected, setStepEditExpected] = useState("");
  const [newStepAction, setNewStepAction] = useState("");
  const [newStepExpected, setNewStepExpected] = useState("");

  const forceRefresh = () => setRefresh((v) => v + 1);

  const handleCreate = () => {
    if (!createName.trim()) return;
    createScenario({ name: createName.trim(), description: createDesc.trim() });
    setCreateName("");
    setCreateDesc("");
    setShowCreate(false);
    forceRefresh();
  };

  const handleDuplicate = (id: string) => {
    duplicateScenario(id);
    forceRefresh();
  };
  const handleDelete = (id: string) => {
    if (confirm("Delete this scenario? It may be referenced by plans.")) {
      deleteScenario(id);
      forceRefresh();
    }
  };

  const startEdit = (sc: TestScenario) => {
    setEditingId(sc.id);
    setEditName(sc.name);
    setEditDesc(sc.description);
  };
  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateScenario(editingId, {
      name: editName.trim(),
      description: editDesc.trim(),
    });
    setEditingId(null);
    forceRefresh();
  };

  const startStepEdit = (scenarioId: string, step: TestStep) => {
    setStepEditId(step.id);
    setStepEditAction(step.action);
    setStepEditExpected(step.expectedResult);
  };
  const saveStepEdit = (scenarioId: string) => {
    if (!stepEditId) return;
    updateStepInScenario(scenarioId, stepEditId, {
      action: stepEditAction,
      expectedResult: stepEditExpected,
    });
    setStepEditId(null);
    forceRefresh();
  };
  const handleAddStep = (scenarioId: string) => {
    if (!newStepAction.trim()) return;
    addStepToScenario(scenarioId, {
      action: newStepAction.trim(),
      expectedResult: newStepExpected.trim(),
    });
    setNewStepAction("");
    setNewStepExpected("");
    forceRefresh();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between">
        <p className="text-xs text-dls-secondary">
          {all.length} scenario{all.length !== 1 ? "s" : ""}
        </p>
        <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
          <Plus className="size-3" /> New
        </Button>
      </div>

      {showCreate && (
        <div className="rounded-lg border border-dls-border bg-dls-surface p-3">
          <div className="space-y-2">
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className="h-7 w-full rounded border border-dls-border bg-background px-2 text-xs text-foreground"
              placeholder="Scenario name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setShowCreate(false);
              }}
            />
            <input
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              className="h-7 w-full rounded border border-dls-border bg-background px-2 text-xs text-foreground"
              placeholder="Description (optional)"
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                className="h-7"
                onClick={handleCreate}
                disabled={!createName.trim()}
              >
                Create
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {all.length === 0 && !showCreate ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <LayoutTemplate className="mx-auto size-8 text-dls-muted" />
            <p className="mt-2 text-sm text-dls-secondary">No scenarios yet</p>
            <p className="text-xs text-dls-muted">
              Use the Chat tab to generate scenarios, or create them in a Test
              Plan
            </p>
          </div>
        </div>
      ) : (
        all.map((sc) => (
          <div
            key={sc.id}
            className="rounded-lg border border-dls-border bg-dls-surface"
          >
            {/* Scenario header */}
            <div
              className="flex cursor-pointer items-center justify-between gap-2 p-3"
              onClick={() => setExpandedId(expandedId === sc.id ? null : sc.id)}
            >
              {editingId === sc.id ? (
                <div
                  className="min-w-0 flex-1 space-y-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-7 w-full rounded border border-dls-border bg-background px-2 text-xs text-foreground"
                  />
                  <input
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="h-7 w-full rounded border border-dls-border bg-background px-2 text-xs text-foreground"
                    placeholder="Description"
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={saveEdit}
                      className="rounded bg-[#111827] px-2 py-0.5 text-[10px] text-white"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded px-2 py-0.5 text-[10px] text-dls-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-dls-text">
                      {sc.name}
                    </p>
                    {sc.description && (
                      <p className="truncate text-xs text-dls-secondary">
                        {sc.description}
                      </p>
                    )}
                    <p className="text-[10px] text-dls-muted">
                      {sc.steps.length} step{sc.steps.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div
                    className="flex shrink-0 items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => startEdit(sc)}
                      className="rounded px-1.5 py-0.5 text-[10px] text-dls-secondary hover:text-dls-text"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDuplicate(sc.id)}
                      className="rounded px-1.5 py-0.5 text-[10px] text-dls-secondary hover:text-dls-text"
                    >
                      Dup
                    </button>
                    <button
                      onClick={() => handleDelete(sc.id)}
                      className="rounded px-1.5 py-0.5 text-[10px] text-red-500 hover:text-red-600"
                    >
                      Del
                    </button>
                    <ChevronDown
                      className={`size-3 ml-1 text-dls-muted transition-transform ${expandedId === sc.id ? "rotate-0" : "-rotate-90"}`}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Expanded: Steps */}
            {expandedId === sc.id && editingId !== sc.id && (
              <div className="border-t border-dls-border px-3 py-2 space-y-2">
                {sc.steps.length === 0 ? (
                  <p className="py-1 text-center text-[10px] text-dls-secondary">
                    No steps
                  </p>
                ) : (
                  <div className="space-y-1">
                    {sc.steps.map((step) => (
                      <div
                        key={step.id}
                        className="flex gap-2 rounded bg-dls-accent/20 px-2 py-1.5 text-[11px]"
                      >
                        {stepEditId === step.id ? (
                          <div className="min-w-0 flex-1 space-y-1">
                            <input
                              value={stepEditAction}
                              onChange={(e) =>
                                setStepEditAction(e.target.value)
                              }
                              className="h-6 w-full rounded border border-dls-border bg-background px-1 text-[11px] text-foreground"
                              placeholder="Action"
                            />
                            <input
                              value={stepEditExpected}
                              onChange={(e) =>
                                setStepEditExpected(e.target.value)
                              }
                              className="h-6 w-full rounded border border-dls-border bg-background px-1 text-[11px] text-foreground"
                              placeholder="Expected result"
                            />
                            <div className="flex gap-1">
                              <button
                                onClick={() => saveStepEdit(sc.id)}
                                className="rounded bg-[#111827] px-1.5 py-0.5 text-[9px] text-white"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setStepEditId(null)}
                                className="rounded px-1.5 py-0.5 text-[9px] text-dls-secondary"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex shrink-0 items-center gap-0.5">
                              {step.order > 0 && (
                                <button
                                  onClick={() => {
                                    reorderStepsInScenario(
                                      sc.id,
                                      step.order,
                                      step.order - 1,
                                    );
                                    forceRefresh();
                                  }}
                                  className="text-dls-muted hover:text-dls-text"
                                  title="Move up"
                                >
                                  <ArrowUp className="size-2.5" />
                                </button>
                              )}
                              {step.order < sc.steps.length - 1 && (
                                <button
                                  onClick={() => {
                                    reorderStepsInScenario(
                                      sc.id,
                                      step.order,
                                      step.order + 1,
                                    );
                                    forceRefresh();
                                  }}
                                  className="text-dls-muted hover:text-dls-text"
                                  title="Move down"
                                >
                                  <ArrowDown className="size-2.5" />
                                </button>
                              )}
                            </div>
                            <span className="shrink-0 font-medium text-dls-secondary">
                              {step.order + 1}.
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-dls-text">{step.action}</p>
                              {step.expectedResult && (
                                <p className="text-dls-secondary">
                                  <span className="font-medium">Expected:</span>{" "}
                                  {step.expectedResult}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => startStepEdit(sc.id, step)}
                              className="shrink-0 text-dls-muted hover:text-dls-text"
                            >
                              <FileEdit className="size-3" />
                            </button>
                            <button
                              onClick={() => {
                                removeStepFromScenario(sc.id, step.id);
                                forceRefresh();
                              }}
                              className="shrink-0 text-dls-muted hover:text-red-500"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add step form */}
                <div className="flex gap-1.5 border-t border-dls-border pt-2">
                  <input
                    value={newStepAction}
                    onChange={(e) => setNewStepAction(e.target.value)}
                    placeholder="New step..."
                    className="h-7 flex-1 rounded border border-dls-border bg-background px-2 text-[11px] text-foreground"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddStep(sc.id);
                    }}
                  />
                  <input
                    value={newStepExpected}
                    onChange={(e) => setNewStepExpected(e.target.value)}
                    placeholder="Expected..."
                    className="h-7 w-1/3 rounded border border-dls-border bg-background px-2 text-[11px] text-foreground"
                  />
                  <Button
                    size="sm"
                    className="h-7 shrink-0"
                    onClick={() => handleAddStep(sc.id)}
                    disabled={!newStepAction.trim()}
                  >
                    <Plus className="size-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ── Main consolidated Tests Page ────────────────────────────────────────────

export default function SprintnexTestsPage() {
  const navigate = useNavigate();
  const scope = readSprintnexAicoeScope();
  const plans = useTestPlans();
  const [activeTab, setActiveTab] = useState("chat");

  const handleNewPlanRef = useRef<(() => void) | null>(null);

  const testsTabs: TabDefinition[] = [
    {
      id: "chat",
      label: "Chat",
      icon: MessageSquare,
      onClick: () => setActiveTab("chat"),
    },
    {
      id: "qa-runner",
      label: "QA Runner",
      icon: Bug,
      onClick: () => setActiveTab("qa-runner"),
    },
    {
      id: "plans",
      label: "Test Plans",
      icon: FileText,
      onClick: () => setActiveTab("plans"),
      count: plans.length,
    },
    {
      id: "scenarios",
      label: "Scenarios",
      icon: LayoutTemplate,
      onClick: () => setActiveTab("scenarios"),
    },
    {
      id: "runs",
      label: "Runs",
      icon: BarChart3,
      onClick: () => setActiveTab("runs"),
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-dls-bg">
      {/* Header */}
      <div className="shrink-0 border-b border-dls-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#111827] text-white">
              <Bug size={16} />
            </div>
            <div>
              <h1 className="text-base font-semibold text-dls-text">Tests</h1>
              <p className="text-xs text-dls-secondary">
                {activeTab === "qa-runner"
                  ? "Run browser-based tests"
                  : activeTab === "chat"
                    ? "AI test plan assistant"
                    : activeTab === "runs"
                      ? "Test execution history"
                      : `${plans.length} plan${plans.length !== 1 ? "s" : ""}`}
                {scope.projectName ? ` · ${scope.projectName}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/session")}
            >
              <ArrowLeft className="size-3.5" />
              Back to Session
            </Button>
            {activeTab === "plans" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleNewPlanRef.current?.()}
              >
                <Plus className="size-3.5" />
                New Plan
              </Button>
            )}
          </div>
        </div>
        <SprintnexTabBar activeTab={activeTab} customTabs={testsTabs} />
      </div>

      {/* Content */}
      <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
        {activeTab === "qa-runner" && (
          <QaRunnerView scopeProjectName={scope.projectName || ""} />
        )}

        {activeTab === "plans" && (
          <TestPlansView
            scopeProjectName={scope.projectName || ""}
            onNewPlan={(trigger) => {
              handleNewPlanRef.current = trigger;
            }}
          />
        )}

        {activeTab === "chat" && <ChatView />}

        {activeTab === "scenarios" && <ScenariosView />}

        {activeTab === "runs" && <RunsView />}
      </div>
    </div>
  );
}
