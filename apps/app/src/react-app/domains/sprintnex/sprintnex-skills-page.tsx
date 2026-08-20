/** @jsxImportSource react */
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  ArrowLeft,
  Brain,
  Bot,
  CheckCircle,
  Download,
  Eye,
  FileText,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  RotateCw,
  Search,
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
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { readSprintnexAicoeScope } from "@/app/lib/sprintnex-aicoe-api";
import { t } from "@/i18n";
import { SprintnexTabBar } from "./sprintnex-tab-bar";
import { AICOE_BASE } from "@/app/lib/api-config";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

const AI_COE_USAGE_OPTIONS = [
  "backend-agent-skill",
  "frontend-agent-skill",
  "architect-agent-skill",
  "qa-agent-skill",
  "ba-agent-skill",
  "code-review-checklist",
  "junior-training-material",
  "reusable-prompt-template",
  "sop",
  "knowledge-base",
] as const;

const CONFIDENCE_LEVELS = [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
] as const;
const CATEGORIES = [
  "Software Engineering",
  "Data Engineering",
  "DevOps",
  "Architecture",
  "Testing",
  "Business Analysis",
  "Machine Learning",
  "Security",
  "Mobile Development",
  "Frontend Engineering",
  "Backend Engineering",
];

const STATUS_COLORS: Record<string, string> = {
  draft: "default",
  ai_extracted: "purple",
  pending_review: "processing",
  approved: "success",
  published: "blue",
  rejected: "error",
  deprecated: "default",
};

type SkillRow = {
  id: string;
  name: string;
  category: string;
  domain: string;
  role: string;
  confidenceLevel: string;
  yearsOfExperience: number;
  description: string;
  toolsFrameworks: string[];
  reusablePatterns: string[];
  realProjectExamples: string[];
  commonMistakes: string[];
  aiCoeUsage: string[];
  extractionSource: string;
  status: string;
  version: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

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

const N8N_SKILL_UPLOAD_URL =
  "https://n8n.directintegrate.com/webhook/aicoe/skill/upload";

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getApiHeaders() {
  const token =
    localStorage.getItem("auth_token") ||
    localStorage.getItem("accessToken") ||
    "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function getScope() {
  return {
    organizationId: localStorage.getItem("selected_organization_id") || "",
    teamId: localStorage.getItem("selected_team_id") || "",
    projectId: localStorage.getItem("selected_project_id") || "",
    userId: localStorage.getItem("userId") || "",
  };
}

function skillToMarkdown(s: SkillRow): string {
  return [
    `# ${s.name}`,
    ``,
    `**Category:** ${s.category}  `,
    `**Domain:** ${s.domain}  `,
    `**Confidence:** ${s.confidenceLevel}  `,
    `**Experience:** ${s.yearsOfExperience}y  `,
    `**Status:** ${s.status}  `,
    ``,
    `## Description`,
    s.description || "No description",
    s.toolsFrameworks.length
      ? `\n## Tools & Frameworks\n${s.toolsFrameworks.map((t) => `- ${t}`).join("\n")}`
      : "",
    s.reusablePatterns.length
      ? `\n## Reusable Patterns\n${s.reusablePatterns.map((p) => `- ${p}`).join("\n")}`
      : "",
    s.realProjectExamples.length
      ? `\n## Project Examples\n${s.realProjectExamples.map((e) => `- ${e}`).join("\n")}`
      : "",
    s.commonMistakes.length
      ? `\n## Common Mistakes\n${s.commonMistakes.map((m) => `- ${m}`).join("\n")}`
      : "",
    s.aiCoeUsage.length
      ? `\n## AI COE Usage\n${s.aiCoeUsage.map((u) => `- ${u}`).join("\n")}`
      : "",
  ].join("\n");
}

function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function formatFileSize(bytes: number): string {
  if (!bytes) return "-";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${u[i]}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function SprintnexSkillsPage() {
  const navigate = useNavigate();
  const scope = readSprintnexAicoeScope();
  const [activeTab, setActiveTab] = useState<"profile" | "extract">("profile");

  return (
    <div className="flex h-full min-h-0 flex-col bg-dls-bg">
      {/* Header */}
      <div className="shrink-0 border-b border-dls-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#111827] text-white">
              <Brain size={16} />
            </div>
            <div>
              <h1 className="text-base font-semibold text-dls-text">
                {t("sprintnex.tabs.skills")}
              </h1>
              <p className="text-xs text-dls-secondary">
                {scope.projectName ||
                  scope.projectId ||
                  t("sprintnex.task.no_project_selected")}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/session")}
          >
            <ArrowLeft className="size-4" /> {t("common.back")}
          </Button>
        </div>
        <SprintnexTabBar activeTab="skills" />
      </div>

      {/* Internal Profile/Extract sub-tabs */}
      <div className="shrink-0 border-b border-dls-border px-6 py-2">
        <div className="inline-flex rounded-lg border border-dls-border bg-dls-surface p-0.5">
          <button
            type="button"
            className={`inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors ${
              activeTab === "profile"
                ? "bg-dls-bg text-dls-text shadow-sm"
                : "text-dls-secondary hover:text-dls-text"
            }`}
            onClick={() => setActiveTab("profile")}
          >
            <Brain className="size-3.5" /> {t("sprintnex.skill.profile")}
          </button>
          <button
            type="button"
            className={`inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors ${
              activeTab === "extract"
                ? "bg-dls-bg text-dls-text shadow-sm"
                : "text-dls-secondary hover:text-dls-text"
            }`}
            onClick={() => setActiveTab("extract")}
          >
            <Sparkles className="size-3.5" /> {t("sprintnex.skill.extract")}
          </button>
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-dls-secondary transition-colors hover:text-dls-text"
            onClick={() => navigate("/sprintnex/skills/marketplace")}
          >
            <Download className="size-3.5" /> {t("sprintnex.skill.marketplace")}
          </button>
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-dls-secondary transition-colors hover:text-dls-text"
            onClick={() => navigate("/sprintnex/skills/active")}
          >
            <CheckCircle className="size-3.5" /> {t("sprintnex.skill.active")}
          </button>
        </div>
      </div>

      {activeTab === "profile" ? <ProfileTab /> : <ExtractTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE TAB
// ═══════════════════════════════════════════════════════════════════════════════

function ProfileTab() {
  const navigate = useNavigate();
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("__all");
  const [statusFilter, setStatusFilter] = useState("__all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [revisionLoadingId, setRevisionLoadingId] = useState<string | null>(
    null,
  );
  const [submitLoadingId, setSubmitLoadingId] = useState<string | null>(null);

  const N8N_SKILLS_RETRIEVE_URL =
    "https://n8n.directintegrate.com/webhook/aicoe/skills/retrieve";

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(N8N_SKILLS_RETRIEVE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getApiHeaders() },
        body: JSON.stringify(getScope()),
      });
      if (!res.ok) {
        setSkills([]);
        return;
      }
      const data = await res.json();
      const list = data?.data ?? data?.skills ?? data ?? [];
      setSkills(
        Array.isArray(list)
          ? list.map((item: Record<string, unknown>, i: number) => ({
              id: (item._id as string) || (item.id as string) || `s-${i}`,
              name:
                (item.skillName as string) ||
                (item.name as string) ||
                t("sprintnex.skill.untitled"),
              category: (item.category as string) || "",
              domain: (item.domain as string) || "",
              role: (item.role as string) || "",
              confidenceLevel: (item.confidenceLevel as string) || "beginner",
              yearsOfExperience: (item.yearsOfExperience as number) || 0,
              description:
                (item.markdown as string) || (item.description as string) || "",
              toolsFrameworks: Array.isArray(item.tags)
                ? (item.tags as string[])
                : Array.isArray(item.toolsFrameworks)
                  ? (item.toolsFrameworks as string[])
                  : [],
              reusablePatterns: [],
              realProjectExamples: [],
              commonMistakes: [],
              aiCoeUsage: [],
              extractionSource: (item.extractionSource as string) || "manual",
              status: (item.status as string) || "draft",
              version: (item.version as number) || 1,
              isPublished: (item.isPublished as boolean) ?? false,
              createdAt: (item.createdAt as string) || "",
              updatedAt: (item.updatedAt as string) || "",
            }))
          : [],
      );
    } catch {
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const filteredSkills = useMemo(() => {
    let r = skills;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      r = r.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q),
      );
    }
    if (categoryFilter !== "__all")
      r = r.filter((s) => s.category === categoryFilter);
    if (statusFilter !== "__all")
      r = r.filter((s) => s.status === statusFilter);
    return r;
  }, [skills, searchQuery, categoryFilter, statusFilter]);

  const toggleId = (id: string) =>
    setSelectedIds((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const s = getScope();
      await fetch(`${AICOE_BASE}/skills/refresh-from-n8n`, {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({
          organizationId: s.organizationId,
          userId: s.userId,
        }),
      });
      await loadSkills();
    } catch {
    } finally {
      setRefreshing(false);
    }
  };

  const handleDownloadSelected = () => {
    const selected = skills.filter((s) => selectedIds.has(s.id));
    if (selected.length === 1) {
      downloadMarkdown(
        skillToMarkdown(selected[0]),
        `${selected[0].name.toLowerCase().replace(/\s+/g, "-")}.md`,
      );
    } else {
      selected.forEach((s) =>
        downloadMarkdown(
          skillToMarkdown(s),
          `${s.name.toLowerCase().replace(/\s+/g, "-")}.md`,
        ),
      );
    }
  };

  const openDetail = (s: SkillRow) => navigate(`/sprintnex/skills/${s.id}`);
  const openEdit = (s: SkillRow) => navigate(`/sprintnex/skills/${s.id}/edit`);

  const handleCreateRevision = async (skill: SkillRow) => {
    setRevisionLoadingId(skill.id);
    try {
      const res = await fetch(
        `${AICOE_BASE}/skills/${skill.id}/create-revision`,
        { method: "POST", headers: getApiHeaders() },
      );
      if (res.ok) {
        await loadSkills();
        navigate(`/sprintnex/skills/${skill.id}/edit`);
      }
    } catch {
    } finally {
      setRevisionLoadingId(null);
    }
  };

  const handleSubmitReview = async (skill: SkillRow) => {
    setSubmitLoadingId(skill.id);
    try {
      const res = await fetch(
        `${AICOE_BASE}/skills/${skill.id}/submit-review`,
        { method: "POST", headers: getApiHeaders() },
      );
      if (res.ok) {
        await loadSkills();
        setDetailOpen(false);
        setEditOpen(false);
      }
    } catch {
    } finally {
      setSubmitLoadingId(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editSkill) return;
    setEditSaving(true);
    try {
      await fetch(`${AICOE_BASE}/skills/${editSkill.id}`, {
        method: "PUT",
        headers: getApiHeaders(),
        body: JSON.stringify(editForm),
      });
      await loadSkills();
      setEditOpen(false);
    } catch {
    } finally {
      setEditSaving(false);
    }
  };

  const canEdit = (s: SkillRow | null) =>
    s ? ["draft", "ai_extracted", "rejected"].includes(s.status) : false;
  const canSubmit = (s: SkillRow | null) =>
    s ? ["draft", "ai_extracted"].includes(s.status) : false;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-dls-border px-6 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-dls-secondary" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("sprintnex.skill.search_placeholder")}
              className="h-7 w-[200px] pl-7 text-xs"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-7 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">
                {t("sprintnex.skill.all_categories")}
              </SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-7 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">
                {t("sprintnex.status.all_statuses")}
              </SelectItem>
              <SelectItem value="draft">{t("sprintnex.status.draft")}</SelectItem>
              <SelectItem value="ai_extracted">
                {t("sprintnex.status.ai_extracted")}
              </SelectItem>
              <SelectItem value="pending_review">
                {t("sprintnex.status.pending_review")}
              </SelectItem>
              <SelectItem value="approved">
                {t("sprintnex.status.approved")}
              </SelectItem>
              <SelectItem value="published">
                {t("sprintnex.status.published")}
              </SelectItem>
              <SelectItem value="rejected">
                {t("sprintnex.status.rejected")}
              </SelectItem>
            </SelectContent>
          </Select>
          <Separator orientation="vertical" className="h-5" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RotateCw className="size-3.5" /> {t("sprintnex.skill.fetch_from_n8n")}
          </Button>
          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={handleDownloadSelected}
            >
              <Download className="size-3.5" /> Download ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="rounded-lg border border-dls-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <input
                    type="checkbox"
                    className="size-3.5"
                    checked={
                      filteredSkills.length > 0 &&
                      filteredSkills.every((s) => selectedIds.has(s.id))
                    }
                    onChange={() =>
                      setSelectedIds(
                        selectedIds.size === filteredSkills.length
                          ? new Set()
                          : new Set(filteredSkills.map((s) => s.id)),
                      )
                    }
                  />
                </TableHead>
                <TableHead>{t("sprintnex.common.name")}</TableHead>
                <TableHead className="w-32">
                  {t("sprintnex.common.category")}
                </TableHead>
                <TableHead className="w-24">
                  {t("sprintnex.common.confidence")}
                </TableHead>
                <TableHead className="w-20">
                  {t("sprintnex.skill.experience_abbrev")}
                </TableHead>
                <TableHead className="w-24">
                  {t("sprintnex.skill.source")}
                </TableHead>
                <TableHead className="w-28">
                  {t("sprintnex.common.status")}
                </TableHead>
                <TableHead className="w-24">
                  {t("sprintnex.skill.published")}
                </TableHead>
                <TableHead className="w-28">
                  {t("sprintnex.knowledge.updated")}
                </TableHead>
                <TableHead className="w-20">
                  {t("sprintnex.knowledge.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="py-12 text-center text-xs text-dls-secondary"
                  >
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredSkills.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="py-12 text-center text-xs text-dls-secondary"
                  >
                    No skills found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredSkills.map((s) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer"
                    onClick={() => openDetail(s)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="size-3.5"
                        checked={selectedIds.has(s.id)}
                        onChange={() => toggleId(s.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium text-dls-text">
                        {s.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-dls-secondary">
                      {s.category}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          s.confidenceLevel === "expert"
                            ? "default"
                            : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {s.confidenceLevel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-dls-secondary">
                      {s.yearsOfExperience}y
                    </TableCell>
                    <TableCell className="text-xs text-dls-secondary">
                      {s.extractionSource}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          s.status === "published" || s.status === "approved"
                            ? "default"
                            : s.status === "rejected"
                              ? "destructive"
                              : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {s.isPublished ? (
                        <Badge variant="default" className="text-[10px]">
                          Yes
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          No
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-dls-secondary">
                      {s.updatedAt
                        ? new Date(s.updatedAt).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="size-7"
                          onClick={() => openDetail(s)}
                          title="View"
                        >
                          <Eye className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="size-7"
                          onClick={() =>
                            canEdit(s) ? openEdit(s) : handleCreateRevision(s)
                          }
                          disabled={revisionLoadingId === s.id}
                          title={canEdit(s) ? "Edit" : "Create Revision"}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Detail and Edit moved to separate pages at /sprintnex/skills/:id and /sprintnex/skills/:id/edit */}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTRACT TAB
// ═══════════════════════════════════════════════════════════════════════════════

function ExtractTab() {
  const [extractTab, setExtractTab] = useState<"interview" | "upload">(
    "interview",
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-dls-border px-6 py-2">
        <div className="inline-flex rounded-lg border border-dls-border bg-dls-surface p-0.5">
          <button
            type="button"
            className={`inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors ${
              extractTab === "interview"
                ? "bg-dls-bg text-dls-text shadow-sm"
                : "text-dls-secondary hover:text-dls-text"
            }`}
            onClick={() => setExtractTab("interview")}
          >
            <MessageSquare className="size-3.5" /> AI Interview
          </button>
          <button
            type="button"
            className={`inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors ${
              extractTab === "upload"
                ? "bg-dls-bg text-dls-text shadow-sm"
                : "text-dls-secondary hover:text-dls-text"
            }`}
            onClick={() => setExtractTab("upload")}
          >
            <Upload className="size-3.5" /> Upload Evidence
          </button>
        </div>
      </div>
      {extractTab === "interview" ? <InterviewPanel /> : <UploadPanel />}
    </div>
  );
}

// ── Interview Panel ──────────────────────────────────────────────────────────

function InterviewPanel() {
  const [domain, setDomain] = useState("");
  const [context, setContext] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractedSkill, setExtractedSkill] = useState<ExtractedSkill | null>(
    null,
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startInterview = async () => {
    if (!domain.trim()) return;
    try {
      const res = await fetch(`${AICOE_BASE}/skill-interviews`, {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({
          domain: domain.trim(),
          context: context.trim() || undefined,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const sId = data?.id || data?.data?.id || data?.sessionId || "";
      if (!sId) return;
      setSessionId(sId);
      setMessages(data?.messages || data?.data?.messages || []);
    } catch {}
  };

  const sendMessage = async () => {
    if (!sessionId || !input.trim()) return;
    const text = input.trim();
    setInput("");
    setMessages((prev) => [
      ...prev,
      {
        id: `m-${Date.now()}`,
        role: "user",
        text,
        createdAt: new Date().toISOString(),
      },
    ]);
    setSending(true);
    try {
      const res = await fetch(
        `${AICOE_BASE}/skill-interviews/${sessionId}/messages`,
        {
          method: "POST",
          headers: getApiHeaders(),
          body: JSON.stringify({ message: text }),
        },
      );
      if (res.ok) {
        const data = await res.json();
        setMessages(data?.messages || data?.data?.messages || []);
      }
    } catch {
    } finally {
      setSending(false);
    }
  };

  const extractSkill = async () => {
    if (!sessionId) return;
    setExtracting(true);
    try {
      const res = await fetch(
        `${AICOE_BASE}/skill-interviews/${sessionId}/extract`,
        {
          method: "POST",
          headers: getApiHeaders(),
        },
      );
      if (res.ok) {
        const data = await res.json();
        setExtractedSkill(data?.data || data?.skill || data);
      }
    } catch {
    } finally {
      setExtracting(false);
    }
  };

  const userMsgCount = messages.filter((m) => m.role === "user").length;

  if (!sessionId) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="flex w-full max-w-md flex-col gap-4">
          <h2 className="text-center text-sm font-semibold text-dls-text">
            Start AI Interview
          </h2>
          <p className="text-center text-xs text-dls-secondary">
            Answer questions and the AI will extract skills from your responses.
          </p>
          <div>
            <label className="text-xs font-medium text-dls-secondary">
              Domain *
            </label>
            <Input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g. Backend Engineering"
              className="mt-1 h-8 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-dls-secondary">
              Context (optional)
            </label>
            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Any additional context..."
              className="mt-1 min-h-[60px] text-sm"
            />
          </div>
          <Button onClick={startInterview} disabled={!domain.trim()}>
            <Sparkles className="size-3.5" /> Start Interview
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`flex size-7 shrink-0 items-center justify-center rounded-full ${m.role === "user" ? "bg-blue-500" : "bg-dls-surface"}`}
              >
                {m.role === "user" ? (
                  <User className="size-3.5 text-white" />
                ) : (
                  <Bot className="size-3.5 text-dls-text" />
                )}
              </div>
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-blue-500 text-white" : "bg-dls-surface text-dls-text"}`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-xs text-dls-secondary">
              <Loader2 className="size-3 animate-spin" /> Thinking...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {extractedSkill && (
        <div className="shrink-0 border-t border-dls-border bg-dls-surface px-6 py-3">
          <h3 className="mb-2 text-xs font-semibold text-dls-text">
            {t("sprintnex.skill.extracted_skill")}
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div>
              <span className="text-dls-secondary">
                {t("sprintnex.common.name")}:
              </span>{" "}
              <span className="text-dls-text">{extractedSkill.name}</span>
            </div>
            <div>
              <span className="text-dls-secondary">
                {t("sprintnex.common.category")}:
              </span>{" "}
              <span className="text-dls-text">{extractedSkill.category}</span>
            </div>
            <div>
              <span className="text-dls-secondary">
                {t("sprintnex.common.confidence")}:
              </span>{" "}
              <span className="text-dls-text">
                {extractedSkill.confidenceLevel} (
                {Math.round((extractedSkill.confidenceScore || 0) * 100)}%)
              </span>
            </div>
            <div>
              <span className="text-dls-secondary">
                {t("sprintnex.common.experience")}
              </span>{" "}
              <span className="text-dls-text">
                {extractedSkill.yearsOfExperience}y
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="shrink-0 border-t border-dls-border px-6 py-3">
        <div className="mx-auto flex max-w-2xl gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("sprintnex.skill.message_placeholder")}
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <Button
            size="sm"
            className="h-8"
            onClick={sendMessage}
            disabled={!input.trim() || sending}
          >
            <Send className="size-3.5" />
          </Button>
          {userMsgCount >= 2 && (
            <Button
              size="sm"
              className="h-8"
              variant="outline"
              onClick={extractSkill}
              disabled={extracting}
            >
              <Sparkles className="size-3.5" /> Extract
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Upload Panel ─────────────────────────────────────────────────────────────

function UploadPanel() {
  const [files, setFiles] = useState<
    Array<{
      name: string;
      size: number;
      status: "pending" | "uploading" | "uploaded" | "error";
    }>
  >([]);

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    const entry = {
      name: file.name,
      size: file.size,
      status: "pending" as const,
    };
    setFiles((prev) => [...prev, entry]);
    setFiles((prev) =>
      prev.map((f) =>
        f.name === file.name ? { ...f, status: "uploading" as const } : f,
      ),
    );

    const fd = new FormData();
    fd.append("file", file);
    const s = getScope();
    fd.append("organizationId", s.organizationId);
    fd.append("teamId", s.teamId);
    fd.append("projectId", s.projectId);
    fd.append("userId", s.userId);

    fetch(N8N_SKILL_UPLOAD_URL, { method: "POST", body: fd })
      .then(() =>
        setFiles((prev) =>
          prev.map((f) =>
            f.name === file.name ? { ...f, status: "uploaded" as const } : f,
          ),
        ),
      )
      .catch(() =>
        setFiles((prev) =>
          prev.map((f) =>
            f.name === file.name ? { ...f, status: "error" as const } : f,
          ),
        ),
      );
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <label
        className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-dls-border bg-dls-surface p-8 text-center hover:border-blue-400"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) handleFileSelect(f);
        }}
      >
        <Upload className="size-8 text-dls-secondary" />
        <p className="text-sm text-dls-text">
          {t("sprintnex.knowledge.click_or_drag_document")}
        </p>
        <p className="text-xs text-dls-secondary">
          {t("sprintnex.knowledge.file_types_hint")}
        </p>
        <input
          type="file"
          className="hidden"
          accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md,.pptx,.ppt,.zip,.gz,.tar"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileSelect(f);
          }}
        />
      </label>

      {files.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-dls-secondary">
            Uploaded files
          </p>
          {files.map((f, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-md border border-dls-border bg-dls-surface px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-blue-500" />
                <span className="text-sm text-dls-text">{f.name}</span>
                <span className="text-xs text-dls-secondary">
                  {formatFileSize(f.size)}
                </span>
              </div>
              <Badge
                variant={
                  f.status === "uploaded"
                    ? "default"
                    : f.status === "error"
                      ? "destructive"
                      : "secondary"
                }
                className="text-[10px]"
              >
                {f.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
