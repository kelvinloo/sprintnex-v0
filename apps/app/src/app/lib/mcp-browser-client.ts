/**
 * MCP Browser Client – HTTP client for the MCP browser server (Playwright).
 * Uses the FastMCP streamable-http transport.
 */

const DEFAULT_BASE_URL = "http://127.0.0.1:8812";
const DEFAULT_TIMEOUT_MS = 30_000;

export type McpToolResult = Record<string, unknown>;

function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export class McpBrowserClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(options: { baseUrl?: string; timeoutMs?: number } = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private async callTool(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<McpToolResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: generateId(),
          method: "tools/call",
          params: { name, arguments: args },
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`MCP browser server error: HTTP ${response.status}`);
      }
      const json = await response.json();
      if (json.error) {
        throw new Error(
          `MCP tool error: ${json.error.message ?? JSON.stringify(json.error)}`,
        );
      }
      return (json.result ?? {}) as McpToolResult;
    } finally {
      clearTimeout(timeout);
    }
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
      const response = await fetch(`${this.baseUrl}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: generateId(),
          method: "tools/list",
        }),
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
