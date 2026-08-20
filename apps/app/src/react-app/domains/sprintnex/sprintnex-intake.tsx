/** @jsxImportSource react */
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MessageSquare, SendHorizonal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/i18n";
import {
  createSprintnexDepartmentSession,
  getSprintnexDepartmentSessionMessages,
  getSprintnexDepartmentSessions,
  readSprintnexAicoeScope,
  submitSprintnexIntakeMessage,
  type SprintnexDepartmentMessage,
  type SprintnexDepartmentSession,
} from "@/app/lib/sprintnex-aicoe-api";

// ─── Types ──────────────────────────────────────────────────────────────────

type IntakeMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  status?: "processing";
  workflowId?: string;
  planData?: Record<string, unknown> | null;
};

type SprintnexIntakeProps = {
  onTasksCreated?: () => void;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function unwrapApiData(value: unknown): Record<string, unknown> | null {
  let current = value;
  while (
    current &&
    typeof current === "object" &&
    !Array.isArray(current) &&
    "data" in current &&
    (current as Record<string, unknown>).data &&
    typeof (current as Record<string, unknown>).data === "object"
  ) {
    current = (current as Record<string, unknown>).data as Record<
      string,
      unknown
    >;
  }
  return current as Record<string, unknown> | null;
}

function renderList(obj: Record<string, unknown>, key: string, label: string) {
  const items = obj[key];
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-dls-secondary">{label}</p>
      <ul className="list-inside list-disc space-y-0.5 text-sm text-dls-text">
        {items.map((item, i) => (
          <li key={i}>{String(item)}</li>
        ))}
      </ul>
    </div>
  );
}

/** True once the delivery plan's governance gate has been approved. */
function isPlanApproved(plan: Record<string, unknown>): boolean {
  const governance = plan.governance as Record<string, unknown> | undefined;
  return (
    governance?.approvalStatus === "APPROVED" ||
    plan.proposalStatus === "APPROVED"
  );
}

function mapMessage(
  item: SprintnexDepartmentMessage,
  index: number,
): IntakeMessage {
  let planData: Record<string, unknown> | null | undefined;
  let displayText = item.text;

  try {
    const candidate =
      (item.metadata as Record<string, unknown> | undefined)?.n8nResponse ??
      (typeof item.text === "string" ? JSON.parse(item.text) : item.text);
    const root =
      Array.isArray(candidate) && candidate.length > 0
        ? candidate[0]
        : candidate;
    const content =
      root && typeof root === "object"
        ? ((root as Record<string, unknown>).content ?? null)
        : null;
    const parsedPlan =
      content &&
      typeof content === "object" &&
      Array.isArray((content as Record<string, unknown>).tasks)
        ? (content as Record<string, unknown>)
        : root &&
            typeof root === "object" &&
            Array.isArray((root as Record<string, unknown>).tasks)
          ? (root as Record<string, unknown>)
          : null;

    if (parsedPlan) {
      planData = parsedPlan;
      const tasks = parsedPlan.tasks as unknown[];
      const phases =
        parsedPlan.deliveryPlan && typeof parsedPlan.deliveryPlan === "object"
          ? (parsedPlan.deliveryPlan as Record<string, unknown>).phases
          : null;
      const phaseCount = Array.isArray(phases) ? phases.length : "?";
      displayText =
        typeof parsedPlan.message === "string"
          ? parsedPlan.message
          : `Delivery Plan — ${tasks.length} tasks across ${phaseCount} phases. Review and approve to create tasks.`;
    } else if (root && typeof root === "object") {
      const rootMsg = (root as Record<string, unknown>).message;
      if (rootMsg !== undefined && rootMsg !== null) {
        displayText =
          typeof rootMsg === "string" ? rootMsg : JSON.stringify(rootMsg);
      }
      // else keep displayText = item.text (message was nested deeper)
    }
  } catch {
    planData = undefined;
  }

  return {
    id: item.id || `${item.role}-${item.createdAt}-${index}`,
    role: item.role,
    text: displayText,
    createdAt: item.createdAt,
    planData,
  };
}

export function SprintnexIntake({ onTasksCreated }: SprintnexIntakeProps) {
  const [allSessions, setAllSessions] = useState<SprintnexDepartmentSession[]>(
    [],
  );
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [messagesBySession, setMessagesBySession] = useState<
    Record<string, IntakeMessage[]>
  >({});
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeSession =
    allSessions.find((s) => s.sessionId === activeSessionId) ?? null;
  const messages = activeSessionId
    ? (messagesBySession[activeSessionId] ?? [])
    : [];

  // Auto-scroll
  useEffect(() => {
    if (chatRef.current)
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  // Keep input focused after sending
  useEffect(() => {
    if (!sending) inputRef.current?.focus();
  }, [sending]);

  // Sync all sessions
  const syncSessions = useCallback(async () => {
    try {
      const sessions = await getSprintnexDepartmentSessions("engineering");
      setAllSessions(sessions);
      if (!activeSessionId && sessions.length > 0) {
        setActiveSessionId(sessions[0].sessionId);
      }
    } catch {
      // Silently fail
    }
  }, [activeSessionId]);

  const createNewSession = useCallback(async () => {
    try {
      const newSession = await createSprintnexDepartmentSession("engineering");
      setAllSessions((prev) => [...prev, newSession]);
      setActiveSessionId(newSession.sessionId);
      setMessagesBySession((prev) => ({ ...prev, [newSession.sessionId]: [] }));
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void syncSessions().finally(() => setLoading(false));
  }, [syncSessions]);

  // Load messages for active session
  useEffect(() => {
    if (!activeSessionId) return;
    if (messagesBySession[activeSessionId] !== undefined) return;
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const records = await getSprintnexDepartmentSessionMessages(
          "engineering",
          activeSessionId,
          {
            limit: 200,
            offset: 0,
          },
        );
        if (!cancelled)
          setMessagesBySession((prev) => ({
            ...prev,
            [activeSessionId]: records.map(mapMessage),
          }));
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [activeSessionId, messagesBySession]);

  const replaceMessage = useCallback(
    (sessionId: string, id: string, next: IntakeMessage) => {
      setMessagesBySession((prev) => {
        const current = prev[sessionId] ?? [];
        return {
          ...prev,
          [sessionId]: current.some((m) => m.id === id)
            ? current.map((m) => (m.id === id ? next : m))
            : [...current, next],
        };
      });
    },
    [],
  );

  const pollIntakeResult = useCallback(
    async (sessionId: string, workflowId: string, placeholderId: string) => {
      const startedAt = Date.now();
      const timeoutMs = 10 * 60 * 1000;
      while (Date.now() - startedAt < timeoutMs) {
        await new Promise((r) => setTimeout(r, 2500));
        try {
          const records = await getSprintnexDepartmentSessionMessages(
            "engineering",
            sessionId,
            {
              limit: 200,
              offset: 0,
            },
          );
          const callback = [...records]
            .reverse()
            .find(
              (item) =>
                item.role === "assistant" &&
                (item.metadata as Record<string, unknown> | undefined)
                  ?.workflowId === workflowId,
            );
          if (callback) {
            replaceMessage(
              sessionId,
              placeholderId,
              mapMessage(callback, records.length),
            );
            return;
          }
        } catch {
          // Keep polling
        }
      }
      replaceMessage(sessionId, placeholderId, {
        id: placeholderId,
        role: "assistant",
        text: "Still processing. Refresh to check the latest response.",
        createdAt: new Date().toISOString(),
      });
    },
    [replaceMessage],
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !activeSessionId) return;
    const sid = activeSessionId;
    setInput("");
    setSending(true);

    const userMsg: IntakeMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text,
      createdAt: new Date().toISOString(),
    };
    const placeholderId = `processing-${Date.now()}`;
    const placeholderMsg: IntakeMessage = {
      id: placeholderId,
      role: "assistant",
      text: t("sprintnex.intake.processing_intake"),
      createdAt: new Date().toISOString(),
      status: "processing",
    };
    setMessagesBySession((prev) => ({
      ...prev,
      [sid]: [...(prev[sid] ?? []), userMsg, placeholderMsg],
    }));

    try {
      const result = await submitSprintnexIntakeMessage("engineering", sid, {
        message: text,
      });
      const data = unwrapApiData(result);
      if (data?.accepted && typeof data.workflowId === "string") {
        replaceMessage(sid, placeholderId, {
          ...placeholderMsg,
          status: "processing",
          workflowId: data.workflowId as string,
        });
        void pollIntakeResult(sid, data.workflowId as string, placeholderId);
      } else {
        const n8nResponse =
          (data as Record<string, unknown> | null)?.n8nResponse ?? data;
        const displayText =
          n8nResponse && typeof n8nResponse === "object"
            ? JSON.stringify(n8nResponse, null, 2)
            : String(n8nResponse ?? "");
        replaceMessage(sid, placeholderId, {
          ...placeholderMsg,
          text: displayText,
          status: undefined,
        });
      }
    } catch (err) {
      replaceMessage(sid, placeholderId, {
        ...placeholderMsg,
        text: t("sprintnex.common.error_with_message", {
          message:
            err instanceof Error
              ? err.message
              : t("sprintnex.common.failed_to_send"),
        }),
        status: undefined,
      });
    } finally {
      setSending(false);
    }
  }, [input, sending, activeSessionId, replaceMessage, pollIntakeResult]);

  // ── Render ──

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-dls-secondary">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading intake session...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Session controls */}
      <div className="shrink-0 border-b border-dls-border px-4 py-2">
        <div className="flex items-center gap-2">
          <select
            className="h-8 flex-1 rounded-md border border-dls-border bg-dls-surface px-2 text-xs text-foreground"
            value={activeSessionId}
            onChange={(e) => setActiveSessionId(e.target.value)}
            disabled={loading}
            aria-label={t("sprintnex.intake.aria_session")}
          >
            {allSessions.length === 0 && (
              <option value="">{t("sprintnex.intake.no_sessions")}</option>
            )}
            {allSessions.map((s) => (
              <option key={s.sessionId} value={s.sessionId}>
                {s.name ||
                  t("sprintnex.intake.session", {
                    id: s.sessionId.slice(0, 8),
                  })}{" "}
                —{" "}
                {new Date(s.createdAt).toLocaleDateString()}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void createNewSession()}
            disabled={loading}
          >
            {t("sprintnex.intake.new_session")}
          </Button>
        </div>
      </div>
      {/* Messages */}
      <div
        ref={chatRef}
        className="min-h-0 flex-1 overflow-y-auto space-y-3 p-4"
      >
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-dls-secondary">
            <Loader2 className="mr-2 size-4 animate-spin" />
            {t("sprintnex.intake.loading_session")}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="mb-3 size-8 text-dls-tertiary" />
            <p className="text-sm font-medium text-dls-text">
              {t("sprintnex.intake.empty_title")}
            </p>
            <p className="mt-1 text-xs text-dls-secondary">
              {t("sprintnex.intake.empty_description")}
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`max-w-3xl rounded-lg border p-3 text-sm ${
                msg.role === "user"
                  ? "ml-auto border-blue-7/40 bg-blue-2/40"
                  : "border-dls-border bg-dls-bg"
              }`}
            >
              <div className="mb-1 text-xs font-medium text-dls-secondary">
                {msg.role === "user"
                  ? t("sprintnex.intake.you")
                  : msg.status === "processing"
                    ? t("sprintnex.intake.processing")
                    : t("sprintnex.intake.sprintnex")}
              </div>
              <pre className="whitespace-pre-wrap font-sans leading-6 text-dls-text">
                {msg.text}
              </pre>
              {msg.planData ? (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className="border-green-7/30 bg-green-2/40 text-green-11"
                    >
                      {t("sprintnex.intake.task_count", {
                        count:
                          (msg.planData.tasks as unknown[])?.length || 0,
                      })}
                    </Badge>
                    {msg.planData.deliveryPlan &&
                    typeof msg.planData.deliveryPlan === "object" &&
                    "phases" in
                      (msg.planData.deliveryPlan as Record<string, unknown>) &&
                    Array.isArray(
                      (msg.planData.deliveryPlan as Record<string, unknown>)
                        .phases,
                    ) ? (
                      <Badge
                        variant="outline"
                        className="border-blue-7/30 bg-blue-2/40 text-blue-11"
                      >
                        {
                          (msg.planData.deliveryPlan as { phases: unknown[] })
                            .phases.length
                        }{" "}
                        phases
                      </Badge>
                    ) : null}
                    {Array.isArray(msg.planData.questions) &&
                    msg.planData.questions.length > 0 ? (
                      <Badge
                        variant="outline"
                        className="border-amber-7/30 bg-amber-2/40 text-amber-11"
                      >
                        {msg.planData.questions.length} questions
                      </Badge>
                    ) : null}
                  </div>
                  {Array.isArray(msg.planData.questions) &&
                  msg.planData.questions.length > 0 ? (
                    <div className="mt-3 space-y-2 rounded-lg border border-amber-7/20 bg-amber-1/30 p-3">
                      <p className="text-xs font-medium text-amber-11">
                        Clarification needed:
                      </p>
                      <ol className="list-inside list-decimal space-y-1.5 text-sm text-dls-text">
                        {(msg.planData.questions as unknown[]).map((q, qi) => {
                          const text =
                            q && typeof q === "object"
                              ? String(
                                  (q as Record<string, unknown>).question ??
                                    JSON.stringify(q),
                                )
                              : String(q ?? "");
                          return <li key={qi}>{text}</li>;
                        })}
                      </ol>
                    </div>
                  ) : null}

                  {/* Requirement — hidden once the plan is approved */}
                  {!isPlanApproved(msg.planData) &&
                  msg.planData.requirement &&
                  typeof msg.planData.requirement === "object" ? (
                    <div className="mt-3 space-y-3 rounded-lg border border-blue-7/20 bg-blue-1/30 p-3">
                      <p className="text-xs font-medium text-blue-11">
                        Requirement
                      </p>
                      {(msg.planData.requirement as Record<string, unknown>)
                        .title ? (
                        <p className="text-sm font-medium text-dls-text">
                          {
                            (
                              msg.planData.requirement as Record<
                                string,
                                unknown
                              >
                            ).title as string
                          }
                        </p>
                      ) : null}
                      {(msg.planData.requirement as Record<string, unknown>)
                        .summary ? (
                        <p className="text-sm leading-6 text-dls-secondary">
                          {
                            (
                              msg.planData.requirement as Record<
                                string,
                                unknown
                              >
                            ).summary as string
                          }
                        </p>
                      ) : null}
                      {renderList(
                        msg.planData.requirement as Record<string, unknown>,
                        "userRequirements",
                        t("sprintnex.intake.user_requirements"),
                      )}
                      {renderList(
                        msg.planData.requirement as Record<string, unknown>,
                        "constraints",
                        t("sprintnex.intake.constraints"),
                      )}
                      {renderList(
                        msg.planData.requirement as Record<string, unknown>,
                        "outOfScope",
                        t("sprintnex.intake.out_of_scope"),
                      )}
                      {renderList(
                        msg.planData.requirement as Record<string, unknown>,
                        "assumptions",
                        t("sprintnex.intake.assumptions"),
                      )}
                    </div>
                  ) : null}

                  {/* Tasks — hidden once the plan is approved */}
                  {!isPlanApproved(msg.planData) &&
                  Array.isArray(msg.planData.tasks) &&
                  msg.planData.tasks.length > 0 ? (
                    <div className="mt-3 space-y-3">
                      <p className="text-xs font-medium text-green-11">
                        {t("sprintnex.intake.tasks")}
                      </p>
                      {(msg.planData.tasks as Record<string, unknown>[]).map(
                        (task, ti) => (
                          <div
                            key={ti}
                            className="rounded-lg border border-green-7/20 bg-green-1/30 p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-dls-text">
                                {task.title as string}
                              </p>
                              {task.priority ? (
                                <Badge
                                  variant="outline"
                                  className="shrink-0 border-green-7/30 text-green-11"
                                >
                                  {task.priority as string}
                                </Badge>
                              ) : null}
                            </div>
                            {task.taskId ? (
                              <p className="mt-1 text-xs text-dls-tertiary">
                                {task.taskId as string}
                                {Array.isArray(task.dependencies) &&
                                task.dependencies.length > 0
                                  ? ` · Depends on: ${(task.dependencies as string[]).join(", ")}`
                                  : ""}
                              </p>
                            ) : null}
                            {task.summary ? (
                              <p className="mt-2 text-sm leading-6 text-dls-secondary">
                                {task.summary as string}
                              </p>
                            ) : null}
                          </div>
                        ),
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-dls-border p-3">
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Describe what engineering needs to deliver..."
          className="min-h-20 resize-none"
          disabled={sending}
        />
        <div className="mt-2 flex justify-end">
          <Button
            onClick={() => void handleSend()}
            disabled={sending || !input.trim()}
          >
            {sending ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <SendHorizonal className="mr-1 size-4" />
            )}
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
