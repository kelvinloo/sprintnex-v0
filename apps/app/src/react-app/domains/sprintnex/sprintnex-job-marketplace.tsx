/** @jsxImportSource react */
import { useState, useEffect, useCallback } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  DollarSign,
  Clock,
  Lock,
  RotateCw,
  Search,
  Send,
  Star,
  User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogClose,
} from "@/components/ui/dialog";
import { AICOE_BASE } from "@/app/lib/api-config";
import { readSprintnexAicoeScope } from "@/app/lib/sprintnex-aicoe-api";

// ── Types ───────────────────────────────────────────────────────────────────

type JobListing = {
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
  status: string;
  assigneeUserId: string | null;
  assigneeName: string | null;
  createdAt: string;
  updatedAt: string;
};

type TierInfo = {
  tier: string;
  label: string;
  minimumBudget: number;
  minimumRating: number;
  description: string;
};

type UserRating = {
  averageRating: number;
  totalRatings: number;
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

// ── Data fetching ───────────────────────────────────────────────────────────

async function fetchOpenJobs(): Promise<JobListing[]> {
  try {
    const res = await fetch(`${AICOE_BASE}/marketplace?status=open`, {
      headers: getApiHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      const raw = data?.data ?? data ?? [];
      return Array.isArray(raw) ? raw : [];
    }
  } catch {}
  return [];
}

async function fetchTiers(): Promise<TierInfo[]> {
  try {
    const res = await fetch(`${AICOE_BASE}/marketplace/tiers`, {
      headers: getApiHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      const raw = data?.data ?? data ?? [];
      return Array.isArray(raw) ? raw : [];
    }
  } catch {}
  return [];
}

async function fetchUserRating(userId: string): Promise<UserRating | null> {
  try {
    const res = await fetch(`${AICOE_BASE}/users/${userId}/rating`, {
      headers: getApiHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      return data?.data ?? data ?? null;
    }
  } catch {}
  return null;
}

async function applyToJob(
  jobId: string,
  userId: string,
  userName: string,
  coverLetter: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${AICOE_BASE}/marketplace/${jobId}/apply`, {
      method: "POST",
      headers: getApiHeaders(),
      body: JSON.stringify({ userId, userName, coverLetter }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function SprintnexJobMarketplacePage() {
  const navigate = useNavigate();
  const scope = readSprintnexAicoeScope();
  const uid = getUserId();

  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [tiers, setTiers] = useState<TierInfo[]>([]);
  const [userRating, setUserRating] = useState<UserRating | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const [openJobs, tierData, rating] = await Promise.all([
      fetchOpenJobs(),
      fetchTiers(),
      uid ? fetchUserRating(uid) : Promise.resolve(null),
    ]);
    setJobs(openJobs);
    setTiers(tierData);
    setUserRating(rating);
    // Track own jobs so Apply button is disabled for them
    const applied = new Set<string>();
    for (const j of openJobs) {
      if (j.posterUserId === uid) {
        applied.add(j.id);
      }
    }
    setAppliedIds(applied);
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApply = async (jobId: string) => {
    if (!uid) return;
    const userName =
      scope.userId || localStorage.getItem("userName") || "Anonymous";
    setApplySubmitting(true);
    const ok = await applyToJob(jobId, uid, userName, coverLetter);
    if (ok) {
      setAppliedIds((prev) => new Set(prev).add(jobId));
      setApplySuccess(true);
      setCoverLetter("");
    }
    setApplySubmitting(false);
  };

  const getTierInfo = (tier: string): TierInfo | undefined =>
    tiers.find((t) => t.tier === tier);

  const meetsRatingRequirement = (tier: string): boolean => {
    const info = getTierInfo(tier);
    if (!info) return true;
    return (userRating?.averageRating ?? 0) >= info.minimumRating;
  };

  const filtered = searchQuery.trim()
    ? jobs.filter(
        (j) =>
          j.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (j.posterName || "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          (j.tier || "").toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : jobs;

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
              <h1 className="text-base font-semibold text-dls-text">
                Job Marketplace
              </h1>
              <p className="text-xs text-dls-secondary">
                {filtered.length} open job{filtered.length !== 1 ? "s" : ""}
                {scope.projectName ? ` · ${scope.projectName}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {userRating && (
              <div className="flex items-center gap-1 text-xs text-dls-secondary">
                <Star className="size-3 text-yellow-500" />
                {userRating.averageRating.toFixed(1)} avg
                <span className="text-dls-muted">
                  ({userRating.totalRatings})
                </span>
              </div>
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
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-dls-bg px-3 text-xs font-medium text-dls-text shadow-sm"
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

      {/* Toolbar */}
      <div className="shrink-0 border-b border-dls-border px-6 py-2">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-dls-secondary" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search jobs..."
              className="h-7 w-[220px] pl-7 text-xs"
            />
          </div>
          <Button variant="ghost" size="sm" className="h-7" onClick={load}>
            <RotateCw className="size-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="rounded-lg border border-dls-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead className="w-20">Tier</TableHead>
                <TableHead className="w-28">Budget</TableHead>
                <TableHead className="w-20">Days</TableHead>
                <TableHead className="w-28">Posted by</TableHead>
                <TableHead className="w-28">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-12 text-center text-xs text-dls-secondary"
                  >
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-12 text-center text-xs text-dls-secondary"
                  >
                    No open jobs found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((job) => {
                  const isPoster = job.posterUserId === uid;
                  const alreadyApplied = appliedIds.has(job.id);
                  const canApply = !isPoster && !alreadyApplied;
                  const meetsRating = meetsRatingRequirement(job.tier);
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
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {job.estimatedCompletionDays ?? "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-dls-secondary">
                        <span className="flex items-center gap-1">
                          <User className="size-3" />
                          {job.posterName || "Unknown"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div onClick={(e) => e.stopPropagation()}>
                          {isPoster ? (
                            <Badge variant="secondary" className="text-[10px]">
                              Your job
                            </Badge>
                          ) : alreadyApplied ? (
                            <Badge className="text-[10px]">Applied</Badge>
                          ) : !meetsRating ? (
                            <div className="flex items-center gap-1 text-xs text-dls-secondary">
                              <Lock className="size-3 text-orange-500" />
                              <span>
                                Requires{" "}
                                {getTierInfo(job.tier)?.minimumRating.toFixed(
                                  1,
                                ) ?? "?"}{" "}
                                rating
                              </span>
                            </div>
                          ) : (
                            <Dialog
                              onOpenChange={(open) => {
                                if (!open) {
                                  setApplyingJobId(null);
                                  setCoverLetter("");
                                  setApplySuccess(false);
                                }
                              }}
                            >
                              <DialogTrigger
                                onClick={() => setApplyingJobId(job.id)}
                              >
                                <Button
                                  size="sm"
                                  className="h-7 text-xs"
                                  type="button"
                                >
                                  Apply
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-md">
                                <div className="space-y-4">
                                  <div>
                                    <h2 className="text-base font-semibold text-dls-text">
                                      Apply to "{job.title}"
                                    </h2>
                                    <p className="text-xs text-dls-secondary">
                                      {job.tier} ·{" "}
                                      {job.budgetAmount?.toLocaleString()}{" "}
                                      {job.budgetCurrency}
                                    </p>
                                  </div>
                                  {applySuccess ? (
                                    <div className="flex flex-col items-center gap-2 py-6">
                                      <Send className="size-8 text-green-500" />
                                      <p className="text-sm font-medium text-dls-text">
                                        Application sent!
                                      </p>
                                      <DialogClose>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          type="button"
                                        >
                                          Close
                                        </Button>
                                      </DialogClose>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="space-y-1">
                                        <label className="text-xs font-medium text-dls-secondary">
                                          Cover Letter (optional)
                                        </label>
                                        <Textarea
                                          value={coverLetter}
                                          onChange={(e) =>
                                            setCoverLetter(e.target.value)
                                          }
                                          placeholder="Tell the poster why you're a good fit..."
                                          rows={4}
                                        />
                                      </div>
                                      <div className="flex justify-end gap-2">
                                        <DialogClose>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            type="button"
                                          >
                                            Cancel
                                          </Button>
                                        </DialogClose>
                                        <Button
                                          size="sm"
                                          onClick={() => handleApply(job.id)}
                                          disabled={applySubmitting}
                                        >
                                          {applySubmitting
                                            ? "Submitting..."
                                            : "Submit Application"}
                                        </Button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
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
