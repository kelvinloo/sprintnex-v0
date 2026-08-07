export enum SprintnexAicoeTaskStatus {
  APPROVED = "APPROVED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  BLOCKED = "BLOCKED",
  ON_HOLD = "ON_HOLD",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export type SprintnexAicoeTask = {
  taskId: string;
  id?: string;
  title: string;
  description?: string;
  role: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: SprintnexAicoeTaskStatus;
  estimateHours?: number;
  progress?: number;
  notes?: string;
  assignee?: string | null;
  tags?: string[];
  content?: Record<string, unknown>;
  acceptanceCriteria?: string[];
  userStories?: string[];
  risks?: string[];
  repositories?: string[];
  gitProvider?: string;
  deliveryPlan?: string;
  jobId?: string;
  proposalId?: string;
  createdAt: string;
  updatedAt: string;
};

export type SprintnexAicoeScope = {
  teamId: string;
  teamName?: string;
  projectId: string;
  projectName?: string;
  organizationId: string;
  userId: string;
  tenantId: string;
};

export type SprintnexTeamSpaceNode = {
  id: string;
  tenantId?: string;
  organizationId?: string;
  name: string;
  description?: string;
  visibility?: string;
  status?: string;
};

export type SprintnexTenantWorkspaceNode = {
  id: string;
  tenantId?: string;
  organizationId?: string | null;
  teamSpaceId?: string | null;
  ownerUserId?: string;
  name: string;
  description?: string;
  workspaceType?: string;
  visibility?: string;
  status?: string;
  metadata?: Record<string, unknown> | null;
  gitRepositories?: string[];
};

export type SprintnexManualTaskRequest = {
  title: string;
  description?: string;
  stage?: string;
  priority?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  estimatedHours?: number;
  assignee?: string;
  tags?: string[];
  acceptanceCriteria?: string[];
  notes?: string;
  targetBranch?: string;
};

export type SprintnexDepartmentSession = {
  chatId: string;
  sessionId: string;
  correlationId: string;
  createdAt: string;
  name?: string;
};

export type SprintnexDepartmentMessage = {
  id?: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
};

import type { Agent } from "@opencode-ai/sdk/v2/client";

import {
  API_ROOT,
  AICOE_BASE,
  AUTH_BASE,
  DEFAULT_API_ROOT,
} from "./api-config";

const PROJECT_LOCAL_PATHS_KEY = "sprintnex.projectLocalPaths.v1";

function storageGet(key: string): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(key) || "";
}

export function readSprintnexAicoeScope(): SprintnexAicoeScope {
  return {
    teamId: storageGet("selected_team_id") || storageGet("engineering_team_id"),
    teamName:
      storageGet("selected_team_name") ||
      storageGet("engineering_team_name") ||
      undefined,
    projectId:
      storageGet("selected_project_id") || storageGet("engineering_project_id"),
    projectName:
      storageGet("selected_project_name") ||
      storageGet("engineering_project_name") ||
      undefined,
    organizationId:
      storageGet("selected_organization_id") || storageGet("organization_id"),
    userId: storageGet("userId"),
    tenantId: storageGet("tenantId") || "default",
  };
}

export function writeSprintnexProjectScope(projectId: string): void {
  if (typeof window === "undefined") return;
  const id = projectId.trim();
  window.localStorage.setItem("selected_project_id", id);
  window.localStorage.setItem("engineering_project_id", id);
}

export function writeSprintnexWorkspaceScope(input: {
  teamId?: string;
  teamName?: string | null;
  projectId?: string;
  projectName?: string | null;
  organizationId?: string | null;
  userId?: string | null;
}): void {
  if (typeof window === "undefined") return;
  const teamId = input.teamId?.trim() || "";
  const teamName = input.teamName?.trim() || "";
  const projectId = input.projectId?.trim() || "";
  const projectName = input.projectName?.trim() || "";
  const organizationId = input.organizationId?.trim() || "";
  const userId = input.userId?.trim() || "";
  window.localStorage.setItem("selected_team_id", teamId);
  window.localStorage.setItem("engineering_team_id", teamId);
  window.localStorage.setItem("selected_team_name", teamName);
  window.localStorage.setItem("engineering_team_name", teamName);
  window.localStorage.setItem("selected_project_id", projectId);
  window.localStorage.setItem("engineering_project_id", projectId);
  window.localStorage.setItem("selected_project_name", projectName);
  window.localStorage.setItem("engineering_project_name", projectName);
  window.localStorage.setItem("selected_organization_id", organizationId);
  window.localStorage.setItem("organization_id", organizationId);
  if (userId) window.localStorage.setItem("userId", userId);
  window.dispatchEvent(new Event("sprintnex-workspace-scope-changed"));
}

function readProjectPathMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PROJECT_LOCAL_PATHS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).flatMap(
        ([key, value]) => {
          const path = typeof value === "string" ? value.trim() : "";
          return key.trim() && path ? [[key, path]] : [];
        },
      ),
    );
  } catch {
    return {};
  }
}

export function readSprintnexProjectLocalPath(projectId: string): string {
  const id = projectId.trim();
  if (!id) return "";
  return readProjectPathMap()[id] || "";
}

export function writeSprintnexProjectLocalPath(
  projectId: string,
  localPath: string,
): void {
  if (typeof window === "undefined") return;
  const id = projectId.trim();
  if (!id) return;
  const next = readProjectPathMap();
  const path = localPath.trim();
  if (path) next[id] = path;
  else delete next[id];
  window.localStorage.setItem(PROJECT_LOCAL_PATHS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("sprintnex-project-local-path-changed"));
}

const PROJECT_WORKSPACE_MAP_KEY = "sprintnex.projectWorkspaceMap.v1";

function readProjectWorkspaceMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PROJECT_WORKSPACE_MAP_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([key, value]) => {
        const wsId = typeof value === "string" ? value.trim() : "";
        return key.trim() && wsId ? [[key, wsId]] : [];
      }),
    );
  } catch {
    return {};
  }
}

export function getMappedWorkspaceForSprintnexProject(
  projectId: string,
): string {
  const id = projectId.trim();
  if (!id) return "";
  return readProjectWorkspaceMap()[id] || "";
}

export function mapSprintnexProjectToWorkspace(
  projectId: string,
  workspaceId: string,
): void {
  if (typeof window === "undefined") return;
  const pid = projectId.trim();
  const wid = workspaceId.trim();
  if (!pid || !wid) return;
  const next = readProjectWorkspaceMap();
  next[pid] = wid;
  window.localStorage.setItem(PROJECT_WORKSPACE_MAP_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("sprintnex-project-workspace-map-changed"));
}

/** Refresh the access token using the stored refresh token. */
async function refreshTokenFromStorage(): Promise<string> {
  const refreshToken = storageGet("refresh_token");
  if (!refreshToken) throw new Error("No refresh token");

  const res = await fetch(`${AUTH_BASE}/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Tenant-Id": "default" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  const data = JSON.parse(await res.text()) as {
    accessToken?: string;
    token?: string;
    refreshToken?: string;
    expiresIn?: number;
  };
  const newToken = data.accessToken || data.token || "";
  if (!newToken) throw new Error("Refresh returned no token");
  const newRefresh = data.refreshToken || refreshToken;
  const expiresIn =
    typeof data.expiresIn === "number" ? data.expiresIn : 24 * 60 * 60;
  window.localStorage.setItem("auth_token", newToken);
  window.localStorage.setItem("accessToken", newToken);
  window.localStorage.setItem("refresh_token", newRefresh);
  window.localStorage.setItem(
    "token_expiry",
    String(Date.now() + expiresIn * 1000),
  );
  return newToken;
}

/** Get a valid access token, refreshing if the stored one is expired. */
export async function getValidSprintnexToken(): Promise<string> {
  const token = storageGet("auth_token") || storageGet("accessToken");
  const expiry = storageGet("token_expiry");
  if (token && expiry && Date.now() > Number(expiry) - 5 * 60 * 1000) {
    try {
      return await refreshTokenFromStorage();
    } catch {
      /* fall through */
    }
  }
  if (token) return token;
  throw new Error("No access token available");
}

export async function refreshSprintnexToken(): Promise<string> {
  return refreshTokenFromStorage();
}

async function authHeaders(): Promise<Record<string, string>> {
  let token: string;
  try {
    token = await getValidSprintnexToken();
  } catch {
    token = "";
  }
  const scope = readSprintnexAicoeScope();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Tenant-Id": scope.tenantId,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (scope.teamId) headers["X-Team-Space-Id"] = scope.teamId;
  if (scope.projectId) headers["X-Workspace-Id"] = scope.projectId;
  if (scope.organizationId) headers["X-Organization-Id"] = scope.organizationId;
  if (scope.userId) headers["X-User-Id"] = scope.userId;
  return headers;
}

function normalizeStatus(value: unknown): SprintnexAicoeTaskStatus {
  if (value === "DONE") return SprintnexAicoeTaskStatus.COMPLETED;
  if (
    typeof value === "string" &&
    Object.values(SprintnexAicoeTaskStatus).includes(
      value as SprintnexAicoeTaskStatus,
    )
  ) {
    return value as SprintnexAicoeTaskStatus;
  }
  return SprintnexAicoeTaskStatus.APPROVED;
}

function normalizeTask(rawInput: unknown): SprintnexAicoeTask {
  const raw =
    rawInput && typeof rawInput === "object" && !Array.isArray(rawInput)
      ? (rawInput as Record<string, unknown>)
      : {};
  const content =
    raw.content &&
    typeof raw.content === "object" &&
    !Array.isArray(raw.content)
      ? (raw.content as Record<string, unknown>)
      : {};
  const taskId = String(raw.taskId || raw.id || "");
  return {
    id: typeof raw.id === "string" ? raw.id : undefined,
    taskId,
    title:
      typeof raw.title === "string" && raw.title.trim()
        ? raw.title
        : "Untitled Task",
    description: typeof raw.description === "string" ? raw.description : "",
    role: String(raw.role || raw.assignee || raw.stage || "Unassigned"),
    priority: (raw.priority ||
      content.priority ||
      "MEDIUM") as SprintnexAicoeTask["priority"],
    status: normalizeStatus(raw.status),
    estimateHours:
      typeof raw.estimateHours === "number"
        ? raw.estimateHours
        : typeof raw.estimatedHours === "number"
          ? raw.estimatedHours
          : undefined,
    progress: typeof raw.progress === "number" ? raw.progress : undefined,
    notes: typeof raw.notes === "string" ? raw.notes : undefined,
    assignee: typeof raw.assignee === "string" ? raw.assignee : null,
    tags: Array.isArray(raw.tags)
      ? raw.tags.filter((item): item is string => typeof item === "string")
      : [],
    content,
    acceptanceCriteria: Array.isArray(content.acceptanceCriteria)
      ? content.acceptanceCriteria.filter(
          (item): item is string => typeof item === "string",
        )
      : undefined,
    userStories: Array.isArray(content.userStories)
      ? content.userStories.filter(
          (item): item is string => typeof item === "string",
        )
      : undefined,
    risks: Array.isArray(content.risks)
      ? content.risks.filter((item): item is string => typeof item === "string")
      : undefined,
    repositories: Array.isArray(content.repositories)
      ? content.repositories.filter(
          (item): item is string => typeof item === "string",
        )
      : undefined,
    gitProvider:
      typeof content.gitProvider === "string" ? content.gitProvider : undefined,
    deliveryPlan:
      typeof content.deliveryPlan === "string"
        ? content.deliveryPlan
        : undefined,
    jobId: typeof raw.jobId === "string" ? raw.jobId : undefined,
    proposalId: typeof raw.proposalId === "string" ? raw.proposalId : undefined,
    createdAt:
      typeof raw.createdAt === "string"
        ? raw.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof raw.updatedAt === "string"
        ? raw.updatedAt
        : new Date().toISOString(),
  };
}

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${AICOE_BASE}${path}`, {
    ...options,
    headers: {
      ...(await authHeaders()),
      ...(options?.headers ?? {}),
    },
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof (data as { message?: unknown }).message === "string"
        ? (data as { message: string }).message
        : `Request failed: ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

export async function listSprintnexAicoeTasks(filters: {
  status?: string;
  jobId?: string;
  proposalId?: string;
  teamSpaceId?: string;
  workspaceId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ tasks: SprintnexAicoeTask[]; total: number }> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const response = await requestJson<unknown>(
    `/tasks${params.toString() ? `?${params}` : ""}`,
  );
  const list =
    response && typeof response === "object" && "data" in response
      ? (response as { data?: unknown }).data
      : response;
  const total =
    response &&
    typeof response === "object" &&
    typeof (response as { total?: unknown }).total === "number"
      ? (response as { total: number }).total
      : Array.isArray(list)
        ? list.length
        : 0;
  return {
    tasks: Array.isArray(list) ? list.map(normalizeTask) : [],
    total,
  };
}

export async function getSprintnexAicoeTask(
  taskId: string,
): Promise<SprintnexAicoeTask> {
  const response = await requestJson<unknown>(
    `/tasks/${encodeURIComponent(taskId)}`,
  );
  const data =
    response && typeof response === "object" && "data" in response
      ? (response as { data?: unknown }).data
      : response;
  return normalizeTask(data);
}

export async function getSprintnexTeamSpaces(): Promise<
  SprintnexTeamSpaceNode[]
> {
  const response = await requestJson<unknown>("/team-spaces");
  const list =
    response && typeof response === "object" && "data" in response
      ? (response as { data?: unknown }).data
      : response;
  return Array.isArray(list)
    ? list.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const record = item as Record<string, unknown>;
        if (typeof record.id !== "string" || typeof record.name !== "string")
          return [];
        return [
          {
            id: record.id,
            tenantId:
              typeof record.tenantId === "string" ? record.tenantId : undefined,
            organizationId:
              typeof record.organizationId === "string"
                ? record.organizationId
                : undefined,
            name: record.name,
            description:
              typeof record.description === "string"
                ? record.description
                : undefined,
            visibility:
              typeof record.visibility === "string"
                ? record.visibility
                : undefined,
            status:
              typeof record.status === "string" ? record.status : undefined,
          },
        ];
      })
    : [];
}

export async function getSprintnexWorkspaces(): Promise<
  SprintnexTenantWorkspaceNode[]
> {
  const response = await requestJson<unknown>("/workspaces");
  const list =
    response && typeof response === "object" && "data" in response
      ? (response as { data?: unknown }).data
      : response;
  return Array.isArray(list)
    ? list.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const record = item as Record<string, unknown>;
        if (typeof record.id !== "string" || typeof record.name !== "string")
          return [];
        const metadata =
          record.metadata &&
          typeof record.metadata === "object" &&
          !Array.isArray(record.metadata)
            ? (record.metadata as Record<string, unknown>)
            : null;
        return [
          {
            id: record.id,
            tenantId:
              typeof record.tenantId === "string" ? record.tenantId : undefined,
            organizationId:
              typeof record.organizationId === "string" ||
              record.organizationId === null
                ? record.organizationId
                : undefined,
            teamSpaceId:
              typeof record.teamSpaceId === "string" ||
              record.teamSpaceId === null
                ? record.teamSpaceId
                : undefined,
            ownerUserId:
              typeof record.ownerUserId === "string"
                ? record.ownerUserId
                : undefined,
            name: record.name,
            description:
              typeof record.description === "string"
                ? record.description
                : undefined,
            workspaceType:
              typeof record.workspaceType === "string"
                ? record.workspaceType
                : undefined,
            visibility:
              typeof record.visibility === "string"
                ? record.visibility
                : undefined,
            status:
              typeof record.status === "string" ? record.status : undefined,
            metadata,
            gitRepositories: Array.isArray(record.gitRepositories)
              ? record.gitRepositories.filter(
                  (value): value is string => typeof value === "string",
                )
              : undefined,
          },
        ];
      })
    : [];
}

export async function createSprintnexManualTask(
  request: SprintnexManualTaskRequest,
): Promise<SprintnexAicoeTask> {
  const response = await requestJson<unknown>("/tasks/manual", {
    method: "POST",
    body: JSON.stringify(request),
  });
  const data =
    response && typeof response === "object" && "data" in response
      ? (response as { data?: unknown }).data
      : response;
  return normalizeTask(data);
}

export async function updateSprintnexTaskStatus(
  taskId: string,
  status: SprintnexAicoeTaskStatus,
): Promise<unknown> {
  return requestJson(`/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function bulkUpdateSprintnexTaskStatus(
  taskIds: string[],
  status: SprintnexAicoeTaskStatus,
): Promise<unknown> {
  return requestJson("/tasks/bulk/status", {
    method: "PATCH",
    body: JSON.stringify({ taskIds, status }),
  });
}

export async function startSprintnexTask(taskId: string): Promise<unknown> {
  return requestJson(`/tasks/${encodeURIComponent(taskId)}/start`, {
    method: "POST",
  });
}

export async function retrySprintnexTask(taskId: string): Promise<unknown> {
  return requestJson(`/tasks/${encodeURIComponent(taskId)}/retry`, {
    method: "POST",
  });
}

/** Fetch a job by ID to check execution status. */
export async function getSprintnexJob(
  jobId: string,
): Promise<Record<string, unknown>> {
  return requestJson(`/jobs/${encodeURIComponent(jobId)}`);
}

/** Poll job until it reaches a non-processing state, then return the result. */
export async function pollSprintnexJobUntilReady(
  jobId: string,
  timeoutMs = 120_000,
  intervalMs = 2_500,
): Promise<Record<string, unknown>> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const job = await getSprintnexJob(jobId);
    const status = String(job.status ?? job.state ?? "").toUpperCase();
    if (status !== "PROCESSING" && status !== "PENDING") {
      return job;
    }
  }
  throw new Error("Timed out waiting for job to complete");
}

/** Classify a user request via n8n to decide whether to block it or let it through. */
export async function classifySprintnexRequest(
  text: string,
): Promise<{ blocked: boolean; message?: string }> {
  try {
    const N8N_CLASSIFY_WEBHOOK =
      "https://n8n.directintegrate.com/webhook/aicoe/openwork/task-check";
    const res = await fetch(N8N_CLASSIFY_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return { blocked: false }; // If webhook fails, let it through
    const data = (await res.json()) as Record<string, unknown>;
    if (data?.blocked === true) {
      return {
        blocked: true,
        message:
          typeof data.message === "string"
            ? data.message
            : "This request requires the Sprintnex main delivery flow. Please log it as a new task.",
      };
    }
    return { blocked: false };
  } catch {
    return { blocked: false }; // On error, let it through
  }
}

const N8N_AGENT_CONTEXT_URL =
  "https://n8n.directintegrate.com/webhook/aicoe/agent/context";

let sprintnexAgentsCache: Agent[] | null = null;

/** Last successfully fetched Sprintnex client agents (empty until first fetch). */
export function getCachedSprintnexAgents(): Agent[] {
  return sprintnexAgentsCache ?? [];
}

/**
 * Resolve whether a selected agent name is a Sprintnex (n8n) client agent and,
 * if so, its runtime system prompt. Membership is determined from the n8n
 * agent list (cache, then fresh fetch), independently of whether a prompt is
 * present — so an n8n agent never gets mistaken for a registered local agent.
 */
export async function resolveSprintnexAgent(name: string): Promise<{
  isSprintnex: boolean;
  prompt?: string;
}> {
  const cached = getCachedSprintnexAgents().find(
    (agent) => agent.name === name,
  );
  if (cached) {
    return {
      isSprintnex: true,
      ...(cached.prompt ? { prompt: cached.prompt } : {}),
    };
  }
  const fresh = await fetchSprintnexAgents();
  const freshFound = fresh.find((agent) => agent.name === name);
  if (freshFound) {
    return {
      isSprintnex: true,
      ...(freshFound.prompt ? { prompt: freshFound.prompt } : {}),
    };
  }
  return { isSprintnex: false };
}

/**
 * Fetch the active Sprintnex client agents directly from n8n.
 * Each agent carries its runtime system prompt in `prompt`. Returns [] on any
 * failure so callers fall back to the local OpenCode agent list.
 */
export async function fetchSprintnexAgents(): Promise<Agent[]> {
  try {
    const res = await fetch(N8N_AGENT_CONTEXT_URL, { method: "GET" });
    if (!res.ok) return [];
    const data = (await res.json()) as Record<string, unknown>;
    const rawList =
      (data?.agents as unknown) ?? (data?.data as unknown) ?? data ?? [];
    if (!Array.isArray(rawList)) return [];
    const agents = rawList
      .map((item): Agent | null => {
        const record = (item ?? {}) as Record<string, unknown>;
        const name = typeof record.name === "string" ? record.name : "";
        if (!name) return null;
        const rawMode = record.mode;
        const mode: Agent["mode"] =
          rawMode === "subagent" || rawMode === "all" ? rawMode : "primary";
        const description =
          typeof record.description === "string"
            ? record.description
            : undefined;
        const prompt =
          typeof record.prompt === "string" ? record.prompt : undefined;
        return {
          name,
          ...(description ? { description } : {}),
          mode,
          hidden: record.hidden === true,
          ...(prompt ? { prompt } : {}),
          permission: [],
          options: {},
        };
      })
      .filter((agent): agent is Agent => agent !== null);
    sprintnexAgentsCache = agents;
    console.log("[sprintnex] fetched agents", { count: agents.length });
    console.log("[sprintnex] agent names", sprintnexAgentsCache);
    return agents;
  } catch {
    return [];
  }
}

// ─── Agent Selection & Usage ───────────────────────────────────────────────

/**
 * Select an agent by its exact name as returned from the endpoint.
 * Returns the full Agent object (with prompt, description, isDefault, etc.).
 * Returns null if not found or if cache is empty.
 *
 * Call ensureSprintnexAgentsCached() first to guarantee fresh data.
 */
export function selectAgent(agentName: string): Agent | null {
  const agents = getCachedSprintnexAgents();
  return agents.find((a) => a.name === agentName) ?? null;
}

/**
 * Get all agents marked as default (isDefault: true).
 * Useful for finding the primary agent for a context without assuming names.
 * Returns empty array if no defaults or cache is empty.
 */
export function getDefaultAgents(): Agent[] {
  const agents = getCachedSprintnexAgents();
  return agents.filter(
    (a) => (a.description === "sprintnex-default-agent") === true,
  );
}

/**
 * Ensure agents are fetched and cached before use.
 * Safe to call multiple times — returns immediately if already cached.
 */
export async function ensureSprintnexAgentsCached(): Promise<void> {
  const cached = getCachedSprintnexAgents();
  if (cached.length === 0) {
    await fetchSprintnexAgents();
  }
}

// ─── Multi-stage task execution ─────────────────────────────────────────────

const N8N_EXECUTION_OBSERVE_URL =
  "https://n8n.directintegrate.com/webhook/aicoe/execution/observe";

export type SprintnexExecutionObservation = {
  status: string;
  instructions: string | null;
  system?: string;
  completed: boolean;
};

/**
 * Poll the current Sprintnex task stage directly from n8n. The webhook is
 * expected to return the current stage as `instructions` and to signal the end
 * of the task with `status: "COMPLETED"` (no further polling needed). Failures
 * return a non-completed observation so the caller keeps polling.
 */
export async function observeSprintnexExecution(
  taskId: string,
): Promise<SprintnexExecutionObservation> {
  const scope = readSprintnexAicoeScope();
  try {
    const res = await fetch(N8N_EXECUTION_OBSERVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: scope.organizationId,
        teamId: scope.teamId,
        projectId: scope.projectId,
        userId: scope.userId,
        taskId,
      }),
    });
    if (!res.ok) {
      return { status: "ERROR", instructions: null, completed: false };
    }
    const data = (await res.json()) as Record<string, unknown>;
    const record = data && typeof data === "object" ? data : {};
    const status = typeof record.status === "string" ? record.status : "";
    const instructions =
      typeof record.instructions === "string" ? record.instructions : null;
    const system =
      typeof record.system === "string" ? record.system : undefined;
    return {
      status,
      instructions,
      ...(system ? { system } : {}),
      completed: status === "COMPLETED",
    };
  } catch {
    return { status: "ERROR", instructions: null, completed: false };
  }
}

/** Poll n8n until the task reports COMPLETED or a stage becomes ready, or timeout. */
export async function pollObserveSprintnexExecution(
  taskId: string,
  timeoutMs = 300_000,
  intervalMs = 2_500,
): Promise<SprintnexExecutionObservation> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const observed = await observeSprintnexExecution(taskId);
    if (observed.completed || observed.instructions) {
      console.log("[sprintnex] observeSprintnexExecution returned", {
        taskId,
        completed: observed.completed,
        hasInstructions: Boolean(observed.instructions),
        elapsed: Date.now() - startedAt,
      });
      return observed;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  console.warn("[sprintnex] observeSprintnexExecution timed out", {
    taskId,
    timeoutMs,
  });
  return { status: "TIMEOUT", instructions: null, completed: false };
}

/** Mark a stage as completed on the backend so polling moves to the next stage. */
export async function markSprintnexStageComplete(
  taskId: string,
  stageIndex: number,
): Promise<void> {
  await requestJson<unknown>(
    `/tasks/${encodeURIComponent(taskId)}/stages/${stageIndex}/complete`,
    { method: "POST" },
  );
}

/** Notify n8n that a stage is complete. Sent directly to the n8n webhook. */
export async function notifySprintnexStageComplete(
  taskId: string,
  sessionId: string,
  result: {
    status: "COMPLETED" | "FAILED";
    exitCode: number;
    logs?: string;
    startedAt: string;
    endedAt: string;
    agentOutput: string;
  },
): Promise<void> {
  const N8N_STAGE_COMPLETE_WEBHOOK =
    "https://n8n.directintegrate.com/webhook/aicoe/tasks-section/complete";
  await fetch(N8N_STAGE_COMPLETE_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      taskId,
      sessionId,
      status: result.status,
      exitCode: result.exitCode,
      logs: result.logs ?? "",
      startedAt: result.startedAt,
      endedAt: result.endedAt,
      queue: "basic",
      agentOutput: result.agentOutput,
    }),
  });
}

function normalizeDepartmentSession(
  department: string,
  rawInput: unknown,
): SprintnexDepartmentSession {
  const raw =
    rawInput && typeof rawInput === "object" && !Array.isArray(rawInput)
      ? (rawInput as Record<string, unknown>)
      : {};
  const fallbackId = `sess-${department}-${Date.now()}`;
  return {
    chatId:
      typeof raw.chatId === "string"
        ? raw.chatId
        : `${department}-chat-${Date.now()}`,
    sessionId: typeof raw.sessionId === "string" ? raw.sessionId : fallbackId,
    correlationId:
      typeof raw.correlationId === "string"
        ? raw.correlationId
        : `corr-${department}-${Date.now()}`,
    createdAt:
      typeof raw.createdAt === "string"
        ? raw.createdAt
        : new Date().toISOString(),
    name: typeof raw.name === "string" ? raw.name : undefined,
  };
}

export async function getSprintnexDepartmentSessions(
  department: string,
): Promise<SprintnexDepartmentSession[]> {
  const response = await requestJson<unknown>(
    `/department-sessions/${encodeURIComponent(department)}`,
  );
  const list =
    response && typeof response === "object" && "data" in response
      ? (response as { data?: unknown }).data
      : response;
  return Array.isArray(list)
    ? list.map((item) => normalizeDepartmentSession(department, item))
    : [];
}

export async function createSprintnexDepartmentSession(
  department: string,
): Promise<SprintnexDepartmentSession> {
  const response = await requestJson<unknown>(
    `/department-sessions/${encodeURIComponent(department)}`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
  const data =
    response && typeof response === "object" && "data" in response
      ? (response as { data?: unknown }).data
      : response;
  return normalizeDepartmentSession(department, data);
}

export async function getSprintnexDepartmentSessionMessages(
  department: string,
  sessionId: string,
  params: { limit?: number; offset?: number } = {},
): Promise<SprintnexDepartmentMessage[]> {
  const search = new URLSearchParams();
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.offset !== undefined) search.set("offset", String(params.offset));
  const response = await requestJson<unknown>(
    `/department-sessions/${encodeURIComponent(department)}/${encodeURIComponent(sessionId)}/messages${search.toString() ? `?${search}` : ""}`,
  );
  const list =
    response && typeof response === "object" && "data" in response
      ? (response as { data?: unknown }).data
      : response;
  return Array.isArray(list)
    ? list.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const raw = item as Record<string, unknown>;
        const role =
          raw.role === "user"
            ? "user"
            : raw.role === "assistant"
              ? "assistant"
              : null;
        if (!role) return [];
        const metadata =
          raw.metadata &&
          typeof raw.metadata === "object" &&
          !Array.isArray(raw.metadata)
            ? (raw.metadata as Record<string, unknown>)
            : null;
        return [
          {
            id: typeof raw.id === "string" ? raw.id : undefined,
            role,
            text: typeof raw.text === "string" ? raw.text : "",
            createdAt:
              typeof raw.createdAt === "string"
                ? raw.createdAt
                : new Date().toISOString(),
            metadata,
          },
        ];
      })
    : [];
}

export async function submitSprintnexIntakeMessage(
  department: string,
  sessionId: string,
  payload: { message: string; metadata?: Record<string, unknown> },
): Promise<unknown> {
  return requestJson(
    `/department-sessions/${encodeURIComponent(department)}/${encodeURIComponent(sessionId)}/submit-intake`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
