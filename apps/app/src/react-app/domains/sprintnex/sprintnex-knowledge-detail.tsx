/** @jsxImportSource react */
import { useState, useEffect } from "react";
import { ArrowLeft, FileText } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Markdown } from "@/components/ui/markdown";
import { t } from "@/i18n";

interface KnowledgeRecord {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  version: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  markdown?: string;
  raw?: Record<string, unknown>;
}

const N8N_KNOWLEDGE_RETRIEVE_URL =
  "https://n8n.directintegrate.com/webhook/aicoe/knowledge/retrieve";

export function SprintnexKnowledgeDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<KnowledgeRecord | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(N8N_KNOWLEDGE_RETRIEVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(getScope()),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const allItems = data?.knowledges || data?.data || [];
        const found = allItems.find(
          (item: Record<string, unknown>) => item._id === id || item.id === id,
        );
        if (found) {
          setRecord({
            id: (found._id as string) || (found.id as string) || id,
            name: (found.name as string) || t("sprintnex.common.untitled"),
            fileName:
              (found.fileName as string) || (found.name as string) || "-",
            fileSize: (found.fileSize as number) || 0,
            fileType: (found.fileType as string) || "text/markdown",
            version:
              (found.version as string) || (found._version as string) || "-",
            status: (found.status as string) || "active",
            createdAt: (found.createdAt as string) || "",
            updatedAt: (found.updatedAt as string) || "",
            markdown: (found.markdown as string) || "",
            raw: found as Record<string, unknown>,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-dls-bg">
        <div className="flex items-center justify-center py-20 text-sm text-dls-secondary">
          {t("sprintnex.task.loading")}
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-dls-bg">
        <div className="flex items-center justify-center py-20 text-sm text-dls-secondary">
          {t("sprintnex.knowledge.not_found")}
        </div>
      </div>
    );
  }

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
                {record.name}
              </h1>
              <p className="text-xs text-dls-secondary">
                {record.fileName} · v{record.version}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/sprintnex/knowledge")}
          >
            <ArrowLeft className="size-4" />
            {t("common.back")}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-4">
        <Tabs defaultValue="markdown" className="flex min-h-0 flex-1 flex-col">
          <TabsList>
            <TabsTrigger value="markdown">
              {t("sprintnex.common.markdown_view")}
            </TabsTrigger>
            <TabsTrigger value="json">
              {t("sprintnex.knowledge.json_view")}
            </TabsTrigger>
          </TabsList>
          <div className="min-h-0 flex-1 pt-2">
            <TabsContent value="markdown" className="h-full overflow-y-auto">
              <div className="knowledge-markdown rounded-lg border border-dls-border p-6">
                {record.markdown ? (
                  <Markdown>{record.markdown}</Markdown>
                ) : (
                  <p className="text-sm text-dls-secondary">
                    {t("sprintnex.knowledge.no_markdown")}
                  </p>
                )}
              </div>
            </TabsContent>
            <TabsContent value="json" className="h-full overflow-y-auto">
              <pre className="whitespace-pre-wrap break-all rounded-lg bg-dls-surface p-4 text-xs text-dls-text">
                {JSON.stringify(record.raw || null, null, 2)}
              </pre>
            </TabsContent>
          </div>
        </Tabs>
      </div>
      <style>{`
        .knowledge-markdown { background: #0f172a; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.75; font-size: 14px; }
        .knowledge-markdown h1 { font-size: 1.75em; font-weight: 700; margin: 0 0 16px; padding-bottom: 10px; border-bottom: 2px solid #1e293b; color: #f1f5f9; letter-spacing: -0.02em; }
        .knowledge-markdown h2 { font-size: 1.35em; font-weight: 650; margin: 28px 0 12px; color: #e2e8f0; letter-spacing: -0.01em; }
        .knowledge-markdown h3 { font-size: 1.15em; font-weight: 600; margin: 22px 0 10px; color: #cbd5e1; }
        .knowledge-markdown h4 { font-size: 1.05em; font-weight: 600; margin: 18px 0 8px; color: #94a3b8; }
        .knowledge-markdown p { margin: 0 0 14px; color: #e2e8f0; }
        .knowledge-markdown ul, .knowledge-markdown ol { margin: 8px 0 16px; padding-left: 24px; color: #e2e8f0; }
        .knowledge-markdown li { margin-bottom: 6px; }
        .knowledge-markdown li > ul, .knowledge-markdown li > ol { margin-top: 6px; margin-bottom: 0; }
        .knowledge-markdown strong { font-weight: 650; color: #f8fafc; }
        .knowledge-markdown em { font-style: italic; color: #94a3b8; }
        .knowledge-markdown a { color: #60a5fa; text-decoration: none; border-bottom: 1px solid rgba(96,165,250,0.3); transition: border-color .2s; }
        .knowledge-markdown a:hover { border-bottom-color: #60a5fa; }
        .knowledge-markdown code { background: #1e293b; color: #f472b6; padding: 2px 7px; border-radius: 5px; font-size: 0.88em; font-family: "SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", Menlo, Monaco, "Cascadia Code", monospace; }
        .knowledge-markdown pre { background: #020617; color: #e2e8f0; padding: 18px 20px; border-radius: 10px; overflow-x: auto; margin: 14px 0; font-size: 0.85em; line-height: 1.65; border: 1px solid #1e293b; }
        .knowledge-markdown pre code { background: none; color: inherit; padding: 0; font-size: inherit; border-radius: 0; }
        .knowledge-markdown blockquote { border-left: 4px solid #3b82f6; margin: 14px 0; padding: 10px 18px; color: #94a3b8; background: #1e293b; border-radius: 0 8px 8px 0; font-style: italic; }
        .knowledge-markdown blockquote p:last-child { margin-bottom: 0; }
        .knowledge-markdown table { border-collapse: collapse; margin: 14px 0; width: 100%; font-size: 0.92em; border-radius: 8px; overflow: hidden; border: 1px solid #1e293b; }
        .knowledge-markdown th { background: #1e293b; color: #f1f5f9; font-weight: 650; padding: 10px 14px; text-align: left; border: 1px solid #334155; }
        .knowledge-markdown td { padding: 9px 14px; border: 1px solid #1e293b; vertical-align: top; color: #e2e8f0; }
        .knowledge-markdown tr:nth-child(even) td { background: #1a2332; }
        .knowledge-markdown hr { border: none; border-top: 2px solid #1e293b; margin: 24px 0; }
        .knowledge-markdown img { max-width: 100%; border-radius: 8px; margin: 12px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
      `}</style>
    </div>
  );
}
