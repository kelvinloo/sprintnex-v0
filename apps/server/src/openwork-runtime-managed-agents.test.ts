import { describe, expect, test } from "bun:test";

import { normalizeManagedSubagents } from "./openwork-runtime-config.js";

describe("managed OpenCode runtime agents", () => {
  test("excludes the default agent and injects specialists as subagents", () => {
    const agents = normalizeManagedSubagents({
      agents: [
        {
          name: "sprintnex-agent",
          description: "sprintnex-default-agent",
          mode: "primary",
          isDefault: true,
          prompt: "Default prompt",
        },
        {
          name: "sprintnex-code-reviewer",
          description: "System default code reviewer agent",
          mode: "primary",
          hidden: false,
          isDefault: false,
          prompt: "Review code",
        },
      ],
    });

    expect(agents["sprintnex-agent"]).toBeUndefined();
    expect(agents["sprintnex-code-reviewer"]).toEqual({
      description: "System default code reviewer agent",
      mode: "subagent",
      prompt: "Review code",
      hidden: false,
    });
  });
});
