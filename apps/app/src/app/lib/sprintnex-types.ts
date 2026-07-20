/**
 * Sprintnex domain types.
 *
 * These types define the data contracts between the Sprintnex control plane
 * and the OpenWork-based desktop execution plane. They are the single source
 * of truth for all Sprintnex domain objects used in the UI and local storage.
 */

// ─── Organizations / Teams / Projects ───────────────────────────────────────

export interface SprintnexOrganization {
  id: string;
  name: string;
  code?: string;
}

export interface SprintnexTeam {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
}

export interface SprintnexProject {
  id: string;
  organizationId: string;
  teamId: string;
  name: string;
  description?: string;
}

// ─── Local Repository Mapping ───────────────────────────────────────────────

export interface SprintnexRepositoryMapping {
  id: string;
  projectId: string;
  repositoryId?: string;
  name: string;
  localPath: string;
  defaultBranch?: string;
  enabled: boolean;
  /** ISO timestamp of last successful path validation */
  validatedAt?: string;
  /** Error message from last validation, empty if valid */
  validationError?: string;
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

export type SprintnexTaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type SprintnexTaskStatus =
  | "PENDING"
  | "CLAIMED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "BLOCKED";

export interface SprintnexTask {
  id: string;
  projectId: string;
  title: string;
  description: string;
  priority: SprintnexTaskPriority;
  status: SprintnexTaskStatus;
  agentId?: string;
  workflowStage?: string;
  knowledgeContext?: unknown;
  acceptanceCriteria?: string[];
  userStories?: string[];
  risks?: string[];
  repositories?: string[];
  tags?: string[];
  estimateHours?: number;
  progress?: number;
  notes?: string;
  jobId?: string;
  proposalId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Execution ──────────────────────────────────────────────────────────────

export type SprintnexExecutionStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface SprintnexExecution {
  id: string;
  taskId: string;
  projectId: string;
  userId: string;
  status: SprintnexExecutionStatus;
  sessionId?: string;
  modelProfileId?: string;
  startedAt?: string;
  completedAt?: string;
  summary?: string;
  changedFiles?: string[];
}

// ─── Agents ─────────────────────────────────────────────────────────────────

export interface SprintnexAgent {
  id: string;
  name: string;
  version: string;
  role: string;
  systemPrompt: string;
  instructions?: string;
  skillIds: string[];
  expectedOutputSchema?: unknown;
}

// ─── Model Profiles ─────────────────────────────────────────────────────────

export interface SprintnexModelProfile {
  id: string;
  name: string;
  providerId: string;
  modelName: string;
  endpoint?: string;
  capability: "general" | "reasoning" | "coding" | "fast" | "local";
  isDefault: boolean;
}

// ─── API Client Interface ───────────────────────────────────────────────────

/**
 * Abstract interface for the Sprintnex API client.
 *
 * All Sprintnex API communication should go through this interface so the
 * implementation can be swapped (mock → real → proxied) without changing
 * UI code.
 */
export interface SprintnexApiClient {
  // Auth
  login(input: {
    email: string;
    password: string;
    organizationCode?: string;
  }): Promise<{ token: string; user: SprintnexUser }>;

  // Organizations / Teams / Projects
  listOrganizations(): Promise<SprintnexOrganization[]>;
  listTeams(organizationId: string): Promise<SprintnexTeam[]>;
  listProjects(
    organizationId: string,
    teamId: string,
  ): Promise<SprintnexProject[]>;

  // Tasks
  listTasks(projectId: string): Promise<SprintnexTask[]>;
  getTask(taskId: string): Promise<SprintnexTask>;
  claimTask(taskId: string): Promise<SprintnexTask>;
  startTask(taskId: string): Promise<SprintnexExecution>;
  updateTaskStatus(
    taskId: string,
    status: SprintnexTaskStatus,
  ): Promise<SprintnexTask>;

  // Execution
  submitExecutionResult(execution: SprintnexExecution): Promise<void>;

  // Agents
  getAgent(agentId: string): Promise<SprintnexAgent>;
}

export interface SprintnexUser {
  id: string;
  email: string;
  name: string;
  tenantId?: string;
  organizationId?: string | null;
}

// ─── Device ─────────────────────────────────────────────────────────────────

export interface SprintnexDeviceRegistration {
  deviceId: string;
  name: string;
  platform: string;
  appVersion: string;
  registeredAt: string;
}
