/** @jsxImportSource react */
import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Globe } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useMcpUrls,
  useSelectedMcpUrl,
  selectMcpUrl,
  createMcpUrl,
  updateMcpUrl,
  deleteMcpUrl,
  type McpUrlConfig,
} from "@/app/lib/mcp-url-store";
import {
  readSprintnexAicoeScope,
  getMappedWorkspaceForSprintnexProject,
} from "@/app/lib/sprintnex-aicoe-api";
import { createOpenworkServerClient } from "@/app/lib/openwork-server";
import { resolveOpenworkConnection } from "@/react-app/shell/openwork-connection";

/**
 * Register the selected MCP URL as the workspace's browser MCP server so the
 * agent's actual tool connection points at the newly selected server.
 */
async function registerBrowserMcpForWorkspace(url: string): Promise<void> {
  try {
    const { normalizedBaseUrl, resolvedToken } =
      await resolveOpenworkConnection();
    if (!normalizedBaseUrl || !resolvedToken) return;
    const scope = readSprintnexAicoeScope();
    const mappedWsId = getMappedWorkspaceForSprintnexProject(scope.projectId);
    if (!mappedWsId) return;
    // Use the configured URL exactly as provided — never append /mcp.
    const mcpUrl = url.trim();
    const client = createOpenworkServerClient({
      baseUrl: normalizedBaseUrl,
      token: resolvedToken,
    });
    await client.addMcp(mappedWsId, {
      name: "browser-mcp",
      config: { type: "remote", url: mcpUrl, enabled: true },
    });
  } catch {
    // Best-effort; selection is still stored locally.
  }
}

export function McpUrlSelector() {
  const urls = useMcpUrls();
  const selected = useSelectedMcpUrl();
  const [showManager, setShowManager] = useState(false);

  const handleSelect = (id: string) => {
    selectMcpUrl(id);
    const entry = urls.find((u) => u.id === id);
    if (entry) {
      void registerBrowserMcpForWorkspace(entry.url).then(() => {
        toast.success(`Browser MCP switched to ${entry.name}`);
      });
    }
  };

  return (
    <>
      <div className="space-y-1">
        <label className="text-xs font-medium text-dls-text">
          MCP Browser Server
        </label>
        <div className="flex gap-2">
          <select
            value={selected?.id ?? ""}
            onChange={(e) => handleSelect(e.target.value)}
            className="h-8 flex-1 rounded-md border border-dls-border bg-background px-2 text-xs text-foreground"
          >
            {urls.length === 0 && (
              <option value="" disabled>
                No MCP servers configured
              </option>
            )}
            {urls.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="icon-sm"
            className="size-8 shrink-0"
            onClick={() => setShowManager(true)}
          >
            <Globe className="size-3.5" />
          </Button>
        </div>
      </div>

      {showManager && (
        <McpUrlManagerModal onClose={() => setShowManager(false)} />
      )}
    </>
  );
}

function McpUrlManagerModal({ onClose }: { onClose: () => void }) {
  const urls = useMcpUrls();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const startEdit = (url: McpUrlConfig) => {
    setEditingId(url.id);
    setEditName(url.name);
    setEditUrl(url.url);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editName.trim() || !editUrl.trim()) return;
    updateMcpUrl(editingId, { name: editName.trim(), url: editUrl.trim() });
    setEditingId(null);
  };

  const handleCreate = () => {
    if (!newName.trim() || !newUrl.trim()) return;
    const created = createMcpUrl(newName.trim(), newUrl.trim());
    // Auto-select the newly created URL so it reflects immediately
    selectMcpUrl(created.id);
    void registerBrowserMcpForWorkspace(created.url).then(() => {
      toast.success(`Browser MCP switched to ${created.name}`);
    });
    setNewName("");
    setNewUrl("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl border border-dls-border bg-dls-surface p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-dls-text">
            MCP Server URLs
          </h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Existing URLs */}
        <div className="mb-4 max-h-48 space-y-2 overflow-auto">
          {urls.length === 0 && (
            <p className="py-4 text-center text-xs text-dls-muted">
              No MCP servers configured. Add one below.
            </p>
          )}
          {urls.map((url) => (
            <div
              key={url.id}
              className="rounded-md border border-dls-border bg-dls-bg p-2"
            >
              {editingId === url.id ? (
                <div className="space-y-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-7 text-xs"
                    placeholder="Name"
                  />
                  <Input
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    className="h-7 text-xs"
                    placeholder="URL"
                  />
                  <div className="flex gap-1">
                    <Button size="sm" className="h-6" onClick={handleSaveEdit}>
                      <Check className="size-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-dls-text">
                      {url.name}
                    </p>
                    <p className="truncate text-[10px] text-dls-muted">
                      {url.url}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-6"
                    onClick={() => startEdit(url)}
                  >
                    <Pencil className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-6 text-red-500"
                    onClick={() => deleteMcpUrl(url.id)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add new */}
        <div className="space-y-2 border-t border-dls-border pt-3">
          <h3 className="text-[11px] font-medium text-dls-secondary">
            Add Server
          </h3>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name (e.g. Production MCP)"
            className="h-7 text-xs"
          />
          <Input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="URL (e.g. https://mcp.example.com)"
            className="h-7 text-xs"
          />
          <Button
            size="sm"
            className="w-full h-7"
            onClick={handleCreate}
            disabled={!newName.trim() || !newUrl.trim()}
          >
            <Plus className="size-3" />
            Add Server
          </Button>
        </div>
      </div>
    </div>
  );
}
