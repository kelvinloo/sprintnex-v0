/** @jsxImportSource react */
import { useCallback, useEffect, useRef, useState } from "react";
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

export function SprintnexTasksPage() {
  const navigate = useNavigate();
  const [scopeVersion, setScopeVersion] = useState(0);
  const [activeTab, setActiveTab] = useState<"tasks" | "intake">("intake");
  const [taskCount, setTaskCount] = useState(0);
  const intakeRefreshRef = useRef<(() => void) | null>(null);

  const scope = readSprintnexAicoeScope();

  useEffect(() => {
    const handler = () => setScopeVersion((v) => v + 1);
    window.addEventListener("sprintnex-workspace-scope-changed", handler);
    return () =>
      window.removeEventListener("sprintnex-workspace-scope-changed", handler);
  }, []);

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

        // Start the multi-stage execution loop in the background
        executeStageLoop(task.taskId, sessionId, opencodeClient).catch(
          () => {},
        );
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
   */
  async function executeStageLoop(
    taskId: string,
    sessionId: string,
    client: ReturnType<typeof createClient>,
  ) {
    const {
      pollSprintnexTaskStage,
      markSprintnexStageComplete,
      notifySprintnexStageComplete,
    } = await import("@/app/lib/sprintnex-aicoe-api");

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

      // 2. Inject instructions with the Delivery Agent system prompt and WAIT
      try {
        console.log("[sprintnex] Sending instructions to Delivery Agent...", {
          stageIndex,
        });
        await client.session.prompt({
          sessionID: sessionId,
          parts: [{ type: "text", text: stage.instructions }],
          system: DELIVERY_AGENT_PROMPT,
        });
        console.log("[sprintnex] Agent finished processing stage", {
          stageIndex,
        });
      } catch (err) {
        console.warn("[sprintnex] Agent stage processing failed", err);
      }

      // 3. Wait for the agent to process the stage instructions.
      const completedAt = new Date().toISOString();

      // 4. Notify n8n that this stage is complete
      try {
        await notifySprintnexStageComplete(taskId, sessionId, {
          status: "COMPLETED",
          exitCode: 0,
          startedAt: loopStartedAt,
          endedAt: completedAt,
          logs: "",
        });
        console.log("[sprintnex] Stage complete notified to n8n", {
          stageIndex,
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/session")}
          >
            <ArrowLeft className="size-4" />
            Back to session
          </Button>
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
