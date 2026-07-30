/** @jsxImportSource react */
import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Globe } from "lucide-react";
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

export function McpUrlSelector() {
  const urls = useMcpUrls();
  const selected = useSelectedMcpUrl();
  const [showManager, setShowManager] = useState(false);

  return (
    <>
      <div className="space-y-1">
        <label className="text-xs font-medium text-dls-text">
          MCP Browser Server
        </label>
        <div className="flex gap-2">
          <select
            value={selected?.id ?? ""}
            onChange={(e) => selectMcpUrl(e.target.value)}
            className="h-8 flex-1 rounded-md border border-dls-border bg-background px-2 text-xs text-foreground"
          >
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
    createMcpUrl(newName.trim(), newUrl.trim());
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
                    disabled={url.id === "local"}
                  >
                    <Pencil className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-6 text-red-500"
                    onClick={() => deleteMcpUrl(url.id)}
                    disabled={url.id === "local"}
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
