/** @jsxImportSource react */
import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  FileText,
  Plus,
  RotateCw,
  Eye,
  Pencil,
  Trash2,
  Upload,
  Merge,
  FolderPlus,
  FolderOpen,
  X,
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

// ── Types ───────────────────────────────────────────────────────────────────
interface KnowledgeRecord {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  version: string;
  status: "active" | "processing" | "failed";
  createdAt: string;
  updatedAt: string;
  markdown?: string;
  raw?: Record<string, unknown>;
}

interface KnowledgeGroup {
  id: string;
  name: string;
  knowledgeIds: string[];
}

// ── n8n endpoints ───────────────────────────────────────────────────────────
const N8N_KNOWLEDGE_UPLOAD_URL =
  "https://n8n.directintegrate.com/webhook/aicoe/knowledge/upload";
const N8N_KNOWLEDGE_RETRIEVE_URL =
  "https://n8n.directintegrate.com/webhook/aicoe/knowledge/retrieve";
const N8N_KNOWLEDGE_DEACTIVATE_URL =
  "https://n8n.directintegrate.com/webhook/aicoe/knowledge/deactivate";
const N8N_KNOWLEDGE_MERGE_URL =
  "https://n8n.directintegrate.com/webhook/aicoe/knowledge/merge";
const N8N_KNOWLEDGE_UPDATE_URL =
  "https://n8n.directintegrate.com/webhook/aicoe/knowledge/update";

const GROUPS_KEY = "aicoe_knowledge_groups";

const loadGroups = (): KnowledgeGroup[] => {
  try {
    return JSON.parse(localStorage.getItem(GROUPS_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveGroups = (groups: KnowledgeGroup[]) => {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

// ── Component ───────────────────────────────────────────────────────────────
export function SprintnexKnowledgePage() {
  const navigate = useNavigate();
  const scope = readSprintnexAicoeScope();

  // Data
  const [records, setRecords] = useState<KnowledgeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Create / Replace
  const [createOpen, setCreateOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceRecord, setReplaceRecord] = useState<KnowledgeRecord | null>(
    null,
  );
  const [createName, setCreateName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Rename
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameRecord, setRenameRecord] = useState<KnowledgeRecord | null>(
    null,
  );
  const [renameDraft, setRenameDraft] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);

  // Groups
  const [groups, setGroups] = useState<KnowledgeGroup[]>(loadGroups);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [groupManageOpen, setGroupManageOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [groupSaving, setGroupSaving] = useState(false);

  // ── Auth / Scope ──────────────────────────────────────────────────────────
  const authHeaders = () => {
    const token =
      localStorage.getItem("auth_token") ||
      localStorage.getItem("accessToken") ||
      "";
    return { Authorization: token ? `Bearer ${token}` : "" };
  };

  const getScope = () => ({
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
  });

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const scopeData = getScope();
    try {
      const res = await fetch(N8N_KNOWLEDGE_RETRIEVE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(scopeData),
      });
      if (res.ok) {
        const data = await res.json();
        const allItems = data?.knowledges || data?.data || [];
        const items = allItems.filter(
          (item: Record<string, unknown>) =>
            !scopeData.projectId || item.projectId === scopeData.projectId,
        );
        setRecords(
          items.map((item: Record<string, unknown>, i: number) => ({
            id: (item._id as string) || `k-${i}`,
            name: (item.name as string) || "Untitled",
            fileName: (item.fileName as string) || (item.name as string) || "-",
            fileSize: (item.fileSize as number) || 0,
            fileType: (item.fileType as string) || "text/markdown",
            version:
              (item.version as string) || (item._version as string) || "-",
            status: (item.status as KnowledgeRecord["status"]) || "active",
            createdAt: (item.createdAt as string) || "",
            updatedAt: (item.updatedAt as string) || "",
            markdown: (item.markdown as string) || "",
            raw: item,
          })),
        );
      }
    } catch {
      // non-blocking
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleRetrieve = async () => {
    try {
      const res = await fetch(N8N_KNOWLEDGE_RETRIEVE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(getScope()),
      });
      if (res.ok) fetchRecords();
    } catch {
      // non-blocking
    }
  };

  const handleDeactivate = async (record: KnowledgeRecord) => {
    try {
      await fetch(N8N_KNOWLEDGE_DEACTIVATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          ...getScope(),
          recordId: record.id,
          name: record.name,
        }),
      });
      fetchRecords();
    } catch {
      // non-blocking
    }
  };

  const handleMerge = async () => {
    if (selectedIds.size < 2) return;
    try {
      await fetch(N8N_KNOWLEDGE_MERGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          ...getScope(),
          knowledgeIds: Array.from(selectedIds),
        }),
      });
      setSelectedIds(new Set());
      fetchRecords();
    } catch {
      // non-blocking
    }
  };

  const handleRename = async () => {
    if (!renameRecord || !renameDraft.trim()) return;
    setRenameSaving(true);
    try {
      await fetch(N8N_KNOWLEDGE_UPDATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          ...getScope(),
          recordId: renameRecord.id,
          name: renameDraft.trim(),
        }),
      });
      setRenameOpen(false);
      setRenameRecord(null);
      fetchRecords();
    } catch {
      // non-blocking
    } finally {
      setRenameSaving(false);
    }
  };

  const handleUpload = async (mode: "create" | "replace") => {
    if (mode === "create" && !createName.trim()) return;
    if (!uploadFile) return;

    setUploading(true);
    const fd = new FormData();
    fd.append(
      "name",
      mode === "create" ? createName.trim() : replaceRecord?.name || "",
    );
    fd.append("file", uploadFile);
    const scopeData = getScope();
    fd.append("organizationId", scopeData.organizationId);
    fd.append("teamId", scopeData.teamId);
    fd.append("projectId", scopeData.projectId);
    fd.append("userId", scopeData.userId);
    if (mode === "replace" && replaceRecord) {
      fd.append("recordId", replaceRecord.id);
    }

    try {
      await fetch(N8N_KNOWLEDGE_UPLOAD_URL, {
        method: "POST",
        headers: authHeaders(),
        body: fd,
      });
    } catch {
      // non-blocking
    }

    setCreateOpen(false);
    setReplaceOpen(false);
    setUploadFile(null);
    setCreateName("");
    setReplaceRecord(null);
    setUploading(false);
    fetchRecords();
  };

  const handleFileSelect = (file: File | null) => {
    setUploadFile(file);
  };

  // ── Group handlers ────────────────────────────────────────────────────────
  const handleCreateGroup = () => {
    const name = newGroupName.trim();
    if (!name) return;
    const next = [...groups, { id: `g-${Date.now()}`, name, knowledgeIds: [] }];
    setGroups(next);
    saveGroups(next);
    setNewGroupName("");
  };

  const handleDeleteGroup = (groupId: string) => {
    const next = groups.filter((g) => g.id !== groupId);
    setGroups(next);
    saveGroups(next);
    if (activeGroupId === groupId) setActiveGroupId(null);
  };

  const handleAddToGroup = async (groupId: string) => {
    if (selectedIds.size === 0) return;
    setGroupSaving(true);
    const next = groups.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        knowledgeIds: [
          ...new Set([...g.knowledgeIds, ...Array.from(selectedIds)]),
        ],
      };
    });
    setGroups(next);
    saveGroups(next);
    try {
      await fetch(N8N_KNOWLEDGE_UPDATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          ...getScope(),
          groupId,
          knowledgeIds: Array.from(selectedIds),
          action: "addToGroup",
        }),
      });
    } catch {
      // non-blocking
    }
    setSelectedIds(new Set());
    setGroupSaving(false);
  };

  const handleRemoveFromGroup = async () => {
    if (!activeGroupId || selectedIds.size === 0) return;
    setGroupSaving(true);
    const next = groups.map((g) => {
      if (g.id !== activeGroupId) return g;
      return {
        ...g,
        knowledgeIds: g.knowledgeIds.filter((id) => !selectedIds.has(id)),
      };
    });
    setGroups(next);
    saveGroups(next);
    try {
      await fetch(N8N_KNOWLEDGE_UPDATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          ...getScope(),
          groupId: activeGroupId,
          knowledgeIds: Array.from(selectedIds),
          action: "removeFromGroup",
        }),
      });
    } catch {
      // non-blocking
    }
    setSelectedIds(new Set());
    setGroupSaving(false);
  };

  // ── Filtered records ────────────────────────────────────────────────────
  const displayRecords = activeGroupId
    ? records.filter((r) => {
        const group = groups.find((g) => g.id === activeGroupId);
        return group?.knowledgeIds.includes(r.id);
      })
    : records;

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
                Knowledge Base
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
          {/* Group filter */}
          <Select
            value={activeGroupId ?? "__all__"}
            onValueChange={(v) => {
              setActiveGroupId(v === "__all__" ? null : v);
              setSelectedIds(new Set());
            }}
          >
            <SelectTrigger className="h-7 w-[180px] text-xs">
              <SelectValue placeholder="Filter by group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Knowledge</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name} ({g.knowledgeIds.length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Manage Groups */}
          <Button
            variant="outline"
            size="sm"
            className="h-7"
            onClick={() => setGroupManageOpen(true)}
          >
            <FolderOpen className="size-3.5" />
            Groups
          </Button>
          <Dialog open={groupManageOpen} onOpenChange={setGroupManageOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Manage Groups</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <Input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="New group name"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateGroup();
                    }}
                    className="h-8 text-xs"
                  />
                  <Button size="sm" className="h-8" onClick={handleCreateGroup}>
                    <FolderPlus className="size-3.5" />
                    Create
                  </Button>
                </div>
                {groups.length === 0 ? (
                  <p className="py-4 text-center text-xs text-dls-secondary">
                    No groups yet
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {groups.map((g) => (
                      <div
                        key={g.id}
                        className="flex items-center justify-between rounded-md border border-dls-border bg-dls-surface px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-dls-text">
                            {g.name}
                          </span>
                          <Badge variant="outline" className="text-[9px]">
                            {g.knowledgeIds.length}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-dls-secondary hover:text-red-500"
                          onClick={() => handleDeleteGroup(g.id)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Close</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Separator orientation="vertical" className="h-5" />

          {/* Actions */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={handleRetrieve}
          >
            <RotateCw className="size-3.5" />
            Refresh
          </Button>

          {selectedIds.size > 0 && (
            <>
              {activeGroupId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  loading={groupSaving}
                  onClick={handleRemoveFromGroup}
                >
                  Remove from Group ({selectedIds.size})
                </Button>
              )}
              <Select value="" onValueChange={(gid) => handleAddToGroup(gid)}>
                <SelectTrigger className="h-7 w-[150px] text-xs">
                  <SelectValue placeholder="Add to group..." />
                </SelectTrigger>
                <SelectContent>
                  {groups
                    .filter((g) => g.id !== activeGroupId)
                    .map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {selectedIds.size >= 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 border-orange-500 text-orange-600"
                  onClick={handleMerge}
                >
                  <Merge className="size-3.5" />
                  Merge ({selectedIds.size})
                </Button>
              )}
            </>
          )}

          <div className="flex-1" />

          <Button size="sm" className="h-7" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            New Knowledge
          </Button>
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
                      displayRecords.length > 0 &&
                      displayRecords.every((r) => selectedIds.has(r.id))
                    }
                    onChange={() => {
                      if (displayRecords.every((r) => selectedIds.has(r.id))) {
                        setSelectedIds(new Set());
                      } else {
                        setSelectedIds(
                          new Set(displayRecords.map((r) => r.id)),
                        );
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-24">Version</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-28">Size</TableHead>
                <TableHead className="w-36">Updated</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-12 text-center text-xs text-dls-secondary"
                  >
                    Loading...
                  </TableCell>
                </TableRow>
              ) : displayRecords.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-12 text-center text-xs text-dls-secondary"
                  >
                    No knowledge records yet. Click "New Knowledge" to upload a
                    document.
                  </TableCell>
                </TableRow>
              ) : (
                displayRecords.map((record) => (
                  <TableRow
                    key={record.id}
                    className="cursor-pointer"
                    onClick={() =>
                      navigate(`/sprintnex/knowledge/${record.id}`)
                    }
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="size-3.5"
                        checked={selectedIds.has(record.id)}
                        onChange={() => toggleId(record.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 shrink-0 text-blue-500" />
                        <span className="max-w-[300px] truncate text-sm text-dls-text">
                          {record.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-dls-surface px-1.5 py-0.5 text-[11px] text-dls-secondary">
                        {record.version}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          record.status === "active"
                            ? "secondary"
                            : record.status === "processing"
                              ? "outline"
                              : "destructive"
                        }
                        className="text-[10px]"
                      >
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-dls-secondary">
                      {formatFileSize(record.fileSize)}
                    </TableCell>
                    <TableCell className="text-xs text-dls-secondary">
                      {record.updatedAt
                        ? new Date(record.updatedAt).toLocaleDateString()
                        : "-"}
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
                              onClick={() =>
                                navigate(`/sprintnex/knowledge/${record.id}`)
                              }
                            >
                              <Eye className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="size-7"
                              onClick={() => {
                                setRenameRecord(record);
                                setRenameDraft(record.name);
                                setRenameOpen(true);
                              }}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Rename</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="size-7 text-red-500 hover:text-red-600"
                              onClick={() => handleDeactivate(record)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Deactivate</TooltipContent>
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

      {/* Detail view moved to separate page at /sprintnex/knowledge/:id */}

      {/* ── Create Dialog ────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Knowledge</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-dls-text">Name</label>
              <Input
                placeholder="e.g. Architecture Overview"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-dls-text">
                Document
              </label>
              <label
                className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-dls-border bg-dls-surface p-6 text-center hover:border-blue-400"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileSelect(file);
                }}
              >
                <Upload className="size-8 text-dls-secondary" />
                {uploadFile ? (
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-blue-500" />
                    <span className="text-sm text-dls-text">
                      {uploadFile.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-5"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFileSelect(null);
                      }}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-dls-text">
                      Click or drag a document
                    </p>
                    <p className="text-xs text-dls-secondary">
                      PDF, Word, Excel, Markdown, text, ZIP
                    </p>
                  </>
                )}
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md,.pptx,.ppt,.zip,.gz,.tar"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />
              </label>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={() => handleUpload("create")}
              loading={uploading}
              disabled={!createName.trim() || !uploadFile}
            >
              <Upload className="size-3.5" />
              Upload & Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Rename Dialog ────────────────────────────────────────────────── */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Knowledge</DialogTitle>
          </DialogHeader>
          <Input
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            placeholder="New name"
            maxLength={200}
            className="h-8 text-sm"
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleRename} loading={renameSaving}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
