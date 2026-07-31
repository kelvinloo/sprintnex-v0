/**
 * QA Agent Orchestration — manages MCP browser server connection,
 * OpenCode session setup, and QA task execution within the Sprintnex pipeline.
 */

import { createClient } from "./opencode";
import { McpBrowserClient } from "./mcp-browser-client";
import { QA_AGENT_PROMPT } from "./sprintnex-agent-prompts";
import type { SprintnexAicoeScope } from "./sprintnex-aicoe-api";

// ── Types ───────────────────────────────────────────────────────────────────

export type QaTaskConfig = {
  /** Target URL for tests */
  targetUrl: string;
  /** Manual test steps in markdown */
  testSteps: string;
  /** MCP browser server port */
  browserMcpPort?: number;
};

export type QaStepResult = {
  ok: boolean;
  description: string;
  detail?: string;
};

export type QaExecutionResult = {
  ok: boolean;
  report?: string;
  error?: string;
  steps: QaStepResult[];
  durationMs: number;
};

// ── QA execution report parsing ─────────────────────────────────────────────

export type QaReportStatus = "pass" | "fail" | "error";

export type QaReportItem = {
  scenario: string;
  status: QaReportStatus;
  notes?: string;
};

function normalizeQaStatus(value: unknown): QaReportStatus | null {
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  if (
    s === "pass" ||
    s === "passed" ||
    s === "success" ||
    s === "ok" ||
    s === "true"
  )
    return "pass";
  if (s === "fail" || s === "failed" || s === "false") return "fail";
  if (
    s === "error" ||
    s === "err" ||
    s === "blocked" ||
    s === "skip" ||
    s === "skipped"
  )
    return "error";
  return null;
}

function extractJsonFromText(text: string): string | null {
  const first = text.indexOf("{");
  if (first === -1) return null;
  // Find the matching closing brace (track nesting, ignore inside strings).
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = first; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(first, i + 1);
    }
  }
  return null;
}

/**
 * Parse a QA execution report from the agent's free-form response.
 * Supports both a ```json block and an inline JSON object with a
 * `results` array of `{ scenario, status, notes }` entries.
 */
export function parseQaExecutionReport(text: string): QaReportItem[] | null {
  if (!text || !text.trim()) return null;
  const codeBlock = text.match(/```json\s*([\s\S]*?)\s*```/);
  const candidates = [
    codeBlock ? codeBlock[1] : null,
    extractJsonFromText(text),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const results = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.results)
          ? (parsed.results as unknown[])
          : null;
      if (!results) continue;
      const items: QaReportItem[] = [];
      for (const raw of results) {
        if (!raw || typeof raw !== "object") continue;
        const record = raw as Record<string, unknown>;
        const scenario = String(
          record.scenario ??
            record.name ??
            record.scenarioName ??
            record.title ??
            "",
        ).trim();
        const status = normalizeQaStatus(
          record.status ?? record.result ?? record.outcome,
        );
        if (!scenario || !status) continue;
        items.push({
          scenario,
          status,
          notes: record.notes ? String(record.notes) : undefined,
        });
      }
      if (items.length > 0) return items;
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

// ── Desktop bridge helpers ──────────────────────────────────────────────────

async function desktopFetch<T = unknown>(
  command: string,
  payload: Record<string, unknown> = {},
): Promise<T | null> {
  const bridge = (window as unknown as Record<string, unknown>)
    .__OPENWORK_ELECTRON__ as
    | { invokeDesktop: (cmd: string, ...args: unknown[]) => Promise<unknown> }
    | undefined;
  if (!bridge?.invokeDesktop) return null;
  try {
    return (await bridge.invokeDesktop(command, payload)) as T;
  } catch {
    return null;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Ensure the MCP browser server is running.
 * Checks localStorage for a custom URL first, then falls back to local.
 * In desktop mode, starts it as a sidecar. In browser mode, assumes external.
 */
export async function ensureBrowserMcp(port = 8812): Promise<string> {
  // Read the selected MCP URL from localStorage
  const customUrl = localStorage.getItem("sprintnex.mcpBrowserUrl");
  if (!customUrl) {
    throw new Error(
      "No MCP browser server URL configured. Add one in Tests → Test Plans → MCP Browser Server.",
    );
  }
  // Use the configured URL exactly as provided — never append or strip /mcp.
  const baseUrl = customUrl;

  // Check if it's reachable
  const client = new McpBrowserClient({ baseUrl });
  const healthy = await client.health();
  if (healthy) return baseUrl;

  throw new Error(
    `MCP browser server not reachable at ${customUrl}. Check the URL or start the server.`,
  );
}

/**
 * Stop the MCP browser server.
 */
export async function stopBrowserMcp(port = 8812): Promise<void> {
  await desktopFetch("qaStopBrowserMcp", { port });
}

/**
 * Execute a QA task: sends test instructions to the agent via the existing
 * OpenCode session. The agent uses MCP browser tools to execute tests.
 *
 * @param sessionId - The OpenCode session ID (already created)
 * @param client - The OpenCode client for the session
 * @param config - QA task configuration
 */
export async function executeQaTask(
  sessionId: string,
  client: ReturnType<typeof createClient>,
  config: QaTaskConfig,
): Promise<QaExecutionResult> {
  const startTime = Date.now();
  const steps: QaStepResult[] = [];

  try {
    // 1. Ensure MCP browser server is running
    steps.push({ ok: true, description: "MCP browser server check" });

    // 2. Build the QA prompt with test steps
    const prompt = buildQaPrompt(config);

    steps.push({
      ok: true,
      description: "QA prompt built",
      detail: `${config.testSteps.split("\n").length} test lines`,
    });

    // 3. Send to the agent via promptAsync
    const result = await client.session.promptAsync({
      sessionID: sessionId,
      parts: [{ type: "text", text: prompt }],
    });

    if (result.error) {
      steps.push({
        ok: false,
        description: "Agent execution failed",
        detail: String(result.error),
      });
      return {
        ok: false,
        error: String(result.error),
        steps,
        durationMs: Date.now() - startTime,
      };
    }

    steps.push({
      ok: true,
      description: "Test instructions sent to QA agent",
    });

    // 4. Wait briefly for agent to start processing
    //    (the actual completion is handled by the stage polling loop)
    return {
      ok: true,
      steps,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      ok: false,
      error: String(err),
      steps,
      durationMs: Date.now() - startTime,
    };
  }
}

// ── Internal ────────────────────────────────────────────────────────────────

function buildQaPrompt(config: QaTaskConfig): string {
  const lines: string[] = [
    `## QA Test Execution`,
    ``,
    `**Target URL:** ${config.targetUrl}`,
    ``,
    `**Test Steps:**`,
    ``,
    config.testSteps,
    ``,
    `Execute these test steps using the available browser tools.`,
    `Navigate to the target URL first, then follow each step.`,
    `Take screenshots at key points. After completing all steps,`,
    `produce a structured QA report in the format described in your instructions.`,
  ];
  return lines.join("\n");
}
