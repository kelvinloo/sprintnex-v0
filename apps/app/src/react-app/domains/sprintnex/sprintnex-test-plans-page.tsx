/** @jsxImportSource react */
import { useState } from "react";
import {
  ArrowLeft,
  FileText,
  Plus,
  Workflow,
  Search,
  FileEdit,
  Trash2,
  LayoutTemplate,
  BarChart3,
  RotateCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { t } from "@/i18n";
import { createScenario, getPlanScenarios } from "@/app/lib/scenario-store";
import {
  useTestPlans,
  deleteTestPlan,
  createTestPlan,
  updateTestPlan,
  type TestPlan,
} from "@/app/lib/test-plan-store";
import { readSprintnexAicoeScope } from "@/app/lib/sprintnex-aicoe-api";
import { createClient } from "@/app/lib/opencode";
import { resolveOpenworkConnection } from "@/react-app/shell/openwork-connection";
import { SprintnexTabBar } from "./sprintnex-tab-bar";
import type { TabDefinition } from "./sprintnex-tab-bar";

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

export default function SprintnexTestPlansPage() {
  const navigate = useNavigate();
  const scope = readSprintnexAicoeScope();
  const plans = useTestPlans();
  const [activeTab, setActiveTab] = useState("plans");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newType, setNewType] = useState<TestPlan["testType"]>("functional");

  const testPlanTabs: TabDefinition[] = [
    {
      id: "plans",
      label: t("sprintnex.tabs.plans"),
      icon: FileText,
      onClick: () => setActiveTab("plans"),
      count: plans.length,
    },
    {
      id: "templates",
      label: t("sprintnex.tabs.templates"),
      icon: LayoutTemplate,
      onClick: () => setActiveTab("templates"),
    },
    {
      id: "reports",
      label: t("sprintnex.tabs.reports"),
      icon: BarChart3,
      onClick: () => setActiveTab("reports"),
    },
  ];

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
      const opencodeClient = createClient(
        `${normalizedBaseUrl}/workspace/${scope.projectId}/opencode`,
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

      const result = await opencodeClient.session.promptAsync({
        sessionID: sessionId,
        parts: [{ type: "text", text: generatePrompt }],
      });

      if (result.error) {
        console.warn("[test-plans] promptAsync error", result.error);
      }

      // Poll for the assistant's response
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

      // Extract JSON from the response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      const scenarios = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

      const plan = createTestPlan({
        name: newName.trim(),
        description: newDescription.trim(),
        testType: newType,
      });

      // Add each generated scenario to the plan
      if (Array.isArray(scenarios)) {
        const scenarioIds = scenarios.map(
          (s: {
            name?: string;
            description?: string;
            tags?: string[];
            steps?: { action: string; expectedResult: string }[];
          }) => {
            const sc = createScenario({
              name: s.name || t("sprintnex.common.untitled"),
              description: s.description || "",
              tags: s.tags || [],
              steps: (s.steps || []).map((step, j) => ({
                id: crypto.randomUUID(),
                action: step.action,
                expectedResult: step.expectedResult,
                order: j,
              })),
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
              <FileText size={16} />
            </div>
            <div>
              <h1 className="text-base font-semibold text-dls-text">
                Test Plans
              </h1>
              <p className="text-xs text-dls-secondary">
                {plans.length} plan{plans.length !== 1 ? "s" : ""}
                {scope.projectName ? ` · ${scope.projectName}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="size-3.5" />
              New Plan
            </Button>
          </div>
        </div>
        <SprintnexTabBar activeTab={activeTab} customTabs={testPlanTabs} />
      </div>

      {/* Content */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-6 py-4">
        {activeTab === "plans" && (
          <>
            {/* Create form */}
            {showCreate && (
              <div className="rounded-lg border border-dls-border bg-dls-surface p-4">
                <h2 className="mb-3 text-sm font-semibold text-dls-text">
                  {t("sprintnex.test.create_plan")}
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
                    placeholder={t("sprintnex.test.description_placeholder")}
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
                          <RotateCw className="size-3.5 animate-spin" />{" "}
                          {t("sprintnex.test.generating")}
                        </>
                      ) : (
                        <>
                          <Workflow className="size-3.5" />{" "}
                          {t("sprintnex.test.generate_with_ai")}
                        </>
                      )}
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCreate}>
                      {t("sprintnex.test.create_empty")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowCreate(false)}
                    >
                      {t("common.cancel")}
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
                  <p className="mt-2 text-sm text-dls-secondary">
                    No test plans yet
                  </p>
                  <p className="text-xs text-dls-muted">
                    Create your first test plan to get started
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
          </>
        )}

        {activeTab === "templates" && (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <LayoutTemplate className="mx-auto size-8 text-dls-muted" />
              <p className="mt-2 text-sm text-dls-secondary">
                {t("sprintnex.test.templates")}
              </p>
              <p className="text-xs text-dls-muted">
                {t("sprintnex.test.templates_hint")}
              </p>
            </div>
          </div>
        )}

        {activeTab === "reports" && (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <BarChart3 className="mx-auto size-8 text-dls-muted" />
              <p className="mt-2 text-sm text-dls-secondary">
                {t("sprintnex.test.reports")}
              </p>
              <p className="text-xs text-dls-muted">
                {t("sprintnex.test.reports_hint")}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
