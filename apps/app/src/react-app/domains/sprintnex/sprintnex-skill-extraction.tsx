/** @jsxImportSource react */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  FileText,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  Upload,
  User,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { t } from "@/i18n";
import { readSprintnexAicoeScope } from "@/app/lib/sprintnex-aicoe-api";

// ── Types ───────────────────────────────────────────────────────────────────

type InterviewMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
};

type ExtractedSkill = {
  name: string;
  category: string;
  domain: string;
  confidenceLevel: string;
  yearsOfExperience: number;
  description: string;
  realProjectExamples: string[];
  commonMistakes: string[];
  reusablePatterns: string[];
  toolsFrameworks: string[];
  aiCoeUsage: string[];
  confidenceScore: number;
  missingInformation: string[];
};

type UploadedFile = {
  name: string;
  size: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  uploadedAt?: string;
};

// ── Constants ───────────────────────────────────────────────────────────────

const AICOE_BASE =
  typeof import.meta.env?.VITE_AICOE_BASE === "string" &&
  import.meta.env.VITE_AICOE_BASE.trim()
    ? import.meta.env.VITE_AICOE_BASE
    : "https://platform.sprintnex.com/api/aicoe";

const N8N_SKILL_UPLOAD_URL =
  "https://n8n.directintegrate.com/webhook/aicoe/skill/upload";

const ACCEPTED_FILE_TYPES =
  ".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md,.pptx,.ppt,.zip,.gz,.tar";

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function authHeaders(): Record<string, string> {
  const token =
    localStorage.getItem("auth_token") ||
    localStorage.getItem("accessToken") ||
    "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getScope() {
  return {
    organizationId:
      localStorage.getItem("selected_organization_id") ||
      localStorage.getItem("organization_id") ||
      "",
    teamId:
      localStorage.getItem("selected_team_id") ||
      localStorage.getItem("engineering_team_id") ||
      "",
    projectId:
      localStorage.getItem("selected_project_id") ||
      localStorage.getItem("engineering_project_id") ||
      "",
    userId: localStorage.getItem("userId") || "",
  };
}

function getInterviewApiBase(): string {
  const scope = getScope();
  const suffix = scope.projectId
    ? `?organizationId=${encodeURIComponent(scope.organizationId)}&teamId=${encodeURIComponent(scope.teamId)}&projectId=${encodeURIComponent(scope.projectId)}&userId=${encodeURIComponent(scope.userId)}`
    : `?organizationId=${encodeURIComponent(scope.organizationId)}&teamId=${encodeURIComponent(scope.teamId)}&userId=${encodeURIComponent(scope.userId)}`;
  return `${AICOE_BASE}/skill-interviews${suffix}`;
}

// ── Component ───────────────────────────────────────────────────────────────

export function SprintnexSkillExtractionPage() {
  const navigate = useNavigate();
  const scope = readSprintnexAicoeScope();

  // ── Tab state ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("interview");

  // ── Interview state ────────────────────────────────────────────────────
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [domain, setDomain] = useState("");
  const [context, setContext] = useState("");
  const [showDomainInput, setShowDomainInput] = useState(true);
  const [extractedSkill, setExtractedSkill] = useState<ExtractedSkill | null>(
    null,
  );
  const [extracting, setExtracting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Upload evidence state ──────────────────────────────────────────────
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  // ── Scroll to bottom ───────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Start Interview ────────────────────────────────────────────────────
  const handleStartInterview = useCallback(async () => {
    if (!domain.trim()) return;
    setInterviewLoading(true);
    setShowDomainInput(false);

    try {
      const res = await fetch(getInterviewApiBase(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          domain: domain.trim(),
          context: context.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to start interview: ${res.status}`);
      }

      const data = await res.json();
      const sid = data.sessionId || data.id || data._id || "";
      setSessionId(sid);
      setInterviewStarted(true);

      // If the response includes an initial assistant message, show it
      const initialMsg: InterviewMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        text:
          data.message ||
          data.welcomeMessage ||
          `Hello! I'll interview you about **${domain.trim()}**. Tell me about your experience with this skill — what projects have you worked on, what tools have you used, and what level of expertise would you say you have?`,
        createdAt: new Date().toISOString(),
      };
      setMessages([initialMsg]);
    } catch {
      setShowDomainInput(true);
    } finally {
      setInterviewLoading(false);
    }
  }, [domain, context]);

  // ── Send Message ───────────────────────────────────────────────────────
  const handleSendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !sessionId || sending) return;

    setSending(true);
    const userMsg: InterviewMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");

    try {
      const res = await fetch(
        `${AICOE_BASE}/skill-interviews/${sessionId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          body: JSON.stringify({ text }),
        },
      );

      if (!res.ok) {
        throw new Error(`Failed to send message: ${res.status}`);
      }

      const data = await res.json();
      const replyText =
        data.message ||
        data.response ||
        data.text ||
        "Thanks for sharing! Can you tell me more about your experience?";

      const assistantMsg: InterviewMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: replyText,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: InterviewMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        text: "Sorry, I encountered an error processing your message. Please try again.",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  }, [inputText, sessionId, sending]);

  // ── Extract Skill ──────────────────────────────────────────────────────
  const handleExtractSkill = useCallback(async () => {
    if (!sessionId || extracting) return;
    setExtracting(true);

    try {
      const res = await fetch(
        `${AICOE_BASE}/skill-interviews/${sessionId}/extract`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
        },
      );

      if (!res.ok) {
        throw new Error(`Failed to extract skill: ${res.status}`);
      }

      const data = await res.json();
      const skill = data.skill || data.data || data;

      setExtractedSkill({
        name: skill.name || "",
        category: skill.category || "",
        domain: skill.domain || domain,
        confidenceLevel: skill.confidenceLevel || "medium",
        yearsOfExperience: skill.yearsOfExperience || 0,
        description: skill.description || "",
        realProjectExamples: skill.realProjectExamples || [],
        commonMistakes: skill.commonMistakes || [],
        reusablePatterns: skill.reusablePatterns || [],
        toolsFrameworks: skill.toolsFrameworks || [],
        aiCoeUsage: skill.aiCoeUsage || [],
        confidenceScore: skill.confidenceScore || 0,
        missingInformation: skill.missingInformation || [],
      });
    } catch {
      // non-blocking — user can retry
    } finally {
      setExtracting(false);
    }
  }, [sessionId, extracting, domain]);

  // ── Upload Evidence File ───────────────────────────────────────────────
  const handleUploadFile = useCallback(async (file: File) => {
    const fileEntry: UploadedFile = {
      name: file.name,
      size: file.size,
      status: "pending",
    };
    setUploadedFiles((prev) => [...prev, fileEntry]);
    setUploadingFile(true);

    const fd = new FormData();
    fd.append("file", file);
    const scopeData = getScope();
    fd.append("organizationId", scopeData.organizationId);
    fd.append("teamId", scopeData.teamId);
    fd.append("projectId", scopeData.projectId);
    fd.append("userId", scopeData.userId);

    try {
      const res = await fetch(N8N_SKILL_UPLOAD_URL, {
        method: "POST",
        headers: authHeaders(),
        body: fd,
      });

      if (res.ok) {
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.name === file.name
              ? {
                  ...f,
                  status: "success",
                  uploadedAt: new Date().toISOString(),
                }
              : f,
          ),
        );
      } else {
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.name === file.name
              ? {
                  ...f,
                  status: "error",
                  error: `Upload failed (${res.status})`,
                }
              : f,
          ),
        );
      }
    } catch {
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.name === file.name
            ? { ...f, status: "error", error: t("sprintnex.common.network_error") }
            : f,
        ),
      );
    } finally {
      setUploadingFile(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleUploadFile(file);
    },
    [handleUploadFile],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUploadFile(file);
      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [handleUploadFile],
  );

  const removeUploadedFile = useCallback((fileName: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.name !== fileName));
  }, []);

  // ── Key press handler ──────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage],
  );

  // ── User message count (to show Extract button) ────────────────────────
  const userMessageCount = messages.filter((m) => m.role === "user").length;
  const canExtract = userMessageCount >= 2 && !!sessionId;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-0 flex-col bg-dls-bg">
      {/* Header */}
      <div className="shrink-0 border-b border-dls-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#111827] text-white">
              <Sparkles size={16} />
            </div>
            <div>
              <h1 className="text-base font-semibold text-dls-text">
                Skill Extraction
              </h1>
              <p className="text-xs text-dls-secondary">
                {scope.projectName || scope.projectId || "No project selected"}
                {scope.teamName ? ` · ${scope.teamName}` : ""}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/session")}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 border-b border-dls-border px-6 pt-3">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="interview" className="gap-1.5">
              <MessageSquare className="size-3.5" />
              AI Interview
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-1.5">
              <Upload className="size-3.5" />
              Upload Evidence
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {/* ── Tab 1: AI Interview ─────────────────────────────────────────── */}
        {activeTab === "interview" && (
          <div className="flex h-full flex-col gap-4">
            {showDomainInput && !interviewStarted ? (
              /* Domain/context input form */
              <div className="mx-auto flex w-full max-w-lg flex-col gap-4 rounded-lg border border-dls-border bg-dls-surface p-6">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-5 text-blue-500" />
                  <h2 className="text-sm font-semibold text-dls-text">
                    New Skill Interview
                  </h2>
                </div>
                <p className="text-xs text-dls-secondary">
                  Describe the skill domain you want to extract and any
                  additional context. The AI will interview you to build a
                  comprehensive skill profile.
                </p>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-dls-text">
                    Skill Domain <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="e.g. React Frontend Development, Kubernetes DevOps, Data Engineering"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-dls-text">
                    Context (optional)
                  </label>
                  <Textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="e.g. Industry, team size, project type, specific technologies..."
                    className="min-h-[80px] resize-none text-sm"
                    rows={3}
                  />
                </div>
                <Button
                  onClick={handleStartInterview}
                  loading={interviewLoading}
                  disabled={!domain.trim()}
                >
                  <MessageSquare className="size-3.5" />
                  Start Interview
                </Button>
              </div>
            ) : (
              /* Chat interface */
              <div className="flex flex-1 flex-col gap-4">
                {/* Chat messages */}
                <div className="flex-1 rounded-lg border border-dls-border bg-dls-surface">
                  <ScrollArea className="h-full">
                    <div className="flex flex-col gap-3 p-4">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex gap-3 ${
                            msg.role === "user"
                              ? "flex-row-reverse"
                              : "flex-row"
                          }`}
                        >
                          {/* Avatar */}
                          <div
                            className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                              msg.role === "user"
                                ? "bg-blue-100 text-blue-600"
                                : "bg-[#111827] text-white"
                            }`}
                          >
                            {msg.role === "user" ? (
                              <User className="size-4" />
                            ) : (
                              <Bot className="size-4" />
                            )}
                          </div>

                          {/* Message bubble */}
                          <div
                            className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                              msg.role === "user"
                                ? "bg-blue-500 text-white"
                                : "bg-dls-bg text-dls-text"
                            }`}
                          >
                            <div
                              className={`whitespace-pre-wrap ${
                                msg.role === "user"
                                  ? "text-white"
                                  : "text-dls-text"
                              }`}
                            >
                              {msg.text}
                            </div>
                            <p
                              className={`mt-1 text-[10px] ${
                                msg.role === "user"
                                  ? "text-blue-200"
                                  : "text-dls-tertiary"
                              }`}
                            >
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                      ))}

                      {/* Typing indicator */}
                      {sending && (
                        <div className="flex gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#111827] text-white">
                            <Bot className="size-4" />
                          </div>
                          <div className="flex items-center gap-1.5 rounded-xl bg-dls-bg px-4 py-3">
                            <Loader2 className="size-3.5 animate-spin text-dls-secondary" />
                            <span className="text-xs text-dls-secondary">
                              Thinking...
                            </span>
                          </div>
                        </div>
                      )}

                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                </div>

                {/* Input bar */}
                <div className="flex items-center gap-2">
                  <Input
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your response..."
                    className="h-9 text-sm"
                    disabled={sending}
                  />
                  <Button
                    size="sm"
                    className="h-9 shrink-0"
                    onClick={handleSendMessage}
                    disabled={!inputText.trim() || sending}
                  >
                    {sending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                  </Button>
                </div>

                {/* Extract Skill button */}
                {canExtract && !extractedSkill && (
                  <div className="flex justify-center">
                    <Button
                      onClick={handleExtractSkill}
                      loading={extracting}
                      variant="default"
                      className="gap-2"
                    >
                      <Sparkles className="size-4" />
                      Extract Skill
                    </Button>
                  </div>
                )}

                {/* Extracting indicator */}
                {extracting && (
                  <div className="flex items-center justify-center gap-2 rounded-lg border border-dls-border bg-dls-surface p-4">
                    <Loader2 className="size-4 animate-spin text-blue-500" />
                    <span className="text-sm text-dls-secondary">
                      Extracting skill profile from interview...
                    </span>
                  </div>
                )}

                {/* Extracted skill result */}
                {extractedSkill && (
                  <div className="rounded-lg border border-dls-border bg-dls-surface">
                    <div className="flex items-center justify-between border-b border-dls-border px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="size-4 text-blue-500" />
                        <h3 className="text-sm font-semibold text-dls-text">
                          Extracted Skill
                        </h3>
                      </div>
                      <Badge
                        variant={
                          extractedSkill.confidenceScore >= 0.7
                            ? "secondary"
                            : extractedSkill.confidenceScore >= 0.4
                              ? "outline"
                              : "destructive"
                        }
                        className="text-[10px]"
                      >
                        {Math.round(extractedSkill.confidenceScore * 100)}%
                        confident
                      </Badge>
                    </div>

                    <div className="flex flex-col gap-3 p-4">
                      {/* Name + Category */}
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-semibold text-dls-text">
                          {extractedSkill.name || "Untitled Skill"}
                        </h4>
                        {extractedSkill.category && (
                          <Badge variant="outline" className="text-[10px]">
                            {extractedSkill.category}
                          </Badge>
                        )}
                      </div>

                      {/* Domain */}
                      {extractedSkill.domain && (
                        <div className="flex items-center gap-2 text-xs text-dls-secondary">
                          <span className="font-medium">
                            {t("sprintnex.common.domain")}
                          </span>
                          <span>{extractedSkill.domain}</span>
                        </div>
                      )}

                      {/* Confidence Level + Years */}
                      <div className="flex flex-wrap gap-3 text-xs text-dls-secondary">
                        <span>
                          <span className="font-medium">
                            {t("sprintnex.common.level")}
                          </span>{" "}
                          {extractedSkill.confidenceLevel}
                        </span>
                        <Separator orientation="vertical" className="h-3.5" />
                        <span>
                          <span className="font-medium">
                            {t("sprintnex.common.experience")}
                          </span>{" "}
                          {extractedSkill.yearsOfExperience > 0
                            ? `${extractedSkill.yearsOfExperience} years`
                            : "Not specified"}
                        </span>
                      </div>

                      {/* Description */}
                      {extractedSkill.description && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-dls-secondary">
                            Description
                          </p>
                          <p className="text-sm text-dls-text">
                            {extractedSkill.description}
                          </p>
                        </div>
                      )}

                      <Separator />

                      {/* Real Project Examples */}
                      {extractedSkill.realProjectExamples.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-dls-secondary">
                            Real Project Examples
                          </p>
                          <ul className="list-inside list-disc space-y-0.5 text-sm text-dls-text">
                            {extractedSkill.realProjectExamples.map((ex, i) => (
                              <li key={i}>{ex}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Common Mistakes */}
                      {extractedSkill.commonMistakes.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-dls-secondary">
                            Common Mistakes
                          </p>
                          <ul className="list-inside list-disc space-y-0.5 text-sm text-dls-text">
                            {extractedSkill.commonMistakes.map((mistake, i) => (
                              <li key={i}>{mistake}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Reusable Patterns */}
                      {extractedSkill.reusablePatterns.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-dls-secondary">
                            Reusable Patterns
                          </p>
                          <ul className="list-inside list-disc space-y-0.5 text-sm text-dls-text">
                            {extractedSkill.reusablePatterns.map(
                              (pattern, i) => (
                                <li key={i}>{pattern}</li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}

                      {/* Tools & Frameworks */}
                      {extractedSkill.toolsFrameworks.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-dls-secondary">
                            Tools & Frameworks
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {extractedSkill.toolsFrameworks.map((tool, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="text-[10px]"
                              >
                                {tool}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* AI/COE Usage */}
                      {extractedSkill.aiCoeUsage.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-dls-secondary">
                            AI/COE Usage
                          </p>
                          <ul className="list-inside list-disc space-y-0.5 text-sm text-dls-text">
                            {extractedSkill.aiCoeUsage.map((usage, i) => (
                              <li key={i}>{usage}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Confidence Score */}
                      {extractedSkill.confidenceScore > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-dls-secondary">
                            Confidence Score
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-dls-border">
                              <div
                                className="h-full rounded-full bg-blue-500 transition-all"
                                style={{
                                  width: `${Math.min(extractedSkill.confidenceScore * 100, 100)}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs text-dls-secondary">
                              {Math.round(extractedSkill.confidenceScore * 100)}
                              %
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Missing Information */}
                      {extractedSkill.missingInformation.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-amber-500">
                            Missing Information
                          </p>
                          <ul className="list-inside list-disc space-y-0.5 text-sm text-dls-text">
                            {extractedSkill.missingInformation.map(
                              (missing, i) => (
                                <li key={i}>{missing}</li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Tab 2: Upload Evidence ───────────────────────────────────────── */}
        {activeTab === "upload" && (
          <div className="flex flex-col gap-4">
            {/* Drop zone */}
            <label
              className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-dls-border bg-dls-surface p-8 text-center transition-colors hover:border-blue-400"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <Upload className="size-10 text-dls-secondary" />
              <div>
                <p className="text-sm font-medium text-dls-text">
                  Drop evidence files here
                </p>
                <p className="mt-0.5 text-xs text-dls-secondary">
                  or click to browse — PDF, Word, Excel, Markdown, ZIP, and more
                </p>
              </div>
              <input
                type="file"
                className="hidden"
                accept={ACCEPTED_FILE_TYPES}
                onChange={handleFileInputChange}
                disabled={uploadingFile}
              />
            </label>

            {/* Uploading indicator */}
            {uploadingFile && (
              <div className="flex items-center gap-2 rounded-lg border border-dls-border bg-dls-surface px-4 py-3">
                <Loader2 className="size-4 animate-spin text-blue-500" />
                <span className="text-sm text-dls-secondary">
                  Uploading file...
                </span>
              </div>
            )}

            {/* Uploaded files list */}
            {uploadedFiles.length > 0 && (
              <div className="rounded-lg border border-dls-border">
                <div className="border-b border-dls-border px-4 py-2.5">
                  <h3 className="text-sm font-semibold text-dls-text">
                    Uploaded Files
                  </h3>
                </div>
                <div className="flex flex-col">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.name}
                      className="flex items-center justify-between border-b border-dls-border px-4 py-2.5 last:border-b-0"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <FileText className="size-4 shrink-0 text-blue-500" />
                        <div className="min-w-0">
                          <p className="truncate text-sm text-dls-text">
                            {file.name}
                          </p>
                          <p className="text-xs text-dls-secondary">
                            {formatFileSize(file.size)}
                            {file.uploadedAt &&
                              ` · ${new Date(file.uploadedAt).toLocaleString()}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {file.status === "pending" && (
                          <Badge variant="outline" className="text-[10px]">
                            Pending
                          </Badge>
                        )}
                        {file.status === "uploading" && (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-blue-500"
                          >
                            Uploading...
                          </Badge>
                        )}
                        {file.status === "success" && (
                          <Badge variant="secondary" className="text-[10px]">
                            Uploaded
                          </Badge>
                        )}
                        {file.status === "error" && (
                          <Badge variant="destructive" className="text-[10px]">
                            {file.error || t("sprintnex.common.error")}
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="size-6 text-dls-secondary hover:text-red-500"
                          onClick={() => removeUploadedFile(file.name)}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {uploadedFiles.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dls-border bg-dls-surface p-8 text-center">
                <FileText className="size-8 text-dls-tertiary" />
                <p className="text-sm text-dls-secondary">
                  No files uploaded yet
                </p>
                <p className="text-xs text-dls-tertiary">
                  Drag and drop evidence files above to begin
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
