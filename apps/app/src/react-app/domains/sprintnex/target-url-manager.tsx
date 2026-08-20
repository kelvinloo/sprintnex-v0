/** @jsxImportSource react */
import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/i18n";
import {
  useTargetUrls,
  useSelectedTargetUrl,
  selectTargetUrl,
  createTargetUrl,
  updateTargetUrl,
  deleteTargetUrl,
  type TargetUrlConfig,
} from "@/app/lib/target-url-store";

export function TargetUrlSelector() {
  const urls = useTargetUrls();
  const selected = useSelectedTargetUrl();
  const [showManager, setShowManager] = useState(false);

  return (
    <>
      <div className="space-y-1">
        <label className="text-xs font-medium text-dls-text">
          {t("sprintnex.target.title")}
        </label>
        <div className="flex gap-2">
          <select
            value={selected?.id ?? ""}
            onChange={(e) => selectTargetUrl(e.target.value)}
            className="h-8 flex-1 rounded-md border border-dls-border bg-background px-2 text-xs text-foreground"
          >
            {urls.length === 0 && (
              <option value="" disabled>
                {t("sprintnex.target.no_urls")}
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
        {selected && (
          <p className="truncate text-[10px] text-dls-muted">{selected.url}</p>
        )}
      </div>

      {showManager && (
        <TargetUrlManagerModal onClose={() => setShowManager(false)} />
      )}
    </>
  );
}

function TargetUrlManagerModal({ onClose }: { onClose: () => void }) {
  const urls = useTargetUrls();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const startEdit = (url: TargetUrlConfig) => {
    setEditingId(url.id);
    setEditName(url.name);
    setEditUrl(url.url);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editName.trim() || !editUrl.trim()) return;
    updateTargetUrl(editingId, { name: editName.trim(), url: editUrl.trim() });
    setEditingId(null);
  };

  const handleCreate = () => {
    if (!newName.trim() || !newUrl.trim()) return;
    const created = createTargetUrl(newName.trim(), newUrl.trim());
    selectTargetUrl(created.id);
    setNewName("");
    setNewUrl("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl border border-dls-border bg-dls-surface p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-dls-text">
            {t("sprintnex.target.urls")}
          </h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="mb-4 max-h-48 space-y-2 overflow-auto">
          {urls.length === 0 && (
            <p className="py-4 text-center text-xs text-dls-muted">
              {t("sprintnex.target.no_urls_add_one")}
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
                    placeholder={t("sprintnex.common.name")}
                  />
                  <Input
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    className="h-7 text-xs"
                    placeholder={t("sprintnex.common.url")}
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
                    onClick={() => deleteTargetUrl(url.id)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t border-dls-border pt-3">
          <h3 className="text-[11px] font-medium text-dls-secondary">
            {t("sprintnex.target.add_url")}
          </h3>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("sprintnex.form.target_name_placeholder")}
            className="h-7 text-xs"
          />
          <Input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder={t("sprintnex.form.target_url_placeholder")}
            className="h-7 text-xs"
          />
          <Button
            size="sm"
            className="w-full h-7"
            onClick={handleCreate}
            disabled={!newName.trim() || !newUrl.trim()}
          >
            <Plus className="size-3" />
            {t("sprintnex.action.add_target_url")}
          </Button>
        </div>
      </div>
    </div>
  );
}
