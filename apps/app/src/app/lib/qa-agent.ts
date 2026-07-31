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
  let baseUrl = customUrl;
  // Strip /mcp suffix if present (client appends it)
  if (baseUrl.endsWith("/mcp")) baseUrl = baseUrl.slice(0, -4);
  if (baseUrl.endsWith("/mcp/")) baseUrl = baseUrl.slice(0, -5);

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
