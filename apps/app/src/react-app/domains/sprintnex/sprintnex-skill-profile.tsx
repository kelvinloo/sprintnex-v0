/** @jsxImportSource react */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ArrowLeft,
  Search,
  Download,
  Eye,
  Pencil,
  Plus,
  RotateCw,
  Send,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { readSprintnexAicoeScope } from "@/app/lib/sprintnex-aicoe-api";
import { AICOE_BASE } from "@/app/lib/api-config";

// ── Types ───────────────────────────────────────────────────────────────────
const AI_COE_USAGE_OPTIONS = [
  { value: "backend-agent-skill", label: "Backend Agent Skill" },
  { value: "frontend-agent-skill", label: "Frontend Agent Skill" },
  { value: "architect-agent-skill", label: "Architect Agent Skill" },
  { value: "qa-agent-skill", label: "QA Agent Skill" },
  { value: "ba-agent-skill", label: "BA Agent Skill" },
  { value: "code-review-checklist", label: "Code Review Checklist" },
  { value: "junior-training-material", label: "Junior Training Material" },
  { value: "reusable-prompt-template", label: "Reusable Prompt Template" },
  { value: "sop", label: "SOP" },
  { value: "knowledge-base", label: "Knowledge Base" },
] as const;

const CONFIDENCE_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "expert", label: "Expert" },
] as const;

const CATEGORIES = [
  "Software Engineering",
  "Data Engineering",
  "DevOps",
  "Architecture",
  "Testing",
  "UI/UX",
  "Documentation",
  "Project Management",
  "Business Analysis",
  "Security",
  "AI/ML",
  "Domain Knowledge",
] as const;

interface SkillRow {
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
  createdAt: string;
  updatedAt: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function statusBadgeVariant(
  status: string,
): "secondary" | "outline" | "destructive" | "default" {
  switch (status) {
    case "published":
    case "approved":
      return "secondary";
    case "draft":
    case "ai_extracted":
      return "outline";
    case "rejected":
    case "deprecated":
      return "destructive";
    default:
      return "outline";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "ai_extracted":
      return "AI Extracted";
    case "pending_review":
      return "Pending Review";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function confidenceLabel(level: string): string {
  const match = CONFIDENCE_LEVELS.find((c) => c.value === level);
  return match?.label ?? level;
}

function sourceLabel(source: string): string {
  switch (source) {
    case "manual":
      return "Manual";
    case "ai_interview":
      return "AI Interview";
    case "file_upload":
      return "File Upload";
    case "repo_scan":
      return "Repo Scan";
    default:
      return source;
  }
}

function usageLabels(values: string[]): string[] {
  return values.map((v) => {
    const match = AI_COE_USAGE_OPTIONS.find((o) => o.value === v);
    return match?.label ?? v;
  });
}

function formatDate(raw: string | Date | undefined | null): string {
  if (!raw) return "-";
  const d = typeof raw === "string" ? new Date(raw) : raw;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildSkillMarkdown(skill: SkillRow): string {
  const lines: string[] = [];
  lines.push(`# ${skill.name}`);
  lines.push("");
  lines.push(`**Category:** ${skill.category}`);
  lines.push(`**Domain:** ${skill.domain}`);
  lines.push(`**Role:** ${skill.role}`);
  lines.push(`**Confidence:** ${confidenceLabel(skill.confidenceLevel)}`);
  lines.push(`**Experience:** ${skill.yearsOfExperience} years`);
  lines.push(`**Status:** ${statusLabel(skill.status)}`);
  lines.push(`**Source:** ${sourceLabel(skill.extractionSource)}`);
  lines.push(`**Version:** ${skill.version}`);
  lines.push("");
  lines.push("## Description");
  lines.push("");
  lines.push(skill.description || "No description provided.");
  lines.push("");
  if (skill.toolsFrameworks.length > 0) {
    lines.push("## Tools & Frameworks");
    lines.push("");
    skill.toolsFrameworks.forEach((t) => lines.push(`- ${t}`));
    lines.push("");
  }
  if (skill.reusablePatterns.length > 0) {
    lines.push("## Reusable Patterns");
    lines.push("");
    skill.reusablePatterns.forEach((p) => lines.push(`- ${p}`));
    lines.push("");
  }
  if (skill.realProjectExamples.length > 0) {
    lines.push("## Real Project Examples");
    lines.push("");
    skill.realProjectExamples.forEach((e) => lines.push(`- ${e}`));
    lines.push("");
  }
  if (skill.commonMistakes.length > 0) {
    lines.push("## Common Mistakes");
    lines.push("");
    skill.commonMistakes.forEach((m) => lines.push(`- ${m}`));
    lines.push("");
  }
  if (skill.aiCoeUsage.length > 0) {
    lines.push("## AI COE Usage");
    lines.push("");
    usageLabels(skill.aiCoeUsage).forEach((u) => lines.push(`- ${u}`));
    lines.push("");
  }
  return lines.join("\n");
}

function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".md") ? filename : `${filename}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Skill Profile Component ─────────────────────────────────────────────────
export function SprintnexSkillProfilePage() {
  const navigate = useNavigate();
  const scope = readSprintnexAicoeScope();

  // Data
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("__all");
  const [statusFilter, setStatusFilter] = useState("__all");

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSkill, setDetailSkill] = useState<SkillRow | null>(null);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editSkill, setEditSkill] = useState<SkillRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // ── Auth / Scope ──────────────────────────────────────────────────────────
  const getApiHeaders = useCallback((): Record<string, string> => {
    const token =
      localStorage.getItem("auth_token") ||
      localStorage.getItem("accessToken") ||
      "";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Tenant-Id": scope.tenantId || "default",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (scope.teamId) headers["X-Team-Space-Id"] = scope.teamId;
    if (scope.projectId) headers["X-Workspace-Id"] = scope.projectId;
    if (scope.organizationId)
      headers["X-Organization-Id"] = scope.organizationId;
    if (scope.userId) headers["X-User-Id"] = scope.userId;
    return headers;
  }, [scope]);

  const getScopePayload = useCallback(
    () => ({
      organizationId: scope.organizationId,
      teamId: scope.teamId,
      projectId: scope.projectId,
      userId: scope.userId,
      tenantId: scope.tenantId,
    }),
    [scope],
  );

  // ── Data Fetching ─────────────────────────────────────────────────────────
  const fetchSkills = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("tenantId", scope.tenantId || "default");
      if (scope.organizationId)
        params.set("organizationId", scope.organizationId);
      if (scope.teamId) params.set("teamSpaceId", scope.teamId);
      if (scope.projectId) params.set("workspaceId", scope.projectId);
      const res = await fetch(`${AICOE_BASE}/skills?${params.toString()}`, {
        method: "GET",
        headers: getApiHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const list = data?.data ?? data?.skills ?? data ?? [];
        const rows: SkillRow[] = Array.isArray(list)
          ? list.map((item: Record<string, unknown>, i: number) => ({
              id: (item.id as string) || `s-${i}`,
              name: (item.name as string) || "Untitled Skill",
              category: (item.category as string) || "",
              domain: (item.domain as string) || "",
              role: (item.role as string) || "",
              confidenceLevel: (item.confidenceLevel as string) || "beginner",
              yearsOfExperience: (item.yearsOfExperience as number) || 0,
              description: (item.description as string) || "",
              toolsFrameworks: Array.isArray(item.toolsFrameworks)
                ? (item.toolsFrameworks as string[])
                : [],
              reusablePatterns: Array.isArray(item.reusablePatterns)
                ? (item.reusablePatterns as string[])
                : [],
              realProjectExamples: Array.isArray(item.realProjectExamples)
                ? (item.realProjectExamples as string[])
                : [],
              commonMistakes: Array.isArray(item.commonMistakes)
                ? (item.commonMistakes as string[])
                : [],
              aiCoeUsage: Array.isArray(item.aiCoeUsage)
                ? (item.aiCoeUsage as string[])
                : [],
              extractionSource: (item.extractionSource as string) || "manual",
              status: (item.status as string) || "draft",
              version: (item.version as number) || 1,
              createdAt: (item.createdAt as string) || "",
              updatedAt: (item.updatedAt as string) || "",
            }))
          : [];
        setSkills(rows);
      } else {
        setSkills([]);
      }
    } catch {
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }, [scope, getApiHeaders]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  // ── Filtered & searched skills ────────────────────────────────────────────
  const filteredSkills = useMemo(() => {
    let result = skills;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.domain.toLowerCase().includes(q) ||
          s.role.toLowerCase().includes(q),
      );
    }
    if (categoryFilter !== "__all") {
      result = result.filter((s) => s.category === categoryFilter);
    }
    if (statusFilter !== "__all") {
      result = result.filter((s) => s.status === statusFilter);
    }
    return result;
  }, [skills, searchQuery, categoryFilter, statusFilter]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleFetchFromN8n = async () => {
    try {
      await fetch(`${AICOE_BASE}/skills/refresh-from-n8n`, {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify(getScopePayload()),
      });
      fetchSkills();
    } catch {
      // non-blocking
    }
  };

  const handleDownloadMarkdown = () => {
    const selected = skills.filter((s) => selectedIds.has(s.id));
    if (selected.length === 0) return;
    if (selected.length === 1) {
      downloadMarkdown(
        `${selected[0].name.replace(/\s+/g, "-").toLowerCase()}.md`,
        buildSkillMarkdown(selected[0]),
      );
    } else {
      // Download a combined markdown file
      const combined = selected
        .map((s) => buildSkillMarkdown(s))
        .join("\n\n---\n\n");
      downloadMarkdown("selected-skills.md", combined);
    }
  };

  const handleViewDetail = (skill: SkillRow) => {
    setDetailSkill(skill);
    setDetailOpen(true);
  };

  const handleEdit = (skill: SkillRow) => {
    setEditSkill({ ...skill });
    setEditOpen(true);
  };

  const handleEditToggleUsage = (value: string) => {
    if (!editSkill) return;
    const current = editSkill.aiCoeUsage;
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setEditSkill({ ...editSkill, aiCoeUsage: next });
  };

  const handleEditArrayField = (
    field:
      | "toolsFrameworks"
      | "reusablePatterns"
      | "realProjectExamples"
      | "commonMistakes",
    index: number,
    value: string,
  ) => {
    if (!editSkill) return;
    const arr = [...editSkill[field]];
    arr[index] = value;
    setEditSkill({ ...editSkill, [field]: arr });
  };

  const handleEditAddArrayItem = (
    field:
      | "toolsFrameworks"
      | "reusablePatterns"
      | "realProjectExamples"
      | "commonMistakes",
  ) => {
    if (!editSkill) return;
    setEditSkill({ ...editSkill, [field]: [...editSkill[field], ""] });
  };

  const handleEditRemoveArrayItem = (
    field:
      | "toolsFrameworks"
      | "reusablePatterns"
      | "realProjectExamples"
      | "commonMistakes",
    index: number,
  ) => {
    if (!editSkill) return;
    const arr = editSkill[field].filter((_, i) => i !== index);
    setEditSkill({ ...editSkill, [field]: arr });
  };

  const handleSaveSkill = async () => {
    if (!editSkill) return;
    setEditSaving(true);
    try {
      await fetch(`${AICOE_BASE}/skills/${encodeURIComponent(editSkill.id)}`, {
        method: "PUT",
        headers: getApiHeaders(),
        body: JSON.stringify({
          name: editSkill.name,
          category: editSkill.category,
          domain: editSkill.domain,
          role: editSkill.role,
          confidenceLevel: editSkill.confidenceLevel,
          yearsOfExperience: editSkill.yearsOfExperience,
          description: editSkill.description,
          toolsFrameworks: editSkill.toolsFrameworks.filter(Boolean),
          reusablePatterns: editSkill.reusablePatterns.filter(Boolean),
          realProjectExamples: editSkill.realProjectExamples.filter(Boolean),
          commonMistakes: editSkill.commonMistakes.filter(Boolean),
          aiCoeUsage: editSkill.aiCoeUsage,
          ...getScopePayload(),
        }),
      });
      setEditOpen(false);
      setEditSkill(null);
      fetchSkills();
    } catch {
      // non-blocking
    } finally {
      setEditSaving(false);
    }
  };

  const handleCreateRevision = async (skill: SkillRow) => {
    try {
      await fetch(
        `${AICOE_BASE}/skills/${encodeURIComponent(skill.id)}/create-revision`,
        {
          method: "POST",
          headers: getApiHeaders(),
          body: JSON.stringify(getScopePayload()),
        },
      );
      fetchSkills();
    } catch {
      // non-blocking
    }
  };

  const handleSubmitReview = async (skill: SkillRow) => {
    try {
      await fetch(
        `${AICOE_BASE}/skills/${encodeURIComponent(skill.id)}/submit-review`,
        {
          method: "POST",
          headers: getApiHeaders(),
          body: JSON.stringify(getScopePayload()),
        },
      );
      fetchSkills();
    } catch {
      // non-blocking
    }
  };

  // ── Status icon helper ────────────────────────────────────────────────────
  const statusIcon = (status: string) => {
    switch (status) {
      case "published":
      case "approved":
        return <CheckCircle className="size-3.5 text-green-500" />;
      case "pending_review":
        return <Clock className="size-3.5 text-amber-500" />;
      case "rejected":
      case "deprecated":
        return <XCircle className="size-3.5 text-red-500" />;
      default:
        return <Clock className="size-3.5 text-dls-tertiary" />;
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-0 flex-col bg-dls-bg">
      {/* Header */}
      <div className="shrink-0 border-b border-dls-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#111827] text-white">
              <FileText size={16} />
            </div>
            <div>
              <h1 className="text-base font-semibold text-dls-text">
                Skill Profile
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

      {/* Toolbar */}
      <div className="shrink-0 border-b border-dls-border px-6 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-dls-secondary" />
            <Input
              placeholder="Search skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 w-[200px] pl-7 text-xs"
            />
          </div>

          {/* Category filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-7 w-[150px] text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All Categories</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-7 w-[140px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="ai_extracted">AI Extracted</SelectItem>
              <SelectItem value="pending_review">Pending Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="deprecated">Deprecated</SelectItem>
            </SelectContent>
          </Select>

          <Separator orientation="vertical" className="h-5" />

          {/* Fetch from n8n */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={handleFetchFromN8n}
              >
                <RotateCw className="size-3.5" />
                Fetch from n8n
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Refresh skills from the n8n extraction pipeline
            </TooltipContent>
          </Tooltip>

          {/* Download Markdown */}
          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={handleDownloadMarkdown}
            >
              <Download className="size-3.5" />
              Download Markdown ({selectedIds.size})
            </Button>
          )}

          <div className="flex-1" />
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
                    onChange={() => {
                      if (filteredSkills.every((s) => selectedIds.has(s.id))) {
                        setSelectedIds(new Set());
                      } else {
                        setSelectedIds(
                          new Set(filteredSkills.map((s) => s.id)),
                        );
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-28">Category</TableHead>
                <TableHead className="w-28">Domain</TableHead>
                <TableHead className="w-24">Confidence</TableHead>
                <TableHead className="w-20">Exp.</TableHead>
                <TableHead className="w-20">Source</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-28">Updated</TableHead>
                <TableHead className="w-28">Actions</TableHead>
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
                    {searchQuery ||
                    categoryFilter !== "__all" ||
                    statusFilter !== "__all"
                      ? "No skills match the current filters."
                      : 'No skills yet. Click "Fetch from n8n" to import skills from the extraction pipeline.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredSkills.map((skill) => (
                  <TableRow
                    key={skill.id}
                    className="cursor-pointer"
                    onClick={() => handleViewDetail(skill)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="size-3.5"
                        checked={selectedIds.has(skill.id)}
                        onChange={() => toggleId(skill.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 shrink-0 text-blue-500" />
                        <span className="max-w-[200px] truncate text-sm text-dls-text">
                          {skill.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-dls-secondary">
                        {skill.category || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="max-w-[120px] truncate text-xs text-dls-secondary">
                        {skill.domain || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          skill.confidenceLevel === "expert" ||
                          skill.confidenceLevel === "advanced"
                            ? "secondary"
                            : "outline"
                        }
                        className="text-[10px]"
                      >
                        {confidenceLabel(skill.confidenceLevel)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-dls-secondary">
                      {skill.yearsOfExperience > 0
                        ? `${skill.yearsOfExperience}y`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <span className="text-[10px] text-dls-secondary">
                        {sourceLabel(skill.extractionSource)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {statusIcon(skill.status)}
                        <Badge
                          variant={statusBadgeVariant(skill.status)}
                          className="text-[10px]"
                        >
                          {statusLabel(skill.status)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-dls-secondary">
                      {formatDate(skill.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="size-7"
                              onClick={() => handleViewDetail(skill)}
                            >
                              <Eye className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View details</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="size-7"
                              onClick={() => handleEdit(skill)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="size-7"
                              onClick={() => handleCreateRevision(skill)}
                            >
                              <Plus className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Create revision</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="size-7 text-amber-500 hover:text-amber-600"
                              onClick={() => handleSubmitReview(skill)}
                            >
                              <Send className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Submit for review</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Detail Dialog ────────────────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-4 text-blue-500" />
              {detailSkill?.name}
            </DialogTitle>
          </DialogHeader>
          {detailSkill && (
            <div className="flex flex-col gap-4 text-sm">
              {/* Status & meta row */}
              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  variant={statusBadgeVariant(detailSkill.status)}
                  className="text-[10px]"
                >
                  {statusLabel(detailSkill.status)}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  v{detailSkill.version}
                </Badge>
                <span className="text-xs text-dls-secondary">
                  {sourceLabel(detailSkill.extractionSource)}
                </span>
              </div>

              <Separator />

              {/* Key fields */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <span className="text-xs font-medium text-dls-secondary">
                    Category
                  </span>
                  <p className="mt-0.5 text-dls-text">
                    {detailSkill.category || "-"}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-dls-secondary">
                    Domain
                  </span>
                  <p className="mt-0.5 text-dls-text">
                    {detailSkill.domain || "-"}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-dls-secondary">
                    Role
                  </span>
                  <p className="mt-0.5 text-dls-text">
                    {detailSkill.role || "-"}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-dls-secondary">
                    Confidence Level
                  </span>
                  <p className="mt-0.5 text-dls-text">
                    {confidenceLabel(detailSkill.confidenceLevel)}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-dls-secondary">
                    Years of Experience
                  </span>
                  <p className="mt-0.5 text-dls-text">
                    {detailSkill.yearsOfExperience > 0
                      ? `${detailSkill.yearsOfExperience} years`
                      : "-"}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-dls-secondary">
                    Updated
                  </span>
                  <p className="mt-0.5 text-dls-text">
                    {formatDate(detailSkill.updatedAt)}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Description */}
              <div>
                <span className="text-xs font-medium text-dls-secondary">
                  Description
                </span>
                <p className="mt-1 whitespace-pre-wrap text-dls-text">
                  {detailSkill.description || "No description provided."}
                </p>
              </div>

              {/* Tools & Frameworks */}
              {detailSkill.toolsFrameworks.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-dls-secondary">
                    Tools & Frameworks
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {detailSkill.toolsFrameworks.map((t, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="text-[10px]"
                      >
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Reusable Patterns */}
              {detailSkill.reusablePatterns.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-dls-secondary">
                    Reusable Patterns
                  </span>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-dls-text">
                    {detailSkill.reusablePatterns.map((p, i) => (
                      <li key={i} className="text-xs">
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Real Project Examples */}
              {detailSkill.realProjectExamples.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-dls-secondary">
                    Real Project Examples
                  </span>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-dls-text">
                    {detailSkill.realProjectExamples.map((e, i) => (
                      <li key={i} className="text-xs">
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Common Mistakes */}
              {detailSkill.commonMistakes.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-dls-secondary">
                    Common Mistakes
                  </span>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-dls-text">
                    {detailSkill.commonMistakes.map((m, i) => (
                      <li key={i} className="text-xs">
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* AI COE Usage */}
              {detailSkill.aiCoeUsage.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-dls-secondary">
                    AI COE Usage
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {usageLabels(detailSkill.aiCoeUsage).map((u, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">
                        {u}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons in detail */}
              <Separator />
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={() => {
                    setDetailOpen(false);
                    handleEdit(detailSkill);
                  }}
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={() => {
                    setDetailOpen(false);
                    handleCreateRevision(detailSkill);
                  }}
                >
                  <Plus className="size-3.5" />
                  Create Revision
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 border-amber-500 text-amber-600 hover:text-amber-700"
                  onClick={() => {
                    setDetailOpen(false);
                    handleSubmitReview(detailSkill);
                  }}
                >
                  <Send className="size-3.5" />
                  Submit for Review
                </Button>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => {
                    downloadMarkdown(
                      `${detailSkill.name.replace(/\s+/g, "-").toLowerCase()}.md`,
                      buildSkillMarkdown(detailSkill),
                    );
                  }}
                >
                  <Download className="size-3.5" />
                  Download Markdown
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4 text-blue-500" />
              Edit Skill
            </DialogTitle>
          </DialogHeader>
          {editSkill && (
            <div className="flex flex-col gap-4 text-sm">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-dls-text">
                  Name
                </label>
                <Input
                  value={editSkill.name}
                  onChange={(e) =>
                    setEditSkill({ ...editSkill, name: e.target.value })
                  }
                  className="h-8 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {/* Category */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-dls-text">
                    Category
                  </label>
                  <Select
                    value={editSkill.category}
                    onValueChange={(v) =>
                      setEditSkill({ ...editSkill, category: v })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Domain */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-dls-text">
                    Domain
                  </label>
                  <Input
                    value={editSkill.domain}
                    onChange={(e) =>
                      setEditSkill({ ...editSkill, domain: e.target.value })
                    }
                    placeholder="e.g. Backend, Frontend, DevOps"
                    className="h-8 text-sm"
                  />
                </div>

                {/* Role */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-dls-text">
                    Role
                  </label>
                  <Input
                    value={editSkill.role}
                    onChange={(e) =>
                      setEditSkill({ ...editSkill, role: e.target.value })
                    }
                    placeholder="e.g. Senior Engineer"
                    className="h-8 text-sm"
                  />
                </div>

                {/* Confidence Level */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-dls-text">
                    Confidence Level
                  </label>
                  <Select
                    value={editSkill.confidenceLevel}
                    onValueChange={(v) =>
                      setEditSkill({ ...editSkill, confidenceLevel: v })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONFIDENCE_LEVELS.map((cl) => (
                        <SelectItem key={cl.value} value={cl.value}>
                          {cl.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Years of Experience */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-dls-text">
                    Years of Experience
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={editSkill.yearsOfExperience}
                    onChange={(e) =>
                      setEditSkill({
                        ...editSkill,
                        yearsOfExperience: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-dls-text">
                  Description
                </label>
                <textarea
                  value={editSkill.description}
                  onChange={(e) =>
                    setEditSkill({ ...editSkill, description: e.target.value })
                  }
                  rows={4}
                  className="w-full rounded-md border border-dls-border bg-dls-surface px-3 py-2 text-sm text-dls-text placeholder:text-dls-tertiary focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Describe the skill in detail..."
                />
              </div>

              {/* Tools & Frameworks */}
              <ArrayFieldEditor
                label="Tools & Frameworks"
                items={editSkill.toolsFrameworks}
                onUpdate={(index, value) =>
                  handleEditArrayField("toolsFrameworks", index, value)
                }
                onAdd={() => handleEditAddArrayItem("toolsFrameworks")}
                onRemove={(index) =>
                  handleEditRemoveArrayItem("toolsFrameworks", index)
                }
              />

              {/* Reusable Patterns */}
              <ArrayFieldEditor
                label="Reusable Patterns"
                items={editSkill.reusablePatterns}
                onUpdate={(index, value) =>
                  handleEditArrayField("reusablePatterns", index, value)
                }
                onAdd={() => handleEditAddArrayItem("reusablePatterns")}
                onRemove={(index) =>
                  handleEditRemoveArrayItem("reusablePatterns", index)
                }
              />

              {/* Real Project Examples */}
              <ArrayFieldEditor
                label="Real Project Examples"
                items={editSkill.realProjectExamples}
                onUpdate={(index, value) =>
                  handleEditArrayField("realProjectExamples", index, value)
                }
                onAdd={() => handleEditAddArrayItem("realProjectExamples")}
                onRemove={(index) =>
                  handleEditRemoveArrayItem("realProjectExamples", index)
                }
              />

              {/* Common Mistakes */}
              <ArrayFieldEditor
                label="Common Mistakes"
                items={editSkill.commonMistakes}
                onUpdate={(index, value) =>
                  handleEditArrayField("commonMistakes", index, value)
                }
                onAdd={() => handleEditAddArrayItem("commonMistakes")}
                onRemove={(index) =>
                  handleEditRemoveArrayItem("commonMistakes", index)
                }
              />

              {/* AI COE Usage */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-dls-text">
                  AI COE Usage
                </label>
                <div className="grid grid-cols-2 gap-1.5 rounded-md border border-dls-border bg-dls-surface p-3">
                  {AI_COE_USAGE_OPTIONS.map((opt) => {
                    const selected = editSkill.aiCoeUsage.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className={`flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                          selected
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : "text-dls-text hover:bg-dls-bg"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="size-3.5"
                          checked={selected}
                          onChange={() => handleEditToggleUsage(opt.value)}
                        />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSaveSkill} loading={editSaving}>
              Save Skill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Array Field Editor Sub-component ────────────────────────────────────────
function ArrayFieldEditor({
  label,
  items,
  onUpdate,
  onAdd,
  onRemove,
}: {
  label: string;
  items: string[];
  onUpdate: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-dls-text">{label}</label>
      <div className="flex flex-col gap-1.5 rounded-md border border-dls-border bg-dls-surface p-3">
        {items.length === 0 && (
          <p className="text-xs text-dls-tertiary">No items yet.</p>
        )}
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={item}
              onChange={(e) => onUpdate(index, e.target.value)}
              placeholder={`${label} item ${index + 1}`}
              className="h-7 flex-1 text-xs"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-6 shrink-0 text-dls-secondary hover:text-red-500"
              onClick={() => onRemove(index)}
            >
              <XCircle className="size-3" />
            </Button>
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 h-6 self-start text-xs text-dls-secondary hover:text-dls-text"
          onClick={onAdd}
        >
          <Plus className="size-3" />
          Add item
        </Button>
      </div>
    </div>
  );
}
