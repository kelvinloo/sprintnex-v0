/** @jsxImportSource react */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  ListChecks,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Search,
  StopCircle,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SprintnexAicoeTaskStatus,
  bulkUpdateSprintnexTaskStatus,
  getSprintnexAicoeTask,
  getSprintnexTeamSpaces,
  getSprintnexWorkspaces,
  listSprintnexAicoeTasks,
  readSprintnexAicoeScope,
  startSprintnexTask,
  updateSprintnexTaskStatus,
  writeSprintnexWorkspaceScope,
  type SprintnexAicoeTask,
  type SprintnexAicoeScope,
  type SprintnexTeamSpaceNode,
  type SprintnexTenantWorkspaceNode,
} from "@/app/lib/sprintnex-aicoe-api";
import { useSessionActivityStore } from "@/react-app/domains/session/status/session-activity-store";
type ProjectTaskHubWorkspace = {
  id: string;
  displayName?: string;
  name?: string;
  path?: string;
};

type ProjectTaskHubProps = {
  workspace: ProjectTaskHubWorkspace | null;
  busy?: boolean;
  onOpenExecutionSession: (task: SprintnexAicoeTask) => Promise<unknown> | void;
  onNewChat?: () => void;
  onTaskCountChange?: (count: number) => void;
};

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: SprintnexAicoeTaskStatus.APPROVED, label: "Approved" },
  { key: SprintnexAicoeTaskStatus.IN_PROGRESS, label: "In Progress" },
  { key: SprintnexAicoeTaskStatus.BLOCKED, label: "Blocked" },
  { key: SprintnexAicoeTaskStatus.ON_HOLD, label: "On Hold" },
  { key: SprintnexAicoeTaskStatus.FAILED, label: "Failed" },
  { key: SprintnexAicoeTaskStatus.CANCELLED, label: "Cancelled" },
  { key: SprintnexAicoeTaskStatus.COMPLETED, label: "Done" },
] as const;

const STATUS_LABELS: Record<SprintnexAicoeTaskStatus, string> = {
  APPROVED: "Approved",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Done",
  BLOCKED: "Blocked",
  ON_HOLD: "On Hold",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

const STATUS_CLASSES: Record<SprintnexAicoeTaskStatus, string> = {
  APPROVED: "border-amber-7/40 bg-amber-2/50 text-amber-11",
  IN_PROGRESS: "border-blue-7/40 bg-blue-2/50 text-blue-11",
  COMPLETED: "border-green-7/40 bg-green-2/50 text-green-11",
  BLOCKED: "border-red-7/40 bg-red-2/50 text-red-11",
  ON_HOLD: "border-dls-border bg-dls-bg text-dls-secondary",
  FAILED: "border-red-7/40 bg-red-2/50 text-red-11",
  CANCELLED: "border-dls-border bg-dls-bg text-dls-tertiary",
};

const PRIORITY_CLASSES: Record<string, string> = {
  CRITICAL: "text-red-11",
  HIGH: "text-orange-11",
  MEDIUM: "text-blue-11",
  LOW: "text-green-11",
};

const PAGE_SIZE = 200;
const TERMINAL_STATUSES = new Set<SprintnexAicoeTaskStatus>([
  SprintnexAicoeTaskStatus.COMPLETED,
  SprintnexAicoeTaskStatus.FAILED,
  SprintnexAicoeTaskStatus.CANCELLED,
  SprintnexAicoeTaskStatus.BLOCKED,
  SprintnexAicoeTaskStatus.ON_HOLD,
]);

function shortId(id?: string) {
  return id?.slice(0, 8) || "-";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function includesQuery(task: SprintnexAicoeTask, query: string) {
  if (!query) return true;
  const q = query.toLowerCase();
  return [
    task.taskId,
    task.title,
    task.description,
    task.role,
    task.priority,
    ...(task.acceptanceCriteria ?? []),
    ...(task.risks ?? []),
  ].some((value) => value?.toLowerCase().includes(q));
}

export function ProjectTaskHub(props: ProjectTaskHubProps) {
  const [tasks, setTasks] = useState<SprintnexAicoeTask[]>([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<SprintnexAicoeScope>(() =>
    readSprintnexAicoeScope(),
  );
  const [teamSpaces, setTeamSpaces] = useState<SprintnexTeamSpaceNode[]>([]);
  const [projects, setProjects] = useState<SprintnexTenantWorkspaceNode[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [activeStatusTab, setActiveStatusTab] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionBusy, setActionBusy] = useState(false);
  const taskPollRef = useRef<number | null>(null);

  const selectedProjectName =
    scope.projectName ||
    projects.find((project) => project.id === scope.projectId)?.name ||
    "";
  const selectedTeamName =
    scope.teamName ||
    teamSpaces.find((team) => team.id === scope.teamId)?.name ||
    "";
  const workspaceLabel =
    selectedProjectName ||
    props.workspace?.displayName ||
    props.workspace?.name ||
    "Selected project";
  const missingScopeFields = useMemo(
    () =>
      [
        !scope.organizationId ? "organizationId" : "",
        !scope.teamId ? "teamId" : "",
        !scope.projectId ? "projectId" : "",
        !scope.userId ? "userId" : "",
      ].filter(Boolean),
    [scope.organizationId, scope.projectId, scope.teamId, scope.userId],
  );
  const missingScopeMessage = missingScopeFields.length
    ? `Missing required Sprintnex context: ${missingScopeFields.join(", ")}. Select a project in the left sidebar and sign in again if userId is missing.`
    : "";
  const scopeReady = missingScopeFields.length === 0;
  const ensureScopeReady = useCallback(() => {
    return scopeReady;
  }, [scopeReady]);
  const missingScopeWarning =
    missingScopeFields.length > 0
      ? `Missing Sprintnex context: ${missingScopeFields.join(", ")}. Select a project in the left sidebar.`
      : null;

  useEffect(() => {
    let cancelled = false;
    const loadAll = async () => {
      // ── Step 1: load scope (team-spaces + workspaces) ──
      try {
        const [teams, workspaceData] = await Promise.all([
          getSprintnexTeamSpaces(),
          getSprintnexWorkspaces(),
        ]);
        if (cancelled) return;
        setTeamSpaces(teams);
        setProjects(workspaceData);
        const current = readSprintnexAicoeScope();
        const selectedTeamStillValid = teams.some(
          (team) => team.id === current.teamId,
        );
        const nextTeamId = selectedTeamStillValid
          ? current.teamId
          : teams[0]?.id || "";
        const scoped = workspaceData.filter(
          (project) => project.teamSpaceId === nextTeamId,
        );
        const selectedProjectStillValid = scoped.some(
          (project) => project.id === current.projectId,
        );
        const nextProject = selectedProjectStillValid
          ? (scoped.find((project) => project.id === current.projectId) ?? null)
          : (scoped[0] ?? null);
        // Read scope — don't write it (sidebar owns scope writing)
        const nextScope = {
          ...current,
          teamId: nextTeamId,
          teamName:
            teams.find((team) => team.id === nextTeamId)?.name ||
            current.teamName ||
            "",
          projectId: nextProject?.id || "",
          projectName: nextProject?.name || current.projectName || "",
          organizationId:
            nextProject?.organizationId ||
            teams.find((team) => team.id === nextTeamId)?.organizationId ||
            current.organizationId,
        };
        if (cancelled) return;
        setScope(nextScope);

        // ── Step 2: fetch tasks AFTER scope is ready (no concurrency) ──
        const hasScope = ![
          nextScope.organizationId,
          nextScope.teamId,
          nextScope.projectId,
          nextScope.userId,
        ].some((v) => !v);
        if (!hasScope) return;
        setLoading(true);
        setError(null);
        try {
          const result = await listSprintnexAicoeTasks({
            teamSpaceId: nextScope.teamId || undefined,
            workspaceId: nextScope.projectId || undefined,
            limit: PAGE_SIZE,
            offset: 0,
          });
          if (cancelled) return;
          setTasks(result.tasks);
          setTotalTasks(result.total);
          setSelectedIdx(result.tasks.length ? 0 : -1);
          props.onTaskCountChange?.(result.total);
        } catch (err) {
          if (!cancelled)
            setError(
              err instanceof Error ? err.message : "Failed to load tasks",
            );
        } finally {
          if (!cancelled) setLoading(false);
        }
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load project context",
          );
      }
    };
    void loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const readNext = () => {
      const next = readSprintnexAicoeScope();
      setScope((current) =>
        current.teamId === next.teamId &&
        current.teamName === next.teamName &&
        current.projectId === next.projectId &&
        current.projectName === next.projectName &&
        current.organizationId === next.organizationId &&
        current.userId === next.userId &&
        current.tenantId === next.tenantId
          ? current
          : next,
      );
    };
    window.addEventListener("sprintnex-workspace-scope-changed", readNext);
    const interval = window.setInterval(readNext, 1500);
    return () => {
      window.removeEventListener("sprintnex-workspace-scope-changed", readNext);
      window.clearInterval(interval);
    };
  }, []);

  const fetchTasks = useCallback(async () => {
    if (!scopeReady) {
      setTasks([]);
      setTotalTasks(0);
      setSelectedIdx(-1);
      setError(missingScopeMessage);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await listSprintnexAicoeTasks({
        teamSpaceId: scope.teamId || undefined,
        workspaceId: scope.projectId || undefined,
        limit: PAGE_SIZE,
        offset: 0,
      });
      setTasks(result.tasks);
      setTotalTasks(result.total);
      setSelectedIdx(result.tasks.length ? 0 : -1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [missingScopeMessage, scope.projectId, scope.teamId, scopeReady]);

  const loadMoreTasks = async () => {
    if (!ensureScopeReady()) return;
    if (loadingMore || tasks.length >= totalTasks) return;
    try {
      setLoadingMore(true);
      const result = await listSprintnexAicoeTasks({
        teamSpaceId: scope.teamId || undefined,
        workspaceId: scope.projectId || undefined,
        limit: PAGE_SIZE,
        offset: tasks.length,
      });
      setTasks((current) => [...current, ...result.tasks]);
      setTotalTasks(result.total);
    } finally {
      setLoadingMore(false);
    }
  };

  const roles = useMemo(
    () => [...new Set(tasks.map((task) => task.role).filter(Boolean))].sort(),
    [tasks],
  );
  const priorities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

  const filtered = useMemo(
    () =>
      tasks.filter((task) => {
        if (activeStatusTab && task.status !== activeStatusTab) return false;
        if (roleFilter && task.role !== roleFilter) return false;
        if (priorityFilter && task.priority !== priorityFilter) return false;
        return includesQuery(task, query.trim());
      }),
    [activeStatusTab, priorityFilter, query, roleFilter, tasks],
  );

  const selected =
    selectedIdx >= 0
      ? (filtered[selectedIdx] ?? filtered[0] ?? null)
      : (filtered[0] ?? null);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        STATUS_TABS.map(({ key }) => [
          key,
          key
            ? tasks.filter((task) => task.status === key).length
            : tasks.length,
        ]),
      ) as Record<string, number>,
    [tasks],
  );

  const refreshTaskInList = useCallback(async (taskId: string) => {
    const updated = await getSprintnexAicoeTask(taskId);
    setTasks((current) =>
      current.map((task) => (task.taskId === taskId ? updated : task)),
    );
    return updated;
  }, []);

  const pollTaskExecution = useCallback(
    (taskId: string) => {
      if (taskPollRef.current !== null) {
        window.clearInterval(taskPollRef.current);
        taskPollRef.current = null;
      }

      let keepPolling = true;
      const poll = async () => {
        if (!keepPolling) return;
        try {
          const updated = await refreshTaskInList(taskId);
          if (TERMINAL_STATUSES.has(updated.status)) {
            keepPolling = false;
            if (taskPollRef.current !== null) {
              window.clearInterval(taskPollRef.current);
              taskPollRef.current = null;
            }
          }
        } catch {
          // Keep polling; execution status endpoints can lag while workflows start.
        }
      };

      void poll();
      taskPollRef.current = window.setInterval(() => {
        if (keepPolling) void poll();
      }, 5000);
    },
    [refreshTaskInList],
  );

  useEffect(
    () => () => {
      if (taskPollRef.current !== null) {
        window.clearInterval(taskPollRef.current);
        taskPollRef.current = null;
      }
    },
    [],
  );

  const startSelected = async () => {
    if (!ensureScopeReady()) return;
    if (!selected) return;
    setActionBusy(true);
    try {
      const startResult = (await startSprintnexTask(selected.taskId)) as Record<
        string,
        unknown
      >;
      const jobId =
        startResult?.data && typeof startResult.data === "object"
          ? ((startResult.data as Record<string, unknown>).jobId as string)
          : "";
      if (jobId) {
        try {
          sessionStorage.setItem("sprintnex.lastStartedJobId", jobId);
          sessionStorage.setItem(
            "sprintnex.lastStartedTaskId",
            selected.taskId,
          );
        } catch {
          /* not critical */
        }
      }
      await fetchTasks();
      pollTaskExecution(selected.taskId);
      await props.onOpenExecutionSession(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Start failed");
    } finally {
      setActionBusy(false);
    }
  };

  const updateSelectedStatus = async (status: SprintnexAicoeTaskStatus) => {
    if (!ensureScopeReady()) return;
    if (!selected) return;
    setActionBusy(true);
    try {
      if (status === SprintnexAicoeTaskStatus.IN_PROGRESS) {
        await startSelected();
        return;
      }
      await updateSprintnexTaskStatus(selected.taskId, status);
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed");
    } finally {
      setActionBusy(false);
    }
  };

  const updateBulkStatus = async (status: SprintnexAicoeTaskStatus) => {
    if (!ensureScopeReady()) return;
    const ids = [...selectedIds];
    if (!ids.length) return;
    setActionBusy(true);
    try {
      await bulkUpdateSprintnexTaskStatus(ids, status);
      setSelectedIds(new Set());
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk update failed");
    } finally {
      setActionBusy(false);
    }
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-dls-bg"
      style={{ overflowY: "auto" }}
    >
      <div className="shrink-0 border-b border-dls-border px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-normal text-dls-secondary">
              Project workspace
            </p>
            <h1 className="mt-1 text-xl font-semibold text-dls-text">
              {workspaceLabel}
            </h1>
            <p className="mt-1 text-xs text-dls-secondary">
              Team {selectedTeamName || scope.teamId || "not selected"} ·
              Project {selectedProjectName || scope.projectId || "not selected"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {props.onNewChat ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => props.onNewChat?.()}
              >
                <MessageSquare className="size-4" />
                New Chat
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadJson(tasks, "tasks.json")}
            >
              <Download className="size-4" />
              Export
            </Button>
          </div>
        </div>
        <div className="mt-4">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-dls-text">
            <ListChecks className="size-4" />
            Tasks
            <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
              {tasks.length}
            </Badge>
          </span>
        </div>
      </div>

      {error ? (
        <div className="shrink-0 border-b border-red-7/30 bg-red-2/50 px-6 py-3 text-sm text-red-11">
          {error}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col px-6 py-5">
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <div className="relative min-w-64 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dls-secondary" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter tasks..."
              className="pl-9"
            />
          </div>
          <select
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
          >
            <option value="">All roles</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
          >
            <option value="">All priorities</option>
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            onClick={() => void fetchTasks()}
            disabled={loading}
          >
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </div>

        <div className="mt-4 flex shrink-0 gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-md border px-3 text-sm ${activeStatusTab === tab.key ? "border-dls-text bg-dls-text text-dls-bg" : "border-dls-border bg-dls-surface text-dls-secondary hover:text-dls-text"}`}
              onClick={() => {
                setActiveStatusTab(tab.key);
                setSelectedIdx(0);
              }}
            >
              {tab.label}
              <span className="text-xs opacity-75">{counts[tab.key] ?? 0}</span>
            </button>
          ))}
        </div>

        <div
          className="mt-4"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(320px,520px) 1fr",
            gap: "1rem",
            minHeight: 0,
            flex: 1,
          }}
        >
          <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-dls-border bg-dls-surface">
            <div className="flex items-center justify-between border-b border-dls-border px-4 py-2 text-xs text-dls-secondary">
              <button
                type="button"
                onClick={() =>
                  setSelectedIds(
                    selectedIds.size === filtered.length
                      ? new Set()
                      : new Set(filtered.map((task) => task.taskId)),
                  )
                }
              >
                {selectedIds.size
                  ? `${selectedIds.size} selected`
                  : "Select tasks"}
              </button>
              <span>
                {loading ? "Loading..." : `${filtered.length} visible`}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {filtered.length ? (
                filtered.map((task, index) => (
                  <button
                    key={task.taskId}
                    type="button"
                    className={`block w-full border-b border-dls-border px-4 py-3 text-left last:border-b-0 ${selected?.taskId === task.taskId ? "bg-dls-bg" : "hover:bg-dls-bg/70"}`}
                    onClick={() => setSelectedIdx(index)}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(task.taskId)}
                        onChange={() => toggleTaskSelection(task.taskId)}
                        onClick={(event) => event.stopPropagation()}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <span className="line-clamp-2 text-sm font-medium text-dls-text">
                            {task.title}
                          </span>
                          <Badge
                            variant="outline"
                            className={STATUS_CLASSES[task.status]}
                          >
                            {STATUS_LABELS[task.status]}
                          </Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-dls-secondary">
                          {task.description || "No description"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-dls-tertiary">
                          <span>#{shortId(task.taskId)}</span>
                          <span className={PRIORITY_CLASSES[task.priority]}>
                            {task.priority}
                          </span>
                          <span>{task.role}</span>
                          <span>{formatDateTime(task.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-6 text-sm text-dls-secondary">
                  No tasks in this scope.
                </div>
              )}
            </div>
            {tasks.length < totalTasks ? (
              <div className="shrink-0 border-t border-dls-border p-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => void loadMoreTasks()}
                  disabled={loadingMore}
                >
                  Load More ({tasks.length} of {totalTasks} tasks)
                </Button>
              </div>
            ) : null}
          </div>

          <div className="min-h-0 overflow-auto rounded-lg border border-dls-border bg-dls-surface p-5">
            {selected ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Badge
                      variant="outline"
                      className={STATUS_CLASSES[selected.status]}
                    >
                      {STATUS_LABELS[selected.status]}
                    </Badge>
                    <h2 className="mt-3 text-lg font-semibold text-dls-text">
                      {selected.title}
                    </h2>
                    <p className="mt-1 text-xs text-dls-secondary">
                      Task {shortId(selected.taskId)} · {selected.role}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setSelectedIdx((idx) =>
                          idx <= 0 ? filtered.length - 1 : idx - 1,
                        )
                      }
                    >
                      <ArrowLeft className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setSelectedIdx((idx) =>
                          idx >= filtered.length - 1 ? 0 : idx + 1,
                        )
                      }
                    >
                      <ArrowRight className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void startSelected()}
                      disabled={actionBusy || props.busy}
                    >
                      <PlayCircle className="size-4" />
                      Start
                    </Button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-dls-secondary">
                  {selected.description || "No description"}
                </p>
                <div className="grid gap-3 text-sm sm:grid-cols-3">
                  <div className="rounded-lg border border-dls-border bg-dls-bg p-3">
                    <p className="text-xs text-dls-secondary">Priority</p>
                    <p
                      className={`mt-1 font-medium ${PRIORITY_CLASSES[selected.priority]}`}
                    >
                      {selected.priority}
                    </p>
                  </div>
                  <div className="rounded-lg border border-dls-border bg-dls-bg p-3">
                    <p className="text-xs text-dls-secondary">Progress</p>
                    <p className="mt-1 font-medium text-dls-text">
                      {selected.progress ?? 0}%
                    </p>
                  </div>
                  <div className="rounded-lg border border-dls-border bg-dls-bg p-3">
                    <p className="text-xs text-dls-secondary">Estimate</p>
                    <p className="mt-1 font-medium text-dls-text">
                      {selected.estimateHours ?? "-"}h
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void updateSelectedStatus(
                        SprintnexAicoeTaskStatus.APPROVED,
                      )
                    }
                  >
                    <CheckCircle2 className="size-4" />
                    Approve
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void updateSelectedStatus(
                        SprintnexAicoeTaskStatus.BLOCKED,
                      )
                    }
                  >
                    <StopCircle className="size-4" />
                    Block
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void updateSelectedStatus(
                        SprintnexAicoeTaskStatus.ON_HOLD,
                      )
                    }
                  >
                    <PauseCircle className="size-4" />
                    Hold
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void updateSelectedStatus(
                        SprintnexAicoeTaskStatus.COMPLETED,
                      )
                    }
                  >
                    <CheckCircle2 className="size-4" />
                    Complete
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void updateSelectedStatus(
                        SprintnexAicoeTaskStatus.CANCELLED,
                      )
                    }
                  >
                    <XCircle className="size-4" />
                    Cancel
                  </Button>
                </div>
                {selectedIds.size ? (
                  <div className="rounded-lg border border-dls-border bg-dls-bg p-3">
                    <p className="mb-2 text-xs font-medium text-dls-secondary">
                      Bulk status
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void updateBulkStatus(
                            SprintnexAicoeTaskStatus.COMPLETED,
                          )
                        }
                      >
                        Done
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void updateBulkStatus(
                            SprintnexAicoeTaskStatus.IN_PROGRESS,
                          )
                        }
                      >
                        In Progress
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void updateBulkStatus(
                            SprintnexAicoeTaskStatus.APPROVED,
                          )
                        }
                      >
                        Approved
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-sm text-dls-secondary">
                Select a task to review details.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
