/** @jsxImportSource react */
import { useState, useEffect, useRef } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
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
  deleteTestPlan,
  createTestPlan,
  updateTestPlan,
  type TestPlan,
} from "@/app/lib/test-plan-store";
import {
  readSprintnexAicoeScope,
  getMappedWorkspaceForSprintnexProject,
} from "@/app/lib/sprintnex-aicoe-api";
import { createClient } from "@/app/lib/opencode";
import { resolveOpenworkConnection } from "@/react-app/shell/openwork-connection";
import { writeActiveWorkspaceId } from "@/react-app/shell/session-memory";
import { ensureBrowserMcp, executeQaTask } from "@/app/lib/qa-agent";
import { t } from "@/i18n";
import { SprintnexTabBar } from "./sprintnex-tab-bar";
import { McpUrlSelector } from "./mcp-url-manager";
import { TargetUrlSelector } from "./target-url-manager";
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
  const [runPlanId, setRunPlanId] = useState<string | null>(null);

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

  const handleRunPlan = async (plan: TestPlan) => {
    if (runPlanId) return;
    const storedTargetUrl = localStorage.getItem("sprintnex.targetUrl") || "";
    setRunPlanId(plan.id);
    try {
      const mcpUrl = await ensureBrowserMcp();
      const { normalizedBaseUrl, resolvedToken } =
        await resolveOpenworkConnection();
      if (!normalizedBaseUrl || !resolvedToken) return;
      const scope = readSprintnexAicoeScope();
      const mappedWsId = getMappedWorkspaceForSprintnexProject(scope.projectId);
      if (!mappedWsId) return;
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

      // Select the workspace + mark this as the active session so the
      // session route loads the new session instead of failing to find it.
      try {
        writeActiveWorkspaceId(mappedWsId);
        window.localStorage.setItem(`openwork.lastSession.${mappedWsId}`, sid);
      } catch {
        /* not critical */
      }

      // Format scenarios as QA test instructions
      const stepsText = getPlanScenarios(plan)
        .map(
          (sc, i) =>
            `### Scenario ${i + 1}: ${sc.name}\n${sc.description ? sc.description + "\n" : ""}` +
            sc.steps
              .map(
                (st) =>
                  `${st.order}. ${st.action}${st.expectedResult ? `\n   Expected: ${st.expectedResult}` : ""}`,
              )
              .join("\n"),
        )
        .join("\n\n");

      const targetInfo = storedTargetUrl
        ? `\n**Target URL:** ${storedTargetUrl}`
        : "";

      // Deterministic filesystem report directory under the workspace root.
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const planSlug =
        (plan.name || "test-plan")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "test-plan";
      const reportDir = `test-reports/${planSlug}/${timestamp}`;

      const prompt = `## QA Test Execution\n\n**Test Plan:** ${plan.name}\n**Type:** ${plan.testType}${targetInfo}\n\n**Scenarios to execute:**\n\n${stepsText}\n\nExecute these test scenarios using the browser automation tools available to you. The MCP browser server is at ${mcpUrl}. Navigate to the application and follow each step. Take a screenshot at every step.\n\n### Report output — write to filesystem (IMPORTANT)\n\nWrite the full test report and ALL screenshots into this directory inside the current workspace (create it if needed):\n\n\`${reportDir}/\`\n\nRequired structure:\n- \`${reportDir}/REPORT.md\` — complete report: plan name, type, target URL, timestamp, and for EACH scenario: name, PASS/FAIL result, step-by-step outcomes, and the relative paths of its screenshots.\n- \`${reportDir}/scenario-1-<short-name>/step-1.png\`, \`step-2.png\`, ... — one folder per scenario with numbered screenshots in execution order.\n\nRules:\n- Save every screenshot you capture into its scenario folder with a numbered filename.\n- After all scenarios finish, write \`${reportDir}/REPORT.md\` with the results.\n- Reference screenshots in REPORT.md using paths relative to the workspace root.\n- Do not write the report anywhere else.\n\n### Cleanup (IMPORTANT)\n\nAfter completing test execution and writing the report, you MUST close the browser by calling the \`hide_browser\` command. This will return the shell to normal mode.`;

      await opencodeClient.session.promptAsync({
        sessionID: sid,
        parts: [{ type: "text", text: prompt }],
      });

      navigate(`/session/${sid}`);
    } catch {
      // silently fail
    } finally {
      setRunPlanId(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
      {/* Connection config cards */}
      <div className="flex gap-3">
        <div className="flex-1 rounded-lg border border-dls-border bg-dls-surface p-3">
          <McpUrlSelector />
        </div>
        <div className="flex-1 rounded-lg border border-dls-border bg-dls-surface p-3">
          <TargetUrlSelector />
        </div>
      </div>

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
              placeholder={t("sprintnex.form.test_plan_name")}
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
              <option value="functional">{t("sprintnex.test.functional")}</option>
              <option value="regression">{t("sprintnex.test.regression")}</option>
              <option value="smoke">{t("sprintnex.test.smoke")}</option>
              <option value="e2e">{t("sprintnex.test.e2e")}</option>
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
          placeholder={t("sprintnex.test.search_plans")}
          className="h-8 pl-8 text-xs"
        />
      </div>

      {/* Test plan list */}
      {filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <FileText className="mx-auto size-8 text-dls-muted" />
            <p className="mt-2 text-sm text-dls-secondary">
              {t("sprintnex.test.no_plans")}
            </p>
            <p className="text-xs text-dls-muted">
              {showCreate
                ? t("sprintnex.test.empty_create_hint")
                : t("sprintnex.test.click_new_plan")}
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
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="size-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRunPlan(plan);
                  }}
                  disabled={runPlanId === plan.id}
                  title="Run test plan"
                >
                  {runPlanId === plan.id ? (
                    <RotateCw className="size-3.5 animate-spin" />
                  ) : (
                    <Play className="size-3.5" />
                  )}
                </Button>
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
              placeholder={t("sprintnex.test.scenario_name")}
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
                    placeholder={t("sprintnex.task.description")}
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={saveEdit}
                      className="rounded bg-[#111827] px-2 py-0.5 text-[10px] text-white"
                    >
                      {t("common.save")}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded px-2 py-0.5 text-[10px] text-dls-secondary"
                    >
                      {t("common.cancel")}
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
                      {t("sprintnex.test.step_count", {
                        count: sc.steps.length,
                      })}
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
                      {t("common.edit")}
                    </button>
                    <button
                      onClick={() => handleDuplicate(sc.id)}
                      className="rounded px-1.5 py-0.5 text-[10px] text-dls-secondary hover:text-dls-text"
                    >
                      {t("sprintnex.test.duplicate_short")}
                    </button>
                    <button
                      onClick={() => handleDelete(sc.id)}
                      className="rounded px-1.5 py-0.5 text-[10px] text-red-500 hover:text-red-600"
                    >
                      {t("sprintnex.test.delete_short")}
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
                    {t("sprintnex.test.no_steps")}
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
                              placeholder={t("sprintnex.form.action")}
                            />
                            <input
                              value={stepEditExpected}
                              onChange={(e) =>
                                setStepEditExpected(e.target.value)
                              }
                              className="h-6 w-full rounded border border-dls-border bg-background px-1 text-[11px] text-foreground"
                              placeholder={t("sprintnex.common.expected_result")}
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
                                  title={t("sprintnex.test.move_up")}
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
                                  title={t("sprintnex.test.move_down")}
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
                                  <span className="font-medium">
                                    {t("sprintnex.common.expected")}
                                  </span>{" "}
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
      id: "plans",
      label: "Test Plans",
      icon: FileText,
      onClick: () => setActiveTab("plans"),
      count: plans.length,
    },
    {
      id: "scenarios",
      label: t("sprintnex.tabs.scenarios"),
      icon: LayoutTemplate,
      onClick: () => setActiveTab("scenarios"),
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
              <h1 className="text-base font-semibold text-dls-text">
                {t("sprintnex.tabs.tests")}
              </h1>
              <p className="text-xs text-dls-secondary">
                {activeTab === "chat"
                  ? "AI test plan assistant"
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
      </div>
    </div>
  );
}
