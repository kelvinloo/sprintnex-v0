import { ApiError } from "../errors.js";
import {
  deleteSprintnexTask,
  getSprintnexTask,
  listSprintnexTasks,
  upsertSprintnexTask,
} from "../sprintnex-tasks.js";
import type { ServerConfig, TokenScope, WorkspaceInfo } from "../types.js";
import { addRoute, type RequestContext, type Route } from "./registry.js";

type JsonResponse = (data: unknown, status?: number) => Response;
type ReadJsonBody = (request: Request) => Promise<Record<string, unknown>>;

interface RegisterSprintnexTaskRoutesOptions {
  routes: Route[];
  config: ServerConfig;
  jsonResponse: JsonResponse;
  readJsonBody: ReadJsonBody;
  ensureWritable: (config: ServerConfig) => void;
  requireClientScope: (ctx: RequestContext, required: TokenScope) => void;
  resolveWorkspace: (config: ServerConfig, id: string) => Promise<WorkspaceInfo>;
}

function cleanId(value: string | undefined, name: string): string {
  const id = value?.trim() ?? "";
  if (!id) throw new ApiError(400, "invalid_payload", `${name} is required`);
  return id.slice(0, 256);
}

export function registerSprintnexTaskRoutes(options: RegisterSprintnexTaskRoutesOptions): void {
  const {
    routes,
    config,
    jsonResponse,
    readJsonBody,
    ensureWritable,
    requireClientScope,
    resolveWorkspace,
  } = options;

  addRoute(routes, "GET", "/workspace/:id/sprintnex/tasks", "client", async (ctx) => {
    const workspace = await resolveWorkspace(config, ctx.params.id);
    const items = await listSprintnexTasks(config, workspace.id);
    return jsonResponse({ items });
  });

  addRoute(routes, "GET", "/workspace/:id/sprintnex/tasks/:taskId", "client", async (ctx) => {
    const workspace = await resolveWorkspace(config, ctx.params.id);
    const taskId = cleanId(ctx.params.taskId, "taskId");
    const item = await getSprintnexTask(config, workspace.id, taskId);
    if (!item) throw new ApiError(404, "task_not_found", "Sprintnex task not found");
    return jsonResponse({ item });
  });

  addRoute(routes, "PUT", "/workspace/:id/sprintnex/tasks/:taskId", "client", async (ctx) => {
    ensureWritable(config);
    requireClientScope(ctx, "collaborator");
    const workspace = await resolveWorkspace(config, ctx.params.id);
    const taskId = cleanId(ctx.params.taskId, "taskId");
    const body = await readJsonBody(ctx.request);
    const item = await upsertSprintnexTask(config, workspace.id, taskId, body.task ?? body);
    return jsonResponse({ item });
  });

  addRoute(routes, "PATCH", "/workspace/:id/sprintnex/tasks/:taskId", "client", async (ctx) => {
    ensureWritable(config);
    requireClientScope(ctx, "collaborator");
    const workspace = await resolveWorkspace(config, ctx.params.id);
    const taskId = cleanId(ctx.params.taskId, "taskId");
    const body = await readJsonBody(ctx.request);
    const item = await upsertSprintnexTask(config, workspace.id, taskId, body.task ?? body);
    return jsonResponse({ item });
  });

  addRoute(routes, "DELETE", "/workspace/:id/sprintnex/tasks/:taskId", "client", async (ctx) => {
    ensureWritable(config);
    requireClientScope(ctx, "collaborator");
    const workspace = await resolveWorkspace(config, ctx.params.id);
    const taskId = cleanId(ctx.params.taskId, "taskId");
    await deleteSprintnexTask(config, workspace.id, taskId);
    return jsonResponse({ ok: true });
  });
}
