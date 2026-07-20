/** @jsxImportSource react */
import { useMemo, useSyncExternalStore } from "react";

export type SprintnexTaskPriority = "low" | "medium" | "high" | "urgent";
export type SprintnexTaskStatus = "draft" | "queued" | "running" | "done" | "blocked";
export type SprintnexTaskExecutionMode = "autonomous" | "guided";

export type SprintnexTaskCreateInput = {
  title: string;
  description: string;
  priority: SprintnexTaskPriority;
  executionMode: SprintnexTaskExecutionMode;
  skills: string;
  mcpRules: string;
  localWorkspacePath?: string;
};

export type SprintnexTaskRecord = SprintnexTaskCreateInput & {
  id: string;
  workspaceId: string;
  sessionId?: string | null;
  executionSessionId?: string | null;
  status: SprintnexTaskStatus;
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY = "sprintnex.tasks.v1";

let taskCache: Map<string, SprintnexTaskRecord> | null = null;
let taskSnapshot: [string, SprintnexTaskRecord][] = [];
const listeners = new Set<() => void>();

const emit = () => {
  taskSnapshot = Array.from(loadTaskCache().entries());
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const loadTaskCache = () => {
  if (taskCache) return taskCache;
  taskCache = new Map<string, SprintnexTaskRecord>();
  if (typeof window === "undefined") {
    taskSnapshot = [];
    return taskCache;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      taskSnapshot = [];
      return taskCache;
    }
    const parsed = JSON.parse(raw) as Record<string, SprintnexTaskRecord>;
    for (const [key, task] of Object.entries(parsed)) {
      if (!key || !task || typeof task !== "object") continue;
      if (typeof task.workspaceId !== "string" || typeof task.title !== "string") continue;
      taskCache.set(task.id || key, task);
    }
    taskSnapshot = Array.from(taskCache.entries());
  } catch {
    return taskCache;
  }
  return taskCache;
};

const persist = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(loadTaskCache())));
  } catch {
    // local task metadata is best-effort until server persistence is wired.
  }
};

const createTaskId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

export const normalizeSprintnexTaskInput = (
  input: Partial<SprintnexTaskCreateInput>,
): SprintnexTaskCreateInput => ({
  title: input.title?.trim() || "Untitled task",
  description: input.description?.trim() || "",
  priority: input.priority ?? "medium",
  executionMode: input.executionMode ?? "guided",
  skills: input.skills?.trim() || "",
  mcpRules: input.mcpRules?.trim() || "",
  localWorkspacePath: input.localWorkspacePath?.trim() || "",
});

export const saveSprintnexTask = (
  workspaceId: string,
  taskId: string,
  input: Partial<SprintnexTaskCreateInput & Pick<SprintnexTaskRecord, "sessionId" | "executionSessionId" | "status" | "createdAt">>,
) => {
  const normalizedWorkspaceId = workspaceId.trim();
  const normalizedTaskId = taskId.trim();
  if (!normalizedWorkspaceId || !normalizedTaskId) return null;

  const now = Date.now();
  const cache = loadTaskCache();
  const existing = cache.get(normalizedTaskId);
  const record: SprintnexTaskRecord = {
    ...(existing ?? {
      id: normalizedTaskId,
      createdAt: now,
      status: "queued" as SprintnexTaskStatus,
    }),
    ...normalizeSprintnexTaskInput(input),
    workspaceId: normalizedWorkspaceId,
    id: existing?.id ?? normalizedTaskId,
    sessionId: input.sessionId ?? input.executionSessionId ?? existing?.sessionId ?? null,
    executionSessionId: input.executionSessionId ?? input.sessionId ?? existing?.executionSessionId ?? null,
    status: input.status ?? existing?.status ?? "queued",
    updatedAt: now,
  };

  cache.set(record.id, record);
  persist();
  emit();
  return record;
};

export const createSprintnexTask = (
  workspaceId: string,
  input: Partial<SprintnexTaskCreateInput>,
) => saveSprintnexTask(workspaceId, createTaskId(), input);

export const updateSprintnexTask = (
  taskId: string,
  patch: Partial<SprintnexTaskCreateInput & Pick<SprintnexTaskRecord, "sessionId" | "executionSessionId" | "status">>,
) => {
  const id = taskId.trim();
  if (!id) return null;
  const existing = loadTaskCache().get(id);
  if (!existing) return null;
  return saveSprintnexTask(existing.workspaceId, id, { ...existing, ...patch });
};

export const cacheSprintnexTasks = (tasks: SprintnexTaskRecord[]) => {
  if (!tasks.length) return;
  const cache = loadTaskCache();
  for (const task of tasks) {
    if (!task.id?.trim() || !task.workspaceId?.trim()) continue;
    cache.set(task.id, task);
  }
  persist();
  emit();
};

export const removeSprintnexTask = (taskOrSessionId: string | null | undefined) => {
  const id = taskOrSessionId?.trim() ?? "";
  if (!id) return;
  const cache = loadTaskCache();
  const directDeleted = cache.delete(id);
  const matched = directDeleted ? [] : Array.from(cache.entries()).filter(([, task]) =>
    task.sessionId === id || task.executionSessionId === id
  );
  for (const [taskId] of matched) cache.delete(taskId);
  if (!directDeleted && matched.length === 0) return;
  persist();
  emit();
};

export const getSprintnexTask = (sessionId: string | null | undefined) => {
  const id = sessionId?.trim() ?? "";
  if (!id) return null;
  const direct = loadTaskCache().get(id);
  if (direct) return direct;
  return Array.from(loadTaskCache().values()).find((task) =>
    task.sessionId === id || task.executionSessionId === id
  ) ?? null;
};

export const getSprintnexTasksForWorkspace = (workspaceId: string) => {
  const id = workspaceId.trim();
  if (!id) return [];
  return Array.from(loadTaskCache().values()).filter((task) => task.workspaceId === id);
};

export const buildSprintnexExecutionPrompt = (task: SprintnexTaskCreateInput) => {
  const sections = [
    `Task title: ${task.title}`,
    task.description ? `Task description:\n${task.description}` : "",
    `Priority: ${task.priority}`,
    `Execution mode: ${task.executionMode}`,
    task.skills ? `Skills:\n${task.skills}` : "",
    task.mcpRules ? `MCP rules:\n${task.mcpRules}` : "",
  ].filter(Boolean);

  return [
    "You are executing a Sprintnex task. Treat the following as the task contract.",
    "",
    sections.join("\n\n"),
  ].join("\n");
};

export function useSprintnexTask(sessionId: string | null | undefined) {
  const id = sessionId?.trim() ?? "";
  return useSyncExternalStore(
    subscribe,
    () => (id ? getSprintnexTask(id) : null),
    () => null,
  );
}

export function useSprintnexTasksForWorkspace(workspaceId: string | null | undefined) {
  const id = workspaceId?.trim() ?? "";
  const snapshot = useSyncExternalStore(
    subscribe,
    () => {
      loadTaskCache();
      return taskSnapshot;
    },
    () => [],
  );

  return useMemo(
    () => snapshot.map(([, task]) => task).filter((task) => task.workspaceId === id),
    [id, snapshot],
  );
}

export function useSprintnexTasksBySession() {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => {
      loadTaskCache();
      return taskSnapshot;
    },
    () => [],
  );

  return useMemo(() => new Map(snapshot), [snapshot]);
}
