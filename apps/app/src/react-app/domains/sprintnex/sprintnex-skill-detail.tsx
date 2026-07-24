/** @jsxImportSource react */
import { useState, useEffect } from "react";
import { ArrowLeft, Brain, Globe, GlobeOff, Pencil, Send } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Markdown } from "@/components/ui/markdown";
import { AICOE_BASE } from "@/app/lib/api-config";
import { SprintnexTabBar } from "./sprintnex-tab-bar";

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
  rejectionReason?: string;
  reviewerNotes?: string;
  createdAt: string;
  updatedAt: string;
  n8nId: string;
  raw?: Record<string, unknown>;
};

function getApiHeaders() {
  const token =
    localStorage.getItem("auth_token") ||
    localStorage.getItem("accessToken") ||
    "";
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function getScope() {
  return {
    organizationId: localStorage.getItem("selected_organization_id") || "",
    userId: localStorage.getItem("userId") || "",
  };
}

export function SprintnexSkillDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [skill, setSkill] = useState<SkillRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [published, setPublished] = useState(false);

  const N8N_SKILLS_RETRIEVE_URL =
    "https://n8n.directintegrate.com/webhook/aicoe/skills/retrieve";
  const N8N_MARKETPLACE_UPDATE_URL =
    "https://n8n.directintegrate.com/webhook/aicoe/skills/marketplace/update";

  const handlePublishToggle = async () => {
    if (!skill) return;
    setPublishLoading(true);
    try {
      const res = await fetch(N8N_MARKETPLACE_UPDATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillId: skill.n8nId,
          action: published ? "unpublish" : "publish",
        }),
      });
      if (res.ok) setPublished(!published);
    } catch {
    } finally {
      setPublishLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(N8N_SKILLS_RETRIEVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getApiHeaders() },
      body: JSON.stringify(getScope()),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list = data?.skills ?? data?.data ?? data ?? [];
        const found = Array.isArray(list)
          ? list.find((i: Record<string, unknown>) => (i._id as string) === id)
          : null;
        if (found) {
          const n8nId = (found._id as string) || "";
          setSkill({
            id: n8nId,
            n8nId,
            name:
              (found.skillName as string) ||
              (found.name as string) ||
              "Untitled",
            category: (found.category as string) || "",
            domain: (found.domain as string) || "",
            role: (found.role as string) || "",
            confidenceLevel: (found.confidenceLevel as string) || "beginner",
            yearsOfExperience: (found.yearsOfExperience as number) || 0,
            description:
              (found.markdown as string) || (found.description as string) || "",
            toolsFrameworks: Array.isArray(found.tags)
              ? (found.tags as string[])
              : Array.isArray(found.toolsFrameworks)
                ? (found.toolsFrameworks as string[])
                : [],
            reusablePatterns: [],
            realProjectExamples: [],
            commonMistakes: [],
            aiCoeUsage: [],
            extractionSource: (found.extractionSource as string) || "manual",
            status: (found.status as string) || "draft",
            version: (found.version as number) || 1,
            rejectionReason: found.rejectionReason as string,
            reviewerNotes: found.reviewerNotes as string,
            createdAt: (found.createdAt as string) || "",
            updatedAt: (found.updatedAt as string) || "",
            raw: found as Record<string, unknown>,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmitReview = async () => {
    if (!skill) return;
    setSubmitLoading(true);
    try {
      await fetch(`${AICOE_BASE}/skills/${skill.id}/submit-review`, {
        method: "POST",
        headers: getApiHeaders(),
      });
      navigate("/sprintnex/skills");
    } catch {
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-dls-bg">
        <div className="flex items-center justify-center py-20 text-sm text-dls-secondary">
          Loading...
        </div>
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-dls-bg">
        <div className="flex items-center justify-center py-20 text-sm text-dls-secondary">
          Skill not found.
        </div>
      </div>
    );
  }

  const canSubmit = ["draft", "ai_extracted"].includes(skill.status);
  const canEdit = ["draft", "ai_extracted", "rejected"].includes(skill.status);

  return (
    <div className="flex h-full min-h-0 flex-col bg-dls-bg">
      <div className="shrink-0 border-b border-dls-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7 shrink-0"
              onClick={() => navigate("/sprintnex/skills")}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#111827] text-white">
              <Brain size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold text-dls-text">
                {skill.name}
              </h1>
              <p className="text-xs text-dls-secondary">
                {skill.category} · v{skill.version}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canSubmit && (
              <Button
                size="sm"
                onClick={handleSubmitReview}
                disabled={submitLoading}
              >
                <Send className="size-3.5" /> Submit for Review
              </Button>
            )}
            <Button
              variant={published ? "outline" : "default"}
              size="sm"
              onClick={handlePublishToggle}
              disabled={publishLoading}
            >
              {published ? (
                <GlobeOff className="size-3.5" />
              ) : (
                <Globe className="size-3.5" />
              )}
              {published ? "Unpublish" : "Publish to Marketplace"}
            </Button>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/sprintnex/skills/${skill.id}/edit`)}
              >
                <Pencil className="size-3.5" /> Edit
              </Button>
            )}
          </div>
        </div>
        <SprintnexTabBar activeTab="skills" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-4">
        <Tabs defaultValue="detail" className="flex min-h-0 flex-1 flex-col">
          <TabsList>
            <TabsTrigger value="detail">Details</TabsTrigger>
            <TabsTrigger value="markdown">Markdown</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>
          <div className="min-h-0 flex-1 pt-2">
            <TabsContent value="detail" className="h-full overflow-y-auto">
              <div className="flex flex-col gap-4 rounded-lg border border-dls-border p-5">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {skill.status}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    v{skill.version}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {skill.extractionSource}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <span className="text-[11px] font-medium text-dls-secondary">
                      Domain
                    </span>
                    <p className="text-dls-text">{skill.domain || "-"}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-dls-secondary">
                      Role
                    </span>
                    <p className="text-dls-text">{skill.role || "-"}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-dls-secondary">
                      Confidence
                    </span>
                    <p className="text-dls-text">{skill.confidenceLevel}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-dls-secondary">
                      Experience
                    </span>
                    <p className="text-dls-text">{skill.yearsOfExperience}y</p>
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-medium text-dls-secondary">
                    Description
                  </span>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-dls-text">
                    {skill.description || "-"}
                  </p>
                </div>
                {skill.toolsFrameworks.length > 0 && (
                  <div>
                    <span className="text-[11px] font-medium text-dls-secondary">
                      Tools/Frameworks
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {skill.toolsFrameworks.map((t, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="text-[10px]"
                        >
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {skill.reusablePatterns.length > 0 && (
                  <div>
                    <span className="text-[11px] font-medium text-dls-secondary">
                      Reusable Patterns
                    </span>
                    <p className="mt-0.5 text-sm text-dls-text">
                      {skill.reusablePatterns.join("; ")}
                    </p>
                  </div>
                )}
                {skill.realProjectExamples.length > 0 && (
                  <div>
                    <span className="text-[11px] font-medium text-dls-secondary">
                      Project Examples
                    </span>
                    <p className="mt-0.5 text-sm text-dls-text">
                      {skill.realProjectExamples.join("; ")}
                    </p>
                  </div>
                )}
                {skill.commonMistakes.length > 0 && (
                  <div>
                    <span className="text-[11px] font-medium text-dls-secondary">
                      Common Mistakes
                    </span>
                    <p className="mt-0.5 text-sm text-dls-text">
                      {skill.commonMistakes.join("; ")}
                    </p>
                  </div>
                )}
                {skill.aiCoeUsage.length > 0 && (
                  <div>
                    <span className="text-[11px] font-medium text-dls-secondary">
                      AI COE Usage
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {skill.aiCoeUsage.map((u, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {u}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {skill.rejectionReason && (
                  <div>
                    <span className="text-[11px] font-medium text-red-500">
                      Rejection Reason
                    </span>
                    <p className="mt-0.5 text-sm text-red-500">
                      {skill.rejectionReason}
                    </p>
                  </div>
                )}
                {skill.reviewerNotes && (
                  <div>
                    <span className="text-[11px] font-medium text-dls-secondary">
                      Reviewer Notes
                    </span>
                    <p className="mt-0.5 text-sm text-dls-text">
                      {skill.reviewerNotes}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-dls-secondary">
                  <div>
                    Created: {new Date(skill.createdAt).toLocaleString()}
                  </div>
                  <div>
                    Updated: {new Date(skill.updatedAt).toLocaleString()}
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="markdown" className="h-full overflow-y-auto">
              <div className="knowledge-markdown rounded-lg border border-dls-border p-6">
                {skill.description ? (
                  <Markdown>{skill.description}</Markdown>
                ) : (
                  <p className="text-sm text-dls-secondary">
                    No markdown content.
                  </p>
                )}
              </div>
            </TabsContent>
            <TabsContent value="json" className="h-full overflow-y-auto">
              <pre className="whitespace-pre-wrap break-all rounded-lg bg-dls-surface p-4 text-xs text-dls-text">
                {JSON.stringify(
                  skill?.raw || {
                    noData: true,
                    note: "Skill not loaded or missing raw data",
                  },
                  null,
                  2,
                )}
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
        .knowledge-markdown strong { font-weight: 650; color: #f8fafc; }
        .knowledge-markdown em { font-style: italic; color: #94a3b8; }
        .knowledge-markdown a { color: #60a5fa; text-decoration: none; border-bottom: 1px solid rgba(96,165,250,0.3); }
        .knowledge-markdown code { background: #1e293b; color: #f472b6; padding: 2px 7px; border-radius: 5px; font-size: 0.88em; font-family: "SF Mono", "Fira Code", monospace; }
        .knowledge-markdown pre { background: #020617; color: #e2e8f0; padding: 18px 20px; border-radius: 10px; overflow-x: auto; margin: 14px 0; font-size: 0.85em; line-height: 1.65; border: 1px solid #1e293b; }
        .knowledge-markdown pre code { background: none; color: inherit; padding: 0; font-size: inherit; border-radius: 0; }
        .knowledge-markdown blockquote { border-left: 4px solid #3b82f6; margin: 14px 0; padding: 10px 18px; color: #94a3b8; background: #1e293b; border-radius: 0 8px 8px 0; font-style: italic; }
        .knowledge-markdown table { border-collapse: collapse; margin: 14px 0; width: 100%; border: 1px solid #1e293b; }
        .knowledge-markdown th { background: #1e293b; color: #f1f5f9; font-weight: 650; padding: 10px 14px; border: 1px solid #334155; }
        .knowledge-markdown td { padding: 9px 14px; border: 1px solid #1e293b; color: #e2e8f0; }
        .knowledge-markdown hr { border: none; border-top: 2px solid #1e293b; margin: 24px 0; }
      `}</style>
    </div>
  );
}
