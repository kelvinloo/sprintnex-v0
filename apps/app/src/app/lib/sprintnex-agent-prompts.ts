/**
 * DEPRECATED: Backward compatibility layer for hardcoded agent prompts.
 *
 * Agent context and prompts are now fully dynamic from the n8n endpoint.
 * Consumers should work with Agent objects selected from UI dropdowns,
 * not assume hardcoded agent names.
 *
 * To use agents:
 * 1. Call ensureSprintnexAgentsCached() to fetch all agents
 * 2. Use selectAgent(agentName) or getDefaultAgents() to find agents
 * 3. Use the Agent object's `prompt` field directly
 *
 * These constants are empty fallbacks only.
 */

import { ensureSprintnexAgentsCached } from "./sprintnex-aicoe-api";

// Pre-warm cache on module load
void ensureSprintnexAgentsCached();

/**
 * @deprecated Agents are dynamic. Use selectAgent() or getDefaultAgents() instead.
 */
export const WORKSPACE_AGENT_PROMPT = "";

/**
 * @deprecated Agents are dynamic. Fetch from endpoint and use agent.prompt.
 */
export const WORKSPACE_AGENT_OUTPUT_FORMAT = "";

/**
 * @deprecated Agents are dynamic. Use selectAgent() or getDefaultAgents() instead.
 */
export const DELIVERY_AGENT_PROMPT = "";

/**
 * @deprecated Agents are dynamic. Use selectAgent() or getDefaultAgents() instead.
 */
export const QA_AGENT_PROMPT = "";
