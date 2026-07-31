/** @jsxImportSource react */
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Play,
  Plus,
  RotateCw,
  Trash2,
  FileEdit,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  addStepToScenario,
  removeStepFromScenario,
  updateStepInScenario,
  createScenario,
  getPlanScenarios,
  type TestScenario,
  type TestStep,
} from "@/app/lib/scenario-store";
import {
  useTestPlan,
  updateTestPlan,
  deleteTestPlan,
  reorderScenarios,
  addScenarioToPlan,
  removeScenarioFromPlan,
  createTestRun,
  updateTestRun,
} from "@/app/lib/test-plan-store";
import {
  readSprintnexAicoeScope,
  getMappedWorkspaceForSprintnexProject,
} from "@/app/lib/sprintnex-aicoe-api";
import { createClient } from "@/app/lib/opencode";
import { resolveOpenworkConnection } from "@/react-app/shell/openwork-connection";
import { ensureBrowserMcp } from "@/app/lib/qa-agent";

export default function SprintnexTestPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const plan = useTestPlan(id);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [expandedScenarios, setExpandedScenarios] = useState<Set<string>>(
    new Set(),
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [showAddScenario, setShowAddScenario] = useState(false);
  const [newScenarioName, setNewScenarioName] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const handleRun = async () => {
    if (!plan || running) return;
    setRunning(true);
    setError("");
    try {
      const mcpUrl = await ensureBrowserMcp();

      // Create a TestRun record
      const targetUrl =
        localStorage.getItem("sprintnex.targetUrl") || undefined;
      const run = createTestRun(plan.id, plan.name, targetUrl);

      const { normalizedBaseUrl, resolvedToken } =
        await resolveOpenworkConnection();
      if (!normalizedBaseUrl || !resolvedToken) {
        updateTestRun(run.id, { status: "failed" });
        setError("OpenWork server not connected");
        return;
      }

      const scope = readSprintnexAicoeScope();
      const mappedWsId = getMappedWorkspaceForSprintnexProject(scope.projectId);
      if (!mappedWsId) {
        updateTestRun(run.id, { status: "failed" });
        setError(
          "No workspace mapped for this project. Configure a mapping in Sprintnex settings.",
        );
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

      // Link session to run
      updateTestRun(run.id, { sessionId: sid });

      // Initialize scenario results
      const scenarioResults = getPlanScenarios(plan).map(
        (sc): import("@/app/lib/test-plan-store").ScenarioResult => ({
          scenarioId: sc.id,
          scenarioName: sc.name,
          status: "running" as const,
          steps: sc.steps.map((st) => ({
            stepId: st.id,
            action: st.action,
            status: "skipped" as const,
          })),
          screenshots: [],
          logs: [`Started at ${new Date().toLocaleTimeString()}`],
          startedAt: new Date().toISOString(),
        }),
      );
      updateTestRun(run.id, {
        scenarioResults,
        totalScenarios: scenarioResults.length,
      });

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

      const prompt = `## QA Test Execution\n\n**Test Plan:** ${plan.name}\n**Type:** ${plan.testType}\n\n**Scenarios to execute:**\n\n${stepsText}\n\nExecute these test scenarios using the browser automation tools available to you. The MCP browser server is at ${mcpUrl}. Navigate to the application and follow each step. Take screenshots at key points. Report pass/fail for each scenario with detailed results.`;

      await opencodeClient.session.promptAsync({
        sessionID: sid,
        parts: [{ type: "text", text: prompt }],
      });

      navigate(`/session/${sid}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  if (!plan) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-dls-bg">
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <FileText className="mx-auto size-8 text-dls-muted" />
            <p className="mt-2 text-sm text-dls-secondary">
              Test plan not found
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => navigate("/sprintnex/tests")}
            >
              Back to Tests
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const toggleScenario = (scenarioId: string) => {
    setExpandedScenarios((prev) => {
      const next = new Set(prev);
      if (next.has(scenarioId)) next.delete(scenarioId);
      else next.add(scenarioId);
      return next;
    });
  };

  const handleStartEdit = () => {
    setEditName(plan.name);
    setEditDesc(plan.description);
    setEditing(true);
  };

  const handleSave = () => {
    updateTestPlan(plan.id, {
      name: editName,
      description: editDesc,
    });
    setEditing(false);
  };

  const handleDelete = () => {
    if (confirm(`Delete "${plan.name}" and all scenarios?`)) {
      deleteTestPlan(plan.id);
      navigate("/sprintnex/tests");
    }
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    reorderScenarios(plan.id, fromIndex, toIndex);
  };

  const handleAddScenario = () => {
    if (!newScenarioName.trim()) return;
    const newScenario = createScenario({
      name: newScenarioName.trim(),
      description: "",
      steps: [],
      tags: [],
    });
    addScenarioToPlan(plan.id, newScenario.id);
    setNewScenarioName("");
    setShowAddScenario(false);
  };

  const handleDeleteScenario = (scenarioId: string) => {
    if (confirm("Delete this scenario?")) {
      removeScenarioFromPlan(plan.id, scenarioId);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-dls-bg">
      {/* Header */}
      <div className="shrink-0 border-b border-dls-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#111827] text-white"></div>
            <div>
              {editing ? (
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-7 text-sm font-semibold"
                />
              ) : (
                <h1 className="text-base font-semibold text-dls-text">
                  {plan.name}
                </h1>
              )}
              <p className="text-xs text-dls-secondary">
                {plan.testType} &middot; {plan.status} &middot;{" "}
                {plan.scenarioIds.length} scenario
                {plan.scenarioIds.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/sprintnex/tests")}
            >
              <ArrowLeft className="size-3.5" />
              Back to Tests
            </Button>
            {editing ? (
              <>
                <Button size="sm" onClick={handleSave}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" onClick={handleRun} disabled={running}>
                  {running ? (
                    <RotateCw className="size-3.5 animate-spin" />
                  ) : (
                    <Play className="size-3.5" />
                  )}
                  Run
                </Button>
                <Button size="sm" variant="outline" onClick={handleStartEdit}>
                  <FileEdit className="size-3.5" />
                  Edit
                </Button>
                <Button size="sm" variant="destructive" onClick={handleDelete}>
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex min-h-0 flex-1 gap-4 overflow-auto px-6 py-4">
        <div className="flex w-full flex-col gap-4">
          {/* Description */}
          {editing ? (
            <div className="rounded-lg border border-dls-border bg-dls-surface p-4">
              <h3 className="mb-2 text-xs font-semibold text-dls-secondary uppercase tracking-wider">
                Description
              </h3>
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="min-h-[80px] text-xs"
              />
            </div>
          ) : plan.description ? (
            <div className="rounded-lg border border-dls-border bg-dls-surface p-4">
              <h3 className="mb-2 text-xs font-semibold text-dls-secondary uppercase tracking-wider">
                Description
              </h3>
              <p className="whitespace-pre-wrap text-xs text-dls-text">
                {plan.description}
              </p>
            </div>
          ) : null}

          {/* Scenarios */}
          <div className="rounded-lg border border-dls-border bg-dls-surface">
            <div className="flex items-center justify-between border-b border-dls-border px-4 py-2">
              <h3 className="text-xs font-semibold text-dls-secondary uppercase tracking-wider">
                Scenarios ({plan.scenarioIds.length})
              </h3>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setShowAddScenario(true)}
              >
                <Plus className="size-3" />
                Add Scenario
              </Button>
            </div>

            {/* Add scenario form */}
            {showAddScenario && (
              <div className="flex gap-2 border-b border-dls-border px-4 py-2">
                <Input
                  value={newScenarioName}
                  onChange={(e) => setNewScenarioName(e.target.value)}
                  placeholder="Scenario name..."
                  className="h-7 text-xs"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddScenario();
                    if (e.key === "Escape") setShowAddScenario(false);
                  }}
                />
                <Button size="sm" className="h-7" onClick={handleAddScenario}>
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  onClick={() => setShowAddScenario(false)}
                >
                  Cancel
                </Button>
              </div>
            )}

            {plan.scenarioIds.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-dls-secondary">No scenarios yet</p>
                <p className="text-xs text-dls-muted">
                  Add scenarios to define your test cases
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1 p-2">
                {getPlanScenarios(plan).map((scenario, index) => (
                  <ScenarioCard
                    key={scenario.id}
                    planId={plan.id}
                    scenario={scenario}
                    index={index}
                    isExpanded={expandedScenarios.has(scenario.id)}
                    onToggle={() => toggleScenario(scenario.id)}
                    onDragStart={() => setDragIndex(index)}
                    onDrop={() => {
                      if (dragIndex !== null && dragIndex !== index) {
                        handleReorder(dragIndex, index);
                      }
                      setDragIndex(null);
                    }}
                    onDelete={() => handleDeleteScenario(scenario.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Scenario Card ──────────────────────────────────────────────────────────

function ScenarioCard({
  planId,
  scenario,
  index,
  isExpanded,
  onToggle,
  onDragStart,
  onDrop,
  onDelete,
}: {
  planId: string;
  scenario: TestScenario;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onDragStart: () => void;
  onDrop: () => void;
  onDelete: () => void;
}) {
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editAction, setEditAction] = useState("");
  const [editExpected, setEditExpected] = useState("");
  const [newStepAction, setNewStepAction] = useState("");
  const [newStepExpected, setNewStepExpected] = useState("");

  const startEdit = (step: TestStep) => {
    setEditingStepId(step.id);
    setEditAction(step.action);
    setEditExpected(step.expectedResult);
  };

  const saveEdit = () => {
    if (!editingStepId) return;
    updateStepInScenario(scenario.id, editingStepId, {
      action: editAction,
      expectedResult: editExpected,
    });
    setEditingStepId(null);
  };

  const handleAddStep = () => {
    if (!newStepAction.trim()) return;
    addStepToScenario(scenario.id, {
      action: newStepAction.trim(),
      expectedResult: newStepExpected.trim(),
    });
    setNewStepAction("");
    setNewStepExpected("");
  };

  return (
    <div
      className="rounded-md border border-dls-border bg-dls-bg transition-colors hover:border-dls-accent"
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <GripVertical className="size-3.5 shrink-0 cursor-grab text-dls-muted" />
        <button
          onClick={onToggle}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <span className="flex size-5 shrink-0 items-center justify-center rounded bg-[#111827] text-[10px] text-white">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-medium text-dls-text">
              {scenario.name}
            </span>
            {scenario.description && (
              <p className="truncate text-[10px] text-dls-secondary">
                {scenario.description}
              </p>
            )}
          </div>
          {scenario.tags.length > 0 && (
            <div className="flex gap-1">
              {scenario.tags.map((tag) => (
                <Badge
                  key={tag}
                  className="bg-dls-accent/50 text-[9px] px-1 py-0 text-dls-secondary"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          <Badge className="bg-dls-accent/30 text-[10px] px-1.5 py-0 text-dls-secondary">
            {scenario.steps.length} step
            {scenario.steps.length !== 1 ? "s" : ""}
          </Badge>
        </button>
        <button
          onClick={onDelete}
          className="shrink-0 text-dls-muted hover:text-red-500"
        >
          <Trash2 className="size-3" />
        </button>
        {isExpanded ? (
          <ChevronDown className="size-3 text-dls-muted" />
        ) : (
          <ChevronRight className="size-3 text-dls-muted" />
        )}
      </div>
      {isExpanded && (
        <div className="border-t border-dls-border px-3 py-2 space-y-2">
          {/* Step list */}
          {scenario.steps.length === 0 ? (
            <p className="py-2 text-center text-[10px] text-dls-secondary">
              No steps defined
            </p>
          ) : (
            <div className="space-y-1">
              {scenario.steps.map((step) => (
                <div
                  key={step.id}
                  className="flex gap-2 rounded bg-dls-accent/20 px-2 py-1.5 text-[11px]"
                >
                  {editingStepId === step.id ? (
                    <div className="min-w-0 flex-1 space-y-1">
                      <Input
                        value={editAction}
                        onChange={(e) => setEditAction(e.target.value)}
                        className="h-6 text-[11px]"
                        placeholder="Action"
                      />
                      <Input
                        value={editExpected}
                        onChange={(e) => setEditExpected(e.target.value)}
                        className="h-6 text-[11px]"
                        placeholder="Expected result"
                      />
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          className="h-5 text-[10px] px-1.5"
                          onClick={saveEdit}
                        >
                          <Save className="size-2.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 text-[10px] px-1.5"
                          onClick={() => setEditingStepId(null)}
                        >
                          <X className="size-2.5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="shrink-0 font-medium text-dls-secondary">
                        {step.order}.
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
                        onClick={() => startEdit(step)}
                        className="shrink-0 text-dls-muted hover:text-dls-text"
                      >
                        <FileEdit className="size-3" />
                      </button>
                      <button
                        onClick={() =>
                          removeStepFromScenario(scenario.id, step.id)
                        }
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
            <Input
              value={newStepAction}
              onChange={(e) => setNewStepAction(e.target.value)}
              placeholder="New step..."
              className="h-7 text-[11px]"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddStep();
              }}
            />
            <Input
              value={newStepExpected}
              onChange={(e) => setNewStepExpected(e.target.value)}
              placeholder="Expected..."
              className="h-7 w-1/3 text-[11px]"
            />
            <Button
              size="sm"
              className="h-7 shrink-0"
              onClick={handleAddStep}
              disabled={!newStepAction.trim()}
            >
              <Plus className="size-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
