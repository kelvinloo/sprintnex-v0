import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { and, eq } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { ServerConfig } from "./types.js";
import { ensureDir, shortId } from "./utils.js";

export type SprintnexTaskPriority = "low" | "medium" | "high" | "urgent";
export type SprintnexTaskStatus = "draft" | "queued" | "running" | "done" | "blocked";
export type SprintnexTaskExecutionMode = "autonomous" | "guided";

export type SprintnexTaskRecord = {
  id: string;
  workspaceId: string;
  sessionId?: string | null;
  executionSessionId?: string | null;
  title: string;
  description: string;
  priority: SprintnexTaskPriority;
  executionMode: SprintnexTaskExecutionMode;
  skills: string;
  mcpRules: string;
  status: SprintnexTaskStatus;
  createdAt: number;
  updatedAt: number;
};

const sprintnexTasks = sqliteTable("sprintnex_tasks", {
  sessionId: text("session_id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  taskJson: text("task_json").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

type SprintnexTaskDb = {
  list: (workspaceId: string) => { taskKey: string; taskJson: string }[];
  get: (workspaceId: string, taskKey: string) => { taskKey: string; taskJson: string } | undefined;
  upsert: (value: { workspaceId: string; sessionId: string; taskJson: string; updatedAt: number }) => void;
  delete: (workspaceId: string, taskKey: string) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function runtimeDbPath(config: ServerConfig): string {
  const override = process.env.OPENWORK_RUNTIME_DB?.trim();
  if (override) return resolve(override);
  const configPath = config.configPath?.trim();
  const configDir = configPath ? dirname(configPath) : join(homedir(), ".config", "openwork");
  return join(configDir, "runtime.sqlite");
}

function normalizePriority(value: unknown): SprintnexTaskPriority {
  return value === "low" || value === "high" || value === "urgent" ? value : "medium";
}

function normalizeExecutionMode(value: unknown): SprintnexTaskExecutionMode {
  return value === "autonomous" ? "autonomous" : "guided";
}

function normalizeStatus(value: unknown): SprintnexTaskStatus {
  if (value === "draft" || value === "running" || value === "done" || value === "blocked") return value;
  return "queued";
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizeSprintnexTask(
  value: unknown,
  fallback: { workspaceId: string; taskId: string },
): SprintnexTaskRecord {
  const record = isRecord(value) ? value : {};
  const now = Date.now();
  const existingId = cleanText(record.id, 128);
  const sessionId = cleanText(record.sessionId, 256) || null;
  const executionSessionId = cleanText(record.executionSessionId, 256) || sessionId;
  const title = cleanText(record.title, 180) || "Untitled task";
  return {
    id: existingId || fallback.taskId || `task_${now.toString(36)}_${shortId()}`,
    workspaceId: fallback.workspaceId,
    sessionId,
    executionSessionId,
    title,
    description: cleanText(record.description, 10_000),
    priority: normalizePriority(record.priority),
    executionMode: normalizeExecutionMode(record.executionMode),
    skills: cleanText(record.skills, 5_000),
    mcpRules: cleanText(record.mcpRules, 5_000),
    status: normalizeStatus(record.status),
    createdAt: typeof record.createdAt === "number" && Number.isFinite(record.createdAt) ? record.createdAt : now,
    updatedAt: typeof record.updatedAt === "number" && Number.isFinite(record.updatedAt) ? record.updatedAt : now,
  };
}

async function openSprintnexTaskDb(path: string): Promise<SprintnexTaskDb> {
  await ensureDir(dirname(path));
  if (typeof process.versions.bun === "string") {
    const { Database } = await import("bun:sqlite");
    const { drizzle } = await import("drizzle-orm/bun-sqlite");
    const sqlite = new Database(path, { create: true });
    sqlite.run("CREATE TABLE IF NOT EXISTS sprintnex_tasks (session_id TEXT PRIMARY KEY NOT NULL, workspace_id TEXT NOT NULL, task_json TEXT NOT NULL, updated_at INTEGER NOT NULL)");
    const db = drizzle(sqlite);
    return {
      list: (workspaceId) => db.select({
        taskKey: sprintnexTasks.sessionId,
        taskJson: sprintnexTasks.taskJson,
      }).from(sprintnexTasks).where(eq(sprintnexTasks.workspaceId, workspaceId)).all(),
      get: (workspaceId, sessionId) => db
        .select({
          taskKey: sprintnexTasks.sessionId,
          taskJson: sprintnexTasks.taskJson,
        })
        .from(sprintnexTasks)
        .where(and(eq(sprintnexTasks.workspaceId, workspaceId), eq(sprintnexTasks.sessionId, sessionId)))
        .get(),
      upsert: ({ workspaceId, sessionId, taskJson, updatedAt }) => {
        db
          .insert(sprintnexTasks)
          .values({ workspaceId, sessionId, taskJson, updatedAt })
          .onConflictDoUpdate({
            target: sprintnexTasks.sessionId,
            set: { workspaceId, taskJson, updatedAt },
          })
          .run();
      },
      delete: (workspaceId, sessionId) => {
        db.delete(sprintnexTasks)
          .where(and(eq(sprintnexTasks.workspaceId, workspaceId), eq(sprintnexTasks.sessionId, sessionId)))
          .run();
      },
    };
  }

  const { DatabaseSync } = await import("node:sqlite");
  const sqlite = new DatabaseSync(path);
  sqlite.exec("CREATE TABLE IF NOT EXISTS sprintnex_tasks (session_id TEXT PRIMARY KEY NOT NULL, workspace_id TEXT NOT NULL, task_json TEXT NOT NULL, updated_at INTEGER NOT NULL)");
  const list = sqlite.prepare("SELECT session_id AS taskKey, task_json AS taskJson FROM sprintnex_tasks WHERE workspace_id = ? ORDER BY updated_at DESC");
  const get = sqlite.prepare("SELECT session_id AS taskKey, task_json AS taskJson FROM sprintnex_tasks WHERE workspace_id = ? AND session_id = ?");
  const upsert = sqlite.prepare("INSERT INTO sprintnex_tasks (workspace_id, session_id, task_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET workspace_id = excluded.workspace_id, task_json = excluded.task_json, updated_at = excluded.updated_at");
  const remove = sqlite.prepare("DELETE FROM sprintnex_tasks WHERE workspace_id = ? AND session_id = ?");
  return {
    list: (workspaceId) => list.all(workspaceId).filter(isRecord).flatMap((row) =>
      typeof row.taskJson === "string" && typeof row.taskKey === "string" ? [{ taskKey: row.taskKey, taskJson: row.taskJson }] : []
    ),
    get: (workspaceId, sessionId) => {
      const row = get.get(workspaceId, sessionId);
      if (!isRecord(row) || typeof row.taskJson !== "string") return undefined;
      return { taskKey: typeof row.taskKey === "string" ? row.taskKey : sessionId, taskJson: row.taskJson };
    },
    upsert: ({ workspaceId, sessionId, taskJson, updatedAt }) => {
      upsert.run(workspaceId, sessionId, taskJson, updatedAt);
    },
    delete: (workspaceId, sessionId) => {
      remove.run(workspaceId, sessionId);
    },
  };
}

const dbByPath = new Map<string, Promise<SprintnexTaskDb>>();

async function sprintnexTaskDb(config: ServerConfig): Promise<SprintnexTaskDb> {
  const path = runtimeDbPath(config);
  const existing = dbByPath.get(path);
  if (existing) return existing;
  const db = openSprintnexTaskDb(path);
  dbByPath.set(path, db);
  return db;
}

export async function listSprintnexTasks(config: ServerConfig, workspaceId: string): Promise<SprintnexTaskRecord[]> {
  const db = await sprintnexTaskDb(config);
  return db.list(workspaceId).flatMap((row) => {
    try {
      const parsed = JSON.parse(row.taskJson);
      return [normalizeSprintnexTask(parsed, {
        workspaceId,
        taskId: isRecord(parsed) && typeof parsed.id === "string" ? parsed.id : row.taskKey,
      })];
    } catch {
      return [];
    }
  }).filter((task) => task.id);
}

export async function getSprintnexTask(
  config: ServerConfig,
  workspaceId: string,
  taskId: string,
): Promise<SprintnexTaskRecord | null> {
  const db = await sprintnexTaskDb(config);
  const row = db.get(workspaceId, taskId);
  if (!row) return null;
  try {
    return normalizeSprintnexTask(JSON.parse(row.taskJson), { workspaceId, taskId: row.taskKey || taskId });
  } catch {
    return null;
  }
}

export async function upsertSprintnexTask(
  config: ServerConfig,
  workspaceId: string,
  taskId: string,
  input: unknown,
): Promise<SprintnexTaskRecord> {
  const db = await sprintnexTaskDb(config);
  const existing = await getSprintnexTask(config, workspaceId, taskId);
  const task = normalizeSprintnexTask({ ...(existing ?? {}), ...(isRecord(input) ? input : {}), updatedAt: Date.now() }, {
    workspaceId,
    taskId,
  });
  db.upsert({ workspaceId, sessionId: task.id, taskJson: JSON.stringify(task), updatedAt: task.updatedAt });
  return task;
}

export async function deleteSprintnexTask(
  config: ServerConfig,
  workspaceId: string,
  taskId: string,
): Promise<void> {
  const db = await sprintnexTaskDb(config);
  db.delete(workspaceId, taskId);
}
