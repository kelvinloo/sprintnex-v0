/**
 * Sprintnex API client — real implementation.
 *
 * All Sprintnex control-plane communication goes through this client.
 * OpenWork/OpenCode local execution remains completely separate.
 */

import {
  type SprintnexApiClient,
  type SprintnexOrganization,
  type SprintnexTeam,
  type SprintnexProject,
  type SprintnexTask,
  type SprintnexTaskStatus,
  type SprintnexExecution,
  type SprintnexAgent,
  type SprintnexUser,
} from "./sprintnex-types";

// ─── Helpers ────────────────────────────────────────────────────────────────

import { API_ROOT, AICOE_BASE } from "./api-config";

function storageGet(key: string): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(key) || "";
}

async function authHeaders(): Promise<Record<string, string>> {
  let token: string;
  try {
    const { getValidSprintnexToken } = await import("./sprintnex-aicoe-api");
    token = await getValidSprintnexToken();
  } catch {
    token = storageGet("auth_token") || storageGet("accessToken");
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Tenant-Id": storageGet("tenantId") || "default",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const teamId =
    storageGet("selected_team_id") || storageGet("engineering_team_id");
  const projectId =
    storageGet("selected_project_id") || storageGet("engineering_project_id");
  const orgId =
    storageGet("selected_organization_id") || storageGet("organization_id");
  const userId = storageGet("userId");
  if (teamId) headers["X-Team-Space-Id"] = teamId;
  if (projectId) headers["X-Workspace-Id"] = projectId;
  if (orgId) headers["X-Organization-Id"] = orgId;
  if (userId) headers["X-User-Id"] = userId;
  return headers;
}

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${AICOE_BASE}${path}`, {
    ...options,
    headers: { ...(await authHeaders()), ...(options?.headers ?? {}) },
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof (data as Record<string, unknown>).message === "string"
        ? (data as Record<string, string>).message
        : `Sprintnex API error: ${response.status}`;
    throw new Error(message);
  }
  // Backend wraps responses in { success, data }. Unwrap automatically.
  if (data && typeof data === "object" && "data" in data) {
    return (data as Record<string, unknown>).data as T;
  }
  return data as T;
}

function unwrapList<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[];
  if (response && typeof response === "object" && "items" in response) {
    return (response as Record<string, unknown>).items as T[];
  }
  return [];
}

// ─── Normalize helpers for backend response shapes ─────────────────────────

function normalizeTask(raw: Record<string, unknown>): SprintnexTask {
  return {
    id: String(raw.taskId || raw.id || ""),
    projectId: String(raw.workspaceId || raw.projectId || ""),
    title: String(raw.title || "Untitled"),
    description: String(raw.description || ""),
    priority: (raw.priority || "MEDIUM") as SprintnexTask["priority"],
    status: normalizeTaskStatus(raw.status),
    agentId: typeof raw.agentId === "string" ? raw.agentId : undefined,
    workflowStage: typeof raw.stage === "string" ? raw.stage : undefined,
    tags: Array.isArray(raw.tags)
      ? raw.tags.filter((t): t is string => typeof t === "string")
      : undefined,
    estimateHours:
      typeof raw.estimateHours === "number" ? raw.estimateHours : undefined,
    progress: typeof raw.progress === "number" ? raw.progress : undefined,
    notes: typeof raw.notes === "string" ? raw.notes : undefined,
    jobId: typeof raw.jobId === "string" ? raw.jobId : undefined,
    proposalId: typeof raw.proposalId === "string" ? raw.proposalId : undefined,
    createdAt: String(raw.createdAt || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
  };
}

function normalizeTaskStatus(value: unknown): SprintnexTaskStatus {
  if (value === "DONE") return "COMPLETED";
  if (value === "IN_PROGRESS") return "RUNNING";
  if (typeof value === "string") {
    const valid: SprintnexTaskStatus[] = [
      "PENDING",
      "CLAIMED",
      "RUNNING",
      "COMPLETED",
      "FAILED",
      "CANCELLED",
      "BLOCKED",
    ];
    if (valid.includes(value as SprintnexTaskStatus))
      return value as SprintnexTaskStatus;
  }
  return "PENDING";
}

// ─── Real Sprintnex API Client ──────────────────────────────────────────────

export function createSprintnexApiClient(): SprintnexApiClient {
  return {
    // ── Auth ──
    async login({ email, password, organizationCode }) {
      const endpoint = organizationCode?.trim()
        ? "/auth/login/organization"
        : "/auth/login";
      const body: Record<string, string> = { email, password };
      if (organizationCode?.trim())
        body.organizationCode = organizationCode.trim();

      const data = await requestJson<Record<string, unknown>>(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      const accessToken = String(data.accessToken || data.token || "");
      const userRaw = (data.user as Record<string, unknown>) || {};
      return {
        token: accessToken,
        user: {
          id: String(userRaw.id || ""),
          email: String(userRaw.email || email),
          name: String(
            userRaw.displayName ||
              userRaw.username ||
              email.split("@")[0] ||
              "",
          ),
          tenantId:
            typeof userRaw.tenantId === "string" ? userRaw.tenantId : undefined,
          organizationId:
            typeof userRaw.organizationId === "string"
              ? userRaw.organizationId
              : null,
        },
      };
    },

    // ── Organizations / Teams / Projects ──
    async listOrganizations() {
      return unwrapList<SprintnexOrganization>(
        await requestJson("/organizations"),
      );
    },

    async listTeams(_organizationId: string) {
      // The current backend returns all teams accessible to the user.
      return unwrapList<SprintnexTeam>(await requestJson("/team-spaces"));
    },

    async listProjects(_organizationId: string, _teamId: string) {
      return unwrapList<SprintnexProject>(await requestJson("/workspaces"));
    },

    // ── Tasks ──
    async listTasks(projectId: string) {
      const params = new URLSearchParams({
        workspaceId: projectId,
        limit: "200",
      });
      const data = await requestJson<unknown>(`/tasks?${params}`);
      const list = Array.isArray(data) ? data : [];
      return list.map((item: unknown) =>
        normalizeTask(item as Record<string, unknown>),
      );
    },

    async getTask(taskId: string) {
      const data = await requestJson<Record<string, unknown>>(
        `/tasks/${encodeURIComponent(taskId)}`,
      );
      return normalizeTask(data);
    },

    async claimTask(taskId: string) {
      return normalizeTask(
        await requestJson<Record<string, unknown>>(
          `/tasks/${encodeURIComponent(taskId)}/claim`,
          {
            method: "POST",
          },
        ),
      );
    },

    async startTask(taskId: string) {
      const data = await requestJson<Record<string, unknown>>(
        `/tasks/${encodeURIComponent(taskId)}/start`,
        {
          method: "POST",
        },
      );
      return {
        id: String(data.executionId || data.jobId || ""),
        taskId,
        projectId: String(data.workspaceId || ""),
        userId: "",
        status: "RUNNING",
        startedAt: new Date().toISOString(),
      } as SprintnexExecution;
    },

    async updateTaskStatus(taskId: string, status: SprintnexTaskStatus) {
      return normalizeTask(
        await requestJson<Record<string, unknown>>(
          `/tasks/${encodeURIComponent(taskId)}`,
          {
            method: "PATCH",
            body: JSON.stringify({ status }),
          },
        ),
      );
    },

    // ── Execution ──
    async submitExecutionResult(_execution: SprintnexExecution) {
      // Future: POST /desktop/executions/:id/complete
      // Not yet implemented on the Sprintnex backend.
    },

    // ── Agents ──
    async getAgent(_agentId: string) {
      // Future: GET /desktop/agents/:id
      throw new Error("Agent API not yet available");
    },
  };
}
