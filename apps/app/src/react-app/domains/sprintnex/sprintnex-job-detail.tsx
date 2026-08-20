/** @jsxImportSource react */
import { useState, useEffect } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  CheckCircle,
  Clock,
  DollarSign,
  Flag,
  MessageSquare,
  SendHorizonal,
  Star,
  ThumbsUp,
  User,
  XCircle,
  Play,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogClose,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { t } from "@/i18n";
import { AICOE_BASE } from "@/app/lib/api-config";
import { readSprintnexAicoeScope } from "@/app/lib/sprintnex-aicoe-api";

// ── Types ───────────────────────────────────────────────────────────────────

type JobDetail = {
  id: string;
  title: string;
  description: string;
  priority: string;
  tier: string;
  requiredSkills: string[];
  estimatedHours: number;
  estimatedCompletionDays: number;
  budgetAmount: number;
  budgetCurrency: string;
  posterUserId: string;
  posterName: string;
  assigneeUserId: string | null;
  assigneeName: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type Application = {
  id: string;
  jobId: string;
  applicantUserId: string;
  applicantName: string;
  coverLetter: string;
  status: string;
  createdAt: string;
};

type JobMessage = {
  id: string;
  jobId: string;
  senderUserId: string;
  senderName: string;
  message: string;
  createdAt: string;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function getApiHeaders() {
  const token =
    localStorage.getItem("auth_token") ||
    localStorage.getItem("accessToken") ||
    "";
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function getUserId(): string {
  return localStorage.getItem("userId") || "";
}

const TIER_COLORS: Record<string, string> = {
  S: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700",
  A: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700",
  B: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700",
  C: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700",
};

const STATUS_LABELS: Record<string, string> = {
  open: "sprintnex.status.open",
  pending_approval: "sprintnex.status.pending_approval",
  assigned: "sprintnex.status.assigned",
  in_progress: "sprintnex.status.in_progress",
  completed: "sprintnex.status.completed",
  cancelled: "sprintnex.status.cancelled",
  disputed: "sprintnex.status.disputed",
};

async function fetchJob(id: string): Promise<JobDetail | null> {
  try {
    const res = await fetch(`${AICOE_BASE}/marketplace/${id}`, {
      headers: getApiHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      return data?.data ?? data ?? null;
    }
  } catch {}
  return null;
}

async function fetchApplications(
  jobId: string,
  userId: string,
): Promise<Application[]> {
  try {
    const res = await fetch(
      `${AICOE_BASE}/marketplace/${jobId}/applications?userId=${encodeURIComponent(userId)}`,
      { headers: getApiHeaders() },
    );
    if (res.ok) {
      const data = await res.json();
      const raw = data?.data ?? data ?? [];
      return Array.isArray(raw) ? raw : [];
    }
  } catch {}
  return [];
}

async function fetchMessages(
  jobId: string,
  userId: string,
): Promise<JobMessage[]> {
  try {
    const res = await fetch(
      `${AICOE_BASE}/marketplace/${jobId}/messages?userId=${encodeURIComponent(userId)}`,
      { headers: getApiHeaders() },
    );
    if (res.ok) {
      const data = await res.json();
      const raw = data?.data ?? data ?? [];
      return Array.isArray(raw) ? raw : [];
    }
  } catch {}
  return [];
}

async function sendMessage(
  jobId: string,
  userId: string,
  senderName: string,
  message: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${AICOE_BASE}/marketplace/${jobId}/messages`, {
      method: "POST",
      headers: getApiHeaders(),
      body: JSON.stringify({ userId, senderName, message }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function SprintnexJobDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const scope = readSprintnexAicoeScope();
  const uid = getUserId();

  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Applicants tab
  const [applications, setApplications] = useState<Application[]>([]);

  // Chat tab
  const [messages, setMessages] = useState<JobMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  // Rating
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingReview, setRatingReview] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  // Dispute
  const [disputeReason, setDisputeReason] = useState("");
  const [submittingDispute, setSubmittingDispute] = useState(false);

  // Action loading
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const isPoster = job?.posterUserId === uid;
  const isAssignee = job?.assigneeUserId === uid;
  const isAssigned = !!job?.assigneeUserId;
  const showApplicants =
    isPoster && (job?.status === "open" || job?.status === "pending_approval");
  const showChat = isAssigned && (isPoster || isAssignee);
  const showRating = job?.status === "completed";

  const loadJob = async () => {
    if (!id) return;
    setLoading(true);
    const j = await fetchJob(id);
    setJob(j);
    setLoading(false);
  };

  const loadApplications = async () => {
    if (!id || !uid) return;
    const apps = await fetchApplications(id, uid);
    setApplications(apps);
  };

  const loadMessages = async () => {
    if (!id || !uid) return;
    const msgs = await fetchMessages(id, uid);
    setMessages(msgs);
  };

  useEffect(() => {
    loadJob();
  }, [id]);

  useEffect(() => {
    if (showApplicants) loadApplications();
  }, [job?.status, showApplicants]);

  useEffect(() => {
    if (showChat) loadMessages();
  }, [job?.status, showChat]);

  const handleApprove = async (appId: string) => {
    if (!id || !uid) return;
    setActionLoading(`approve-${appId}`);
    setActionError("");
    try {
      const res = await fetch(
        `${AICOE_BASE}/marketplace/${id}/applications/${appId}/approve`,
        {
          method: "POST",
          headers: getApiHeaders(),
          body: JSON.stringify({ userId: uid }),
        },
      );
      if (res.ok) {
        await loadJob();
        await loadApplications();
      } else {
        const data = await res.json().catch(() => null);
        setActionError(
          data?.message ?? t("sprintnex.job.approve_application_failed"),
        );
      }
    } catch {
      setActionError(t("sprintnex.common.network_error"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (appId: string) => {
    if (!id || !uid) return;
    setActionLoading(`reject-${appId}`);
    setActionError("");
    try {
      const res = await fetch(
        `${AICOE_BASE}/marketplace/${id}/applications/${appId}/reject`,
        {
          method: "POST",
          headers: getApiHeaders(),
          body: JSON.stringify({ userId: uid }),
        },
      );
      if (res.ok) {
        await loadApplications();
      } else {
        const data = await res.json().catch(() => null);
        setActionError(data?.message ?? t("sprintnex.job.reject_application_failed"));
      }
    } catch {
      setActionError(t("sprintnex.common.network_error"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendMessage = async () => {
    if (!id || !uid || !newMessage.trim()) return;
    setSendingMessage(true);
    const ok = await sendMessage(
      id,
      uid,
      scope.userId ||
        localStorage.getItem("userName") ||
        t("sprintnex.common.anonymous"),
      newMessage.trim(),
    );
    if (ok) {
      setNewMessage("");
      await loadMessages();
    }
    setSendingMessage(false);
  };

  const handleStartExecution = async () => {
    if (!id || !uid) return;
    setActionLoading("start");
    setActionError("");
    try {
      const res = await fetch(`${AICOE_BASE}/marketplace/${id}/start`, {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({ userId: uid, taskId: `${id}-task` }),
      });
      if (res.ok) {
        await loadJob();
      } else {
        const data = await res.json().catch(() => null);
        setActionError(data?.message ?? t("sprintnex.job.start_execution_failed"));
      }
    } catch {
      setActionError(t("sprintnex.common.network_error"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async () => {
    if (!id || !uid) return;
    setActionLoading("complete");
    setActionError("");
    try {
      const res = await fetch(`${AICOE_BASE}/marketplace/${id}/complete`, {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({ userId: uid }),
      });
      if (res.ok) {
        await loadJob();
      } else {
        const data = await res.json().catch(() => null);
        setActionError(data?.message ?? t("sprintnex.job.complete_failed"));
      }
    } catch {
      setActionError(t("sprintnex.common.network_error"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!id || !uid) return;
    setActionLoading("cancel");
    setActionError("");
    try {
      const res = await fetch(`${AICOE_BASE}/marketplace/${id}/cancel`, {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({ userId: uid }),
      });
      if (res.ok) {
        navigate("/sprintnex/jobs");
      } else {
        const data = await res.json().catch(() => null);
        setActionError(data?.message ?? t("sprintnex.job.cancel_failed"));
      }
    } catch {
      setActionError(t("sprintnex.common.network_error"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleFileDispute = async () => {
    if (!id || !uid || !disputeReason.trim()) return;
    setSubmittingDispute(true);
    setActionError("");
    try {
      const res = await fetch(`${AICOE_BASE}/marketplace/${id}/disputes`, {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({
          filedByUserId: uid,
          reason: disputeReason.trim(),
        }),
      });
      if (res.ok) {
        setDisputeReason("");
        await loadJob();
      } else {
        const data = await res.json().catch(() => null);
        setActionError(data?.message ?? t("sprintnex.job.dispute_failed"));
      }
    } catch {
      setActionError(t("sprintnex.common.network_error"));
    } finally {
      setSubmittingDispute(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!id || !uid || ratingScore === 0) return;
    const isRaterPoster = isPoster;
    const ratedUserId = isRaterPoster ? job?.assigneeUserId : job?.posterUserId;
    if (!ratedUserId) return;
    setSubmittingRating(true);
    try {
      const res = await fetch(`${AICOE_BASE}/marketplace/${id}/ratings`, {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({
          raterUserId: uid,
          ratedUserId,
          score: ratingScore,
          review: ratingReview.trim(),
        }),
      });
      if (res.ok) {
        setRatingSubmitted(true);
      } else {
        const data = await res.json().catch(() => null);
        setActionError(data?.message ?? t("sprintnex.job.rating_failed"));
      }
    } catch {
      setActionError(t("sprintnex.common.network_error"));
    } finally {
      setSubmittingRating(false);
    }
  };

  // ── Loading / Error ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-dls-bg">
        <div className="flex items-center justify-center py-20 text-sm text-dls-secondary">
          Loading...
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-dls-bg">
        <div className="flex items-center justify-center py-20 text-sm text-dls-secondary">
          Job not found.
        </div>
      </div>
    );
  }

  const tierColor =
    TIER_COLORS[job.tier?.toUpperCase()] ??
    "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400";

  // ── Determine default tab ─────────────────────────────────────────────────

  let defaultTab = "details";
  if (showApplicants && applications.length > 0) defaultTab = "applicants";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full min-h-0 flex-col bg-dls-bg">
      {/* Header */}
      <div className="shrink-0 border-b border-dls-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#111827] text-white shrink-0">
              <Briefcase size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold text-dls-text">
                {job.title}
              </h1>
              <p className="text-xs text-dls-secondary">
                {STATUS_LABELS[job.status]
                  ? t(STATUS_LABELS[job.status])
                  : job.status}
                {job.tier ? ` · ${job.tier}-Tier` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Action buttons */}
            {job.status === "assigned" && isAssignee && (
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handleStartExecution}
                disabled={actionLoading === "start"}
              >
                <Play className="size-3.5" />{" "}
                {actionLoading === "start" ? "Starting..." : "Start Execution"}
              </Button>
            )}
            {job.status === "in_progress" && (isPoster || isAssignee) && (
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handleComplete}
                disabled={actionLoading === "complete"}
              >
                <CheckCircle className="size-3.5" />{" "}
                {actionLoading === "complete"
                  ? "Completing..."
                  : "Complete Job"}
              </Button>
            )}
            {(job.status === "open" ||
              job.status === "assigned" ||
              job.status === "in_progress" ||
              job.status === "pending_approval") &&
              (isPoster || isAssignee) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleCancel}
                  disabled={actionLoading === "cancel"}
                >
                  <XCircle className="size-3.5" /> Cancel
                </Button>
              )}
            {(job.status === "in_progress" || job.status === "assigned") &&
              (isPoster || isAssignee) && (
                <Dialog>
                  <DialogTrigger>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs text-orange-600 border-orange-300"
                      type="button"
                    >
                      <Flag className="size-3.5" /> Dispute
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <div className="space-y-4">
                      <div>
                        <h2 className="text-base font-semibold text-dls-text">
                          File a Dispute
                        </h2>
                        <p className="text-xs text-dls-secondary">
                          Describe the issue with this job.
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-dls-secondary">
                          Reason *
                        </Label>
                        <Textarea
                          value={disputeReason}
                          onChange={(e) => setDisputeReason(e.target.value)}
                          placeholder="Explain the dispute..."
                          rows={4}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <DialogClose>
                          <Button variant="outline" size="sm" type="button">
                            Cancel
                          </Button>
                        </DialogClose>
                        <Button
                          size="sm"
                          onClick={handleFileDispute}
                          disabled={submittingDispute || !disputeReason.trim()}
                        >
                          {submittingDispute ? "Submitting..." : "File Dispute"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
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
        {/* Sub-nav: Pool / My Jobs / Post */}
        <div className="mt-2 inline-flex rounded-lg border border-dls-border bg-dls-surface p-0.5">
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-dls-secondary transition-colors hover:text-dls-text"
            onClick={() => navigate("/sprintnex/jobs")}
          >
            <Briefcase className="size-3.5" />
            Pool
          </button>
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-dls-secondary transition-colors hover:text-dls-text"
            onClick={() => navigate("/sprintnex/jobs/mine")}
          >
            My Jobs
          </button>
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-dls-secondary transition-colors hover:text-dls-text"
            onClick={() => navigate("/sprintnex/jobs/post")}
          >
            Post a Job
          </button>
        </div>
      </div>

      {/* Error banner */}
      {actionError && (
        <div className="shrink-0 border-b border-dls-border px-6 py-2">
          <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            <AlertCircle className="size-3.5 shrink-0" />
            {actionError}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-4">
        <Tabs
          defaultValue={defaultTab}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="shrink-0">
          <TabsTrigger value="details">{t("sprintnex.job.details")}</TabsTrigger>
            {showApplicants && (
              <TabsTrigger value="applicants">
                Applicants
                {applications.length > 0 && (
                  <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-medium text-primary-foreground">
                    {applications.length}
                  </span>
                )}
              </TabsTrigger>
            )}
          {showChat && (
            <TabsTrigger value="chat">{t("sprintnex.job.chat")}</TabsTrigger>
          )}
          {showRating && (
            <TabsTrigger value="rating">{t("sprintnex.job.rating")}</TabsTrigger>
          )}
          </TabsList>

          <div className="min-h-0 flex-1 pt-2">
            {/* ═══════ Details Tab ═══════ */}
            <TabsContent value="details" className="h-full overflow-y-auto">
              <div className="space-y-4">
                {/* Status + Tier badges */}
                <div className="flex items-center gap-2">
                  <Badge
                    variant={job.status === "open" ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {STATUS_LABELS[job.status]
                      ? t(STATUS_LABELS[job.status])
                      : job.status}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`border text-[10px] font-bold ${tierColor}`}
                  >
                    {job.tier}
                  </Badge>
                  {job.priority && (
                    <Badge variant="outline" className="text-[10px]">
                      {job.priority}
                    </Badge>
                  )}
                </div>

                {/* Budget */}
                <Card variant="outline" size="sm">
                  <CardContent className="flex items-center gap-6 px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="size-4 text-dls-secondary" />
                      <div>
                    <p className="text-xs text-dls-secondary">
                      {t("sprintnex.job.budget")}
                    </p>
                        <p className="text-sm font-semibold text-dls-text">
                          {job.budgetAmount?.toLocaleString() ?? "-"}{" "}
                          {job.budgetCurrency || ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="size-4 text-dls-secondary" />
                      <div>
                        <p className="text-xs text-dls-secondary">
                          Est. Completion
                        </p>
                        <p className="text-sm font-semibold text-dls-text">
                          {job.estimatedCompletionDays ?? "-"} days
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User className="size-4 text-dls-secondary" />
                      <div>
                    <p className="text-xs text-dls-secondary">
                      {t("sprintnex.job.hours")}
                    </p>
                        <p className="text-sm font-semibold text-dls-text">
                          {job.estimatedHours ?? "-"}h
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Description */}
                <div className="space-y-1">
                  <h3 className="text-xs font-medium text-dls-secondary uppercase tracking-wider">
                    Description
                  </h3>
                  <p className="whitespace-pre-wrap text-sm text-dls-text leading-relaxed">
                    {job.description || "No description provided."}
                  </p>
                </div>

                {/* Skills */}
                {job.requiredSkills && job.requiredSkills.length > 0 && (
                  <div className="space-y-1">
                    <h3 className="text-xs font-medium text-dls-secondary uppercase tracking-wider">
                      Required Skills
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {job.requiredSkills.map((skill) => (
                        <Badge
                          key={skill}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Poster / Assignee */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <h3 className="text-xs font-medium text-dls-secondary uppercase tracking-wider">
                      {t("sprintnex.job.posted_by")}
                    </h3>
                    <p className="text-sm text-dls-text">
                      {job.posterName || t("common.unknown")}
                    </p>
                  </div>
                  {job.assigneeName && (
                    <div className="space-y-1">
                      <h3 className="text-xs font-medium text-dls-secondary uppercase tracking-wider">
                        {t("sprintnex.job.assigned_to")}
                      </h3>
                      <p className="text-sm text-dls-text">
                        {job.assigneeName}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ═══════ Applicants Tab ═══════ */}
            {showApplicants && (
              <TabsContent
                value="applicants"
                className="h-full overflow-y-auto"
              >
                {applications.length === 0 ? (
                  <div className="flex items-center justify-center py-12 text-xs text-dls-secondary">
                    {t("sprintnex.job.no_applications")}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {applications.map((app) => (
                      <Card key={app.id} variant="outline" size="sm">
                        <CardContent className="px-4 py-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-medium text-dls-text">
                                {app.applicantName ||
                                  t("sprintnex.common.anonymous")}
                              </p>
                              {app.coverLetter && (
                                <p className="mt-1 text-xs text-dls-secondary whitespace-pre-wrap">
                                  {app.coverLetter}
                                </p>
                              )}
                              <p className="mt-1 text-[10px] text-dls-muted">
                                {t("sprintnex.job.applied_date", {
                                  date: new Date(
                                    app.createdAt,
                                  ).toLocaleDateString(),
                                })}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 ml-4">
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleApprove(app.id)}
                                disabled={actionLoading === `approve-${app.id}`}
                              >
                                <ThumbsUp className="size-3" />{" "}
                                {actionLoading === `approve-${app.id}`
                                  ? "..."
                                  : t("sprintnex.action.approve")}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleReject(app.id)}
                                disabled={actionLoading === `reject-${app.id}`}
                              >
                                <XCircle className="size-3" />{" "}
                                {t("sprintnex.job.reject")}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            )}

            {/* ═══════ Chat Tab ═══════ */}
            {showChat && (
              <TabsContent
                value="chat"
                className="flex h-full flex-col overflow-hidden"
              >
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  {messages.length === 0 ? (
                    <div className="flex items-center justify-center py-12 text-xs text-dls-secondary">
                      No messages yet. Start the conversation!
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.senderUserId === uid;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-lg px-3 py-2 ${
                              isMe
                                ? "bg-primary text-primary-foreground"
                                : "bg-dls-surface border border-dls-border"
                            }`}
                          >
                            <p
                              className={`text-[10px] font-medium ${
                                isMe
                                  ? "text-primary-foreground/70"
                                  : "text-dls-secondary"
                              }`}
                            >
                              {msg.senderName ||
                                t("sprintnex.common.anonymous")}
                            </p>
                            <p className="mt-0.5 text-sm whitespace-pre-wrap">
                              {msg.message}
                            </p>
                            <p
                              className={`mt-0.5 text-[9px] ${
                                isMe
                                  ? "text-primary-foreground/50"
                                  : "text-dls-muted"
                              }`}
                            >
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Message input */}
                <div className="mt-3 flex items-end gap-2 shrink-0">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    rows={2}
                    className="min-h-[40px] text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-8 shrink-0"
                    onClick={handleSendMessage}
                    disabled={sendingMessage || !newMessage.trim()}
                  >
                    <SendHorizonal className="size-3.5" />
                  </Button>
                </div>
              </TabsContent>
            )}

            {/* ═══════ Rating Tab ═══════ */}
            {showRating && (
              <TabsContent value="rating" className="h-full overflow-y-auto">
                {ratingSubmitted ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-12">
                    <CheckCircle className="size-8 text-green-500" />
                    <p className="text-sm font-medium text-dls-text">
                      Rating submitted!
                    </p>
                    <p className="text-xs text-dls-secondary">
                      Thank you for your feedback.
                    </p>
                  </div>
                ) : (
                  <div className="mx-auto max-w-md space-y-6 py-4">
                    <div className="text-center">
                      <h3 className="text-sm font-semibold text-dls-text">
                        Rate this Job
                      </h3>
                      <p className="text-xs text-dls-secondary">
                        How was your experience working on this job?
                      </p>
                    </div>

                    {/* Star selector */}
                    <div className="flex justify-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRatingScore(star)}
                          className={`p-1 transition-colors ${
                            star <= ratingScore
                              ? "text-yellow-500"
                              : "text-gray-300 dark:text-gray-600"
                          }`}
                        >
                          <Star
                            className="size-8"
                            fill={star <= ratingScore ? "currentColor" : "none"}
                          />
                        </button>
                      ))}
                    </div>

                    {ratingScore > 0 && (
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-dls-secondary">
                          Review (optional)
                        </Label>
                        <Textarea
                          value={ratingReview}
                          onChange={(e) => setRatingReview(e.target.value)}
                          placeholder="Share your feedback..."
                          rows={3}
                        />
                      </div>
                    )}

                    <div className="flex justify-center">
                      <Button
                        size="sm"
                        onClick={handleSubmitRating}
                        disabled={submittingRating || ratingScore === 0}
                      >
                        {submittingRating ? "Submitting..." : "Submit Rating"}
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            )}
          </div>
        </Tabs>
      </div>
    </div>
  );
}
