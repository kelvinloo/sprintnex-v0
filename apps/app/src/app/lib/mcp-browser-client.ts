/**
 * MCP Browser Client – HTTP client for the MCP browser server (Playwright).
 * Uses the FastMCP streamable-http transport.
 */

const DEFAULT_BASE_URL = "http://127.0.0.1:8812";
const DEFAULT_TIMEOUT_MS = 30_000;
const MCP_PROTOCOL_VERSION = "2025-06-18";

export type McpToolResult = Record<string, unknown>;

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

/** Extract a human-readable message from a JSON-RPC error value. */
function formatMcpError(error: unknown): string {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Parse a streamable-http SSE payload and return the JSON-RPC message JSON.
 * Handles `data: {...}` lines and the JSON-over-SSE envelope.
 */
function parseSseJson(text: string): Record<string, unknown> | null {
  let collected = "";
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("data:")) {
      const payload = line.slice(5).trim();
      if (payload) collected += payload;
    }
  }
  if (!collected) {
    // Fallback: treat the whole body as JSON (some servers send plain JSON).
    collected = text.trim();
  }
  try {
    return JSON.parse(collected) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export class McpBrowserClient {
  private baseUrl: string;
  private timeoutMs: number;
  private sessionId: string | null = null;

  constructor(options: { baseUrl?: string; timeoutMs?: number } = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "Mcp-Protocol-Version": MCP_PROTOCOL_VERSION,
    };
    if (this.sessionId) headers["Mcp-Session-Id"] = this.sessionId;
    return headers;
  }

  /** Send a JSON-RPC request and return the parsed result (or throw). */
  private async sendRequest(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: generateId(),
          method,
          params,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`MCP browser server error: HTTP ${response.status}`);
      }

      // Persist the session id if the server returns one (streamable-http).
      const sessionHeader = response.headers.get("mcp-session-id");
      if (sessionHeader) this.sessionId = sessionHeader;

      const contentType =
        response.headers.get("content-type") ?? "application/json";
      if (contentType.includes("text/event-stream")) {
        const text = await response.text();
        const json = parseSseJson(text);
        if (json?.error) {
          throw new Error(`MCP tool error: ${formatMcpError(json.error)}`);
        }
        return json?.result ?? {};
      }

      const json = (await response.json()) as Record<string, unknown>;
      if (json.error) {
        throw new Error(`MCP tool error: ${formatMcpError(json.error)}`);
      }
      return json.result ?? {};
    } finally {
      clearTimeout(timeout);
    }
  }

  private async callTool(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<McpToolResult> {
    const result = await this.sendRequest("tools/call", {
      name,
      arguments: args,
    });
    return (result ?? {}) as McpToolResult;
  }

  async navigate(url: string): Promise<McpToolResult> {
    return this.callTool("navigate", { url });
  }

  async screenshot(url: string, fullPage = false): Promise<McpToolResult> {
    return this.callTool("screenshot", { url, full_page: fullPage });
  }

  async fullPageScreenshot(url: string): Promise<McpToolResult> {
    return this.callTool("full_page_screenshot", { url });
  }

  async click(url: string, selector: string): Promise<McpToolResult> {
    return this.callTool("click", { url, selector });
  }

  async typeText(
    url: string,
    selector: string,
    text: string,
  ): Promise<McpToolResult> {
    return this.callTool("type_text", { url, selector, text });
  }

  async waitForSelector(
    url: string,
    selector: string,
    timeoutMs = 10000,
  ): Promise<McpToolResult> {
    return this.callTool("wait_for_selector", {
      url,
      selector,
      timeout_ms: timeoutMs,
    });
  }

  async getText(url: string, selector = "body"): Promise<McpToolResult> {
    return this.callTool("get_text", { url, selector });
  }

  async scrape(url: string, selector = "body"): Promise<McpToolResult> {
    return this.callTool("scrape", { url, selector });
  }

  async executeScript(url: string, script: string): Promise<McpToolResult> {
    return this.callTool("execute_script", { url, script });
  }

  async health(): Promise<boolean> {
    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: generateId(),
          method: "tools/list",
        }),
        signal: AbortSignal.timeout(2000),
      });
      if (!response.ok) return false;
      const sessionHeader = response.headers.get("mcp-session-id");
      if (sessionHeader) this.sessionId = sessionHeader;
      return true;
    } catch {
      return false;
    }
  }
}
