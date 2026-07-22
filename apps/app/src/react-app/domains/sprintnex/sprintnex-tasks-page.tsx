/** @jsxImportSource react */
import { useCallback, useRef, useState } from "react";
import { ArrowLeft, ListChecks, MessageSquare, Workflow } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getMappedWorkspaceForSprintnexProject,
  readSprintnexAicoeScope,
} from "@/app/lib/sprintnex-aicoe-api";
import { createClient } from "@/app/lib/opencode";
import { resolveOpenworkConnection } from "@/react-app/shell/openwork-connection";
import { createOpenworkServerClient } from "@/app/lib/openwork-server";
import { writeActiveWorkspaceId } from "@/react-app/shell/session-memory";
import { ProjectTaskHub } from "./project-task-hub";
import { SprintnexIntake } from "./sprintnex-intake";
import type { SprintnexAicoeTask } from "@/app/lib/sprintnex-aicoe-api";
import {
  WORKSPACE_AGENT_PROMPT,
  DELIVERY_AGENT_PROMPT,
} from "@/app/lib/sprintnex-agent-prompts";

// ── Concurrency guard ────────────────────────────────────────────────────
// Tracks active stage execution loops by taskId so we never run two loops
// for the same task simultaneously.
const activeLoops = new Map<string, boolean>();

export function SprintnexTasksPage() {
  const navigate = useNavigate();
  const [scopeVersion, setScopeVersion] = useState(0);
  const [activeTab, setActiveTab] = useState<"tasks" | "intake">("intake");
  const [taskCount, setTaskCount] = useState(0);
  const intakeRefreshRef = useRef<(() => void) | null>(null);

  const scope = readSprintnexAicoeScope();

  const handleOpenExecutionSession = useCallback(
    async (task: SprintnexAicoeTask) => {
      let sessionId = "";
      let opencodeClient: ReturnType<typeof createClient> | null = null;
      try {
        const { normalizedBaseUrl, resolvedToken } =
          await resolveOpenworkConnection();
        if (!normalizedBaseUrl || !resolvedToken) {
          console.error("[sprintnex] OpenWork server not connected");
          navigate("/session");
          return;
        }
        const scope = readSprintnexAicoeScope();
        const mappedWsId = getMappedWorkspaceForSprintnexProject(
          scope.projectId,
        );
        if (!mappedWsId) {
          console.error(
            "[sprintnex] No workspace mapped for project",
            scope.projectId,
          );
          navigate("/session");
          return;
        }
        const serverClient = createOpenworkServerClient({
          baseUrl: normalizedBaseUrl,
          token: resolvedToken,
        });
        const workspaceList = await serverClient.listWorkspaces();
        const workspace = workspaceList.items.find((w) => w.id === mappedWsId);
        if (!workspace) {
          console.error(
            "[sprintnex] Workspace not found on server",
            mappedWsId,
          );
          navigate("/session");
          return;
        }
        opencodeClient = createClient(
          `${normalizedBaseUrl}/workspace/${mappedWsId}/opencode`,
          workspace.path?.trim() || undefined,
          { token: resolvedToken, mode: "openwork" },
        );
        const { unwrap } = await import("@/app/lib/opencode");
        console.log("[sprintnex] Creating session for workspace", mappedWsId);
        const created = unwrap(
          await opencodeClient.session.create({
            directory: workspace.path?.trim() || undefined,
          }),
        );
        sessionId = created.id;
        console.log("[sprintnex] Session created", sessionId);

        // Select this workspace so the session route loads correctly
        try {
          writeActiveWorkspaceId(mappedWsId);
          window.localStorage.setItem(
            `openwork.lastSession.${mappedWsId}`,
            sessionId,
          );
        } catch {
          /* not critical */
        }

        // Start the multi-stage execution loop in the background.
        // Use concurrency guard to prevent multiple loops for the same task.
        if (
          !executeStageLoop(task.taskId, sessionId, opencodeClient, {
            baseUrl: normalizedBaseUrl,
            token: resolvedToken,
          })
        ) {
          console.warn(
            "[sprintnex] Loop already running for task, skipping duplicate",
            task.taskId,
          );
        }
      } catch (err) {
        console.error("[sprintnex] Failed to create execution session", err);
      }
      navigate(sessionId ? `/session/${sessionId}` : "/session");
    },
    [navigate],
  );

  /**
   * Multi-stage execution loop:
   * 1. Poll for current stage instructions from Sprintnex backend
   * 2. Apply instructions to the OpenCode session
   * 3. Wait for agent to complete (stage runs inside the session)
   * 4. Notify n8n that stage is complete
   * 5. Loop — n8n stores next stage, poll again
   * 6. Break when no more stages (poll returns null)
   *
   * Returns true if loop was started, false if one was already running for this taskId.
   */
  function executeStageLoop(
    taskId: string,
    sessionId: string,
    client: ReturnType<typeof createClient>,
    openworkConnection?: { baseUrl: string; token: string },
  ): boolean {
    if (activeLoops.get(taskId)) {
      return false;
    }
    activeLoops.set(taskId, true);
    runLoop(taskId, sessionId, client, openworkConnection).finally(() => {
      activeLoops.delete(taskId);
    });
    return true;
  }

  async function runLoop(
    taskId: string,
    sessionId: string,
    client: ReturnType<typeof createClient>,
    openworkConnection?: { baseUrl: string; token: string },
  ) {
    const {
      pollSprintnexTaskStage,
      markSprintnexStageComplete,
      notifySprintnexStageComplete,
    } = await import("@/app/lib/sprintnex-aicoe-api");

    // Create the OpenWork server client for snapshot polling
    const serverClient = openworkConnection
      ? createOpenworkServerClient({
          baseUrl: openworkConnection.baseUrl,
          token: openworkConnection.token,
        })
      : null;
    const scope = readSprintnexAicoeScope();
    const mappedWsId = getMappedWorkspaceForSprintnexProject(scope.projectId);

    const loopStartedAt = new Date().toISOString();
    let stageIndex = 0;

    while (true) {
      // 1. Poll for current stage instructions (single markdown string)
      console.log("[sprintnex] Polling for stage instructions...", { taskId });
      const stage = await pollSprintnexTaskStage(taskId);
      if (!stage || !stage.instructions) {
        console.log("[sprintnex] No more stages — task complete");
        break;
      }
      console.log("[sprintnex] Stage received", {
        stageIndex,
        instructionsLength: stage.instructions.length,
      });

      // 2. Send instructions via promptAsync (fire-and-forget).
      //    DO NOT use session.prompt() — that posts to /session/{sessionID}/message
      //    which can trigger a SECOND prompt from the session page that also
      //    subscribes to the same session's message events.
      console.log("[sprintnex] Sending instructions to Delivery Agent...", {
        stageIndex,
      });
      const parsed = await client.session.promptAsync({
        sessionID: sessionId,
        parts: [{ type: "text", text: stage.instructions }],
        system: DELIVERY_AGENT_PROMPT,
      });
      if (parsed.error) {
        console.warn("[sprintnex] promptAsync error", parsed.error);
      }

      // 3. Poll session snapshot status until it becomes "idle" — this is the
      //    proper completion trigger from OpenWork indicating the agent finished.
      console.log("[sprintnex] Waiting for agent via snapshot status...", {
        stageIndex,
      });
      let agentOutput = "";
      let lastAssistantText = "";
      const pollStartedAt = Date.now();
      const POLL_TIMEOUT_MS = 10 * 60 * 1000;
      while (Date.now() - pollStartedAt < POLL_TIMEOUT_MS) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          if (!serverClient || !mappedWsId) {
            // Fallback: poll messages (legacy path)
            const msgsResult = await client.session.messages({
              sessionID: sessionId,
              limit: 10,
            });
            const msgsData =
              msgsResult &&
              typeof msgsResult === "object" &&
              "data" in msgsResult
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
            lastAssistantText = parts
              .filter(
                (p: unknown) =>
                  p &&
                  typeof p === "object" &&
                  (p as Record<string, unknown>).type === "text",
              )
              .map(
                (p: unknown) => (p as Record<string, unknown>).text as string,
              )
              .filter(Boolean)
              .join("\n");
            if (lastAssistantText) {
              agentOutput = lastAssistantText;
              break;
            }
            continue;
          }

          // Primary path: poll session snapshot for idle status
          const snapshot = await serverClient.getSessionSnapshot(
            mappedWsId,
            sessionId,
          );
          const statusType = snapshot?.item?.status?.type;
          if (statusType === "busy" || statusType === "retry") {
            // Agent still running — keep polling
            continue;
          }
          if (statusType !== "idle") {
            // Unknown status — keep polling
            continue;
          }
          // Session is idle — agent finished. Extract text from the latest
          // assistant message in the snapshot.
          const msgs = snapshot?.item?.messages;
          if (!Array.isArray(msgs)) continue;
          const assistantMsg = [...msgs].reverse().find((m: unknown) => {
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
          lastAssistantText = parts
            .filter(
              (p: unknown) =>
                p &&
                typeof p === "object" &&
                (p as Record<string, unknown>).type === "text",
            )
            .map((p: unknown) => (p as Record<string, unknown>).text as string)
            .filter(Boolean)
            .join("\n");
          if (lastAssistantText) {
            agentOutput = lastAssistantText;
            console.log("[sprintnex] Agent output extracted from snapshot", {
              length: agentOutput.length,
            });
            break;
          }
          // Idle but assistant has no text yet — one more poll
        } catch (err) {
          console.warn("[sprintnex] Snapshot poll error", err);
        }
      }
      console.log("[sprintnex] Agent finished processing stage", {
        stageIndex,
        agentOutputLength: agentOutput.length,
      });

      const completedAt = new Date().toISOString();

      // 4. Notify n8n with the agent's output so the orchestrator can decide
      //    if the previous stage needs to be re-executed.
      try {
        await notifySprintnexStageComplete(taskId, sessionId, {
          status: "COMPLETED",
          exitCode: 0,
          startedAt: loopStartedAt,
          endedAt: completedAt,
          logs: "",
          agentOutput,
        });
        console.log("[sprintnex] Stage complete notified to n8n", {
          stageIndex,
          agentOutputLength: agentOutput.length,
        });
      } catch (err) {
        console.warn("[sprintnex] Failed to notify n8n", err);
      }

      // 5. Mark stage as completed on backend so next poll skips it
      try {
        await markSprintnexStageComplete(taskId, stageIndex);
        console.log("[sprintnex] Stage marked complete on backend", {
          stageIndex,
        });
      } catch (err) {
        console.warn(
          "[sprintnex] Failed to mark stage complete on backend",
          err,
        );
      }

      stageIndex++;
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-dls-bg">
      <div className="shrink-0 border-b border-dls-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#111827] text-white">
              <Workflow size={16} />
            </div>
            <div>
              <h1 className="text-base font-semibold text-dls-text">
                Sprintnex Tasks
              </h1>
              <p className="text-xs text-dls-secondary">
                {scope.projectName || scope.projectId || "No project selected"}
                {scope.teamName ? ` · ${scope.teamName}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/session")}
            >
              <ArrowLeft className="size-4" />
              Back to session
            </Button>
          </div>
        </div>
        <div className="mt-3 inline-flex rounded-lg border border-dls-border bg-dls-surface p-0.5">
          <button
            type="button"
            className={`inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors ${
              activeTab === "intake"
                ? "bg-dls-bg text-dls-text shadow-sm"
                : "text-dls-secondary hover:text-dls-text"
            }`}
            onClick={() => setActiveTab("intake")}
          >
            <MessageSquare className="size-3.5" />
            Intake
          </button>
          <button
            type="button"
            className={`inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors ${
              activeTab === "tasks"
                ? "bg-dls-bg text-dls-text shadow-sm"
                : "text-dls-secondary hover:text-dls-text"
            }`}
            onClick={() => setActiveTab("tasks")}
          >
            <ListChecks className="size-3.5" />
            Tasks
            <Badge variant="outline" className="h-3.5 px-1 text-[9px]">
              {taskCount}
            </Badge>
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col" key={activeTab}>
        {activeTab === "intake" ? (
          <SprintnexIntake onTasksCreated={() => setActiveTab("tasks")} />
        ) : (
          <ProjectTaskHub
            key={scopeVersion}
            workspace={
              scope.projectId
                ? {
                    id: scope.projectId,
                    name: scope.projectName || scope.projectId,
                    displayName: scope.projectName || scope.projectId,
                  }
                : null
            }
            onOpenExecutionSession={handleOpenExecutionSession}
            onTaskCountChange={setTaskCount}
          />
        )}
      </div>
    </div>
  );
}
