/** @jsxImportSource react */
import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Briefcase, DollarSign, RotateCw, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { t } from "@/i18n";
import { AICOE_BASE } from "@/app/lib/api-config";
import { readSprintnexAicoeScope } from "@/app/lib/sprintnex-aicoe-api";

// ── Types ───────────────────────────────────────────────────────────────────

type MyJob = {
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

// ── Colors ──────────────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  S: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700",
  A: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700",
  B: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700",
  C: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  pending_approval:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  assigned: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  completed: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  disputed:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
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

async function fetchJobsByParam(
  param: string,
  value: string,
): Promise<MyJob[]> {
  try {
    const res = await fetch(
      `${AICOE_BASE}/marketplace?${param}=${encodeURIComponent(value)}`,
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

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function SprintnexMyJobsPage() {
  const navigate = useNavigate();
  const scope = readSprintnexAicoeScope();
  const uid = getUserId();

  const [activeTab, setActiveTab] = useState<"posted" | "assigned">("posted");
  const [postedJobs, setPostedJobs] = useState<MyJob[]>([]);
  const [assignedJobs, setAssignedJobs] = useState<MyJob[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [posted, assigned] = await Promise.all([
      fetchJobsByParam("posterUserId", uid),
      fetchJobsByParam("assigneeUserId", uid),
    ]);
    setPostedJobs(posted);
    setAssignedJobs(assigned);
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  const currentJobs = activeTab === "posted" ? postedJobs : assignedJobs;

  return (
    <div className="flex h-full min-h-0 flex-col bg-dls-bg">
      {/* Header */}
      <div className="shrink-0 border-b border-dls-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#111827] text-white">
              <Briefcase size={16} />
            </div>
            <div>
              <h1 className="text-base font-semibold text-dls-text">My Jobs</h1>
              <p className="text-xs text-dls-secondary">
                {postedJobs.length} posted · {assignedJobs.length} assigned
                {scope.projectName ? ` · ${scope.projectName}` : ""}
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
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-dls-bg px-3 text-xs font-medium text-dls-text shadow-sm"
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

      {/* Sub-tabs: Posted / Assigned */}
      <div className="shrink-0 border-b border-dls-border px-6 py-2">
        <div className="inline-flex rounded-lg border border-dls-border bg-dls-surface p-0.5">
          <button
            type="button"
            className={`inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors ${
              activeTab === "posted"
                ? "bg-dls-bg text-dls-text shadow-sm"
                : "text-dls-secondary hover:text-dls-text"
            }`}
            onClick={() => setActiveTab("posted")}
          >
            <Briefcase className="size-3.5" /> Posted
            {postedJobs.length > 0 && (
              <span className="inline-flex h-3.5 items-center rounded border border-dls-border px-1 text-[9px] font-medium text-dls-secondary">
                {postedJobs.length}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors ${
              activeTab === "assigned"
                ? "bg-dls-bg text-dls-text shadow-sm"
                : "text-dls-secondary hover:text-dls-text"
            }`}
            onClick={() => setActiveTab("assigned")}
          >
            <User className="size-3.5" /> Assigned
            {assignedJobs.length > 0 && (
              <span className="inline-flex h-3.5 items-center rounded border border-dls-border px-1 text-[9px] font-medium text-dls-secondary">
                {assignedJobs.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="shrink-0 border-b border-dls-border px-6 py-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7" onClick={load}>
            <RotateCw className="size-3.5" /> {t("common.refresh")}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="rounded-lg border border-dls-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("sprintnex.job.job")}</TableHead>
                <TableHead className="w-24">
                  {t("sprintnex.common.status")}
                </TableHead>
                <TableHead className="w-16">
                  {t("sprintnex.common.tier")}
                </TableHead>
                <TableHead className="w-24">
                  {t("sprintnex.job.budget")}
                </TableHead>
                <TableHead className="w-28">
                  {activeTab === "posted"
                    ? t("sprintnex.job.assignee")
                    : t("sprintnex.job.posted_by")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-12 text-center text-xs text-dls-secondary"
                  >
                    {t("sprintnex.task.loading")}
                  </TableCell>
                </TableRow>
              ) : currentJobs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-12 text-center text-xs text-dls-secondary"
                  >
                    {activeTab === "posted"
                      ? t("sprintnex.job.no_posted_jobs")
                      : t("sprintnex.job.no_assigned_jobs")}
                  </TableCell>
                </TableRow>
              ) : (
                currentJobs.map((job) => {
                  const statusColor =
                    STATUS_COLORS[job.status] ??
                    "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400";
                  const tierColor =
                    TIER_COLORS[job.tier?.toUpperCase()] ??
                    "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400";

                  return (
                    <TableRow
                      key={job.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/sprintnex/jobs/${job.id}`)}
                    >
                      <TableCell>
                        <div className="space-y-0.5">
                          <span className="text-sm font-medium text-dls-text">
                            {job.title}
                          </span>
                          {job.description && (
                            <p className="max-w-md truncate text-xs text-dls-secondary">
                              {job.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`border-0 text-[10px] ${statusColor}`}
                        >
                          {STATUS_LABELS[job.status]
                            ? t(STATUS_LABELS[job.status])
                            : job.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`border text-[10px] font-bold ${tierColor}`}
                        >
                          {job.tier || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-dls-text">
                        <span className="flex items-center gap-1">
                          <DollarSign className="size-3 text-dls-secondary" />
                          {job.budgetAmount?.toLocaleString() ?? "-"}{" "}
                          {job.budgetCurrency || ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-dls-secondary">
                        {activeTab === "posted"
                          ? job.assigneeName || t("sprintnex.skill.unassigned")
                          : job.posterName || t("common.unknown")}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
