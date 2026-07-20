import type { SprintnexAicoeScope } from "./sprintnex-aicoe-api";

const WEBHOOK_URL =
  "https://platform.sprintnex.com/api/webhooks/n8n/tasks/bulk";

/**
 * Build mandatory Sprintnex task creation instructions for the agent.
 * These are injected into every session on a Sprintnex-mapped workspace so the
 * agent can create Sprintnex tasks directly from conversation.
 */
export function buildSprintnexTaskCreationInstructions(
  scope: SprintnexAicoeScope,
): string {
  const { organizationId, teamId, projectId, userId, tenantId } = scope;

  return [
    "## Sprintnex task creation",
    "",
    "You have access to Sprintnex — a structured task management system. When the user describes work,",
    "discuss the requirements, then offer to create Sprintnex tasks. If they agree, use your HTTP tool to",
    `POST ${WEBHOOK_URL}`,
    "",
    "### Request format",
    "```json",
    JSON.stringify(
      {
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": tenantId || "default",
        },
        body: {
          content: [
            {
              taskId: "TASK-001",
              title: "Short task title",
              summary: "Detailed description",
              priority: "CRITICAL | HIGH | MEDIUM | LOW",
              dependencies: [],
              metadata: {
                organizationId,
                teamId,
                projectId,
                userId,
              },
            },
          ],
        },
      },
      null,
      2,
    ),
    "```",
    "",
    "### Rules",
    "- Increment taskId for each task (TASK-001, TASK-002, etc.)",
    "- Always ask the user before creating tasks — discuss requirements first",
    "- After successful creation, tell the user the tasks are visible in the Sprintnex task view",
    "- Include the current Sprintnex scope in metadata for every task",
    "- Priority values: CRITICAL, HIGH, MEDIUM, LOW",
    "",
  ].join("\n");
}
