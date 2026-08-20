/** @jsxImportSource react */
import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Brain,
  CheckCircle,
  Download,
  RefreshCw,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { pluralSuffix, t } from "@/i18n";
import { AICOE_BASE } from "@/app/lib/api-config";
import { readSprintnexAicoeScope } from "@/app/lib/sprintnex-aicoe-api";
import { SprintnexTabBar } from "./sprintnex-tab-bar";

type ActiveSkill = {
  id: string;
  userId: string;
  skillId: string;
  skillName: string;
  skillCategory: string | null;
  skillDomain: string | null;
  skillConfidence: string | null;
  skillDescription: string | null;
  skillToolsFrameworks: string[];
  skillReusablePatterns: string[];
  skillRealProjectExamples: string[];
  skillCommonMistakes: string[];
  skillAiCoeUsage: string[];
  snapshotVersion: number;
  updatedAt: string;
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

function getUserId(): string {
  return localStorage.getItem("userId") || "";
}

export function SprintnexActiveSkillsPage() {
  const navigate = useNavigate();
  const scope = readSprintnexAicoeScope();
  const [skills, setSkills] = useState<ActiveSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchActive = useCallback(async () => {
    const uid = getUserId();
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${AICOE_BASE}/users/${uid}/active-skills`, {
        headers: getApiHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setSkills(data?.data ?? []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActive();
  }, [fetchActive]);

  const handleDeactivate = async (skillId: string) => {
    const uid = getUserId();
    if (!uid) return;
    setRemovingId(skillId);
    try {
      await fetch(`${AICOE_BASE}/users/${uid}/active-skills/${skillId}`, {
        method: "DELETE",
        headers: getApiHeaders(),
      });
      setSkills((prev) => prev.filter((s) => s.skillId !== skillId));
    } catch {
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-dls-bg">
      <div className="shrink-0 border-b border-dls-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#111827] text-white">
              <Brain size={16} />
            </div>
            <div>
              <h1 className="text-base font-semibold text-dls-text">
                {t("sprintnex.skill.active_title")}
              </h1>
              <p className="text-xs text-dls-secondary">
                {t("sprintnex.skill.active_count", {
                  count: skills.length,
                  suffix: pluralSuffix("en", skills.length),
                })}
                {scope.projectName ? ` · ${scope.projectName}` : ""}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/sprintnex/skills/marketplace")}
          >
            {t("sprintnex.skill.browse_marketplace")}
          </Button>
        </div>
        <SprintnexTabBar activeTab="skills" />
      </div>

      {/* Internal sub-tabs */}
      <div className="shrink-0 border-b border-dls-border px-6 py-2">
        <div className="inline-flex rounded-lg border border-dls-border bg-dls-surface p-0.5">
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-dls-secondary transition-colors hover:text-dls-text"
            onClick={() => navigate("/sprintnex/skills")}
          >
            <Brain className="size-3.5" /> {t("sprintnex.skill.profile")}
          </button>
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-dls-secondary transition-colors hover:text-dls-text"
            onClick={() => navigate("/sprintnex/skills")}
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
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium bg-dls-bg text-dls-text shadow-sm transition-colors"
          >
            <CheckCircle className="size-3.5" /> {t("sprintnex.skill.active")}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <p className="py-12 text-center text-sm text-dls-secondary">
            {t("sprintnex.task.loading")}
          </p>
        ) : skills.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Brain className="size-10 text-dls-secondary" />
            <p className="text-sm text-dls-secondary">
              {t("sprintnex.skill.no_active")}
            </p>
            <p className="text-xs text-dls-secondary">
              {t("sprintnex.skill.browse_marketplace_hint")}
            </p>
            <Button
              size="sm"
              onClick={() => navigate("/sprintnex/skills/marketplace")}
            >
              {t("sprintnex.skill.browse_marketplace")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {skills.map((s) => (
              <div
                key={s.id}
                className="flex items-start gap-3 rounded-lg border border-dls-border bg-dls-surface p-4"
              >
                <CheckCircle className="mt-0.5 size-4 shrink-0 text-green-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-dls-text">
                      {s.skillName}
                    </h3>
                    {s.skillConfidence && (
                      <Badge variant="secondary" className="text-[10px]">
                        {s.skillConfidence}
                      </Badge>
                    )}
                    {s.skillCategory && (
                      <Badge variant="outline" className="text-[10px]">
                        {s.skillCategory}
                      </Badge>
                    )}
                  </div>
                  {s.skillDescription && (
                    <p className="mt-1 line-clamp-2 text-xs text-dls-secondary">
                      {s.skillDescription}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-[10px] text-dls-secondary">
                    <span>v{s.snapshotVersion}</span>
                    <span>
                      {t("sprintnex.skill.updated", {
                        date: s.updatedAt
                          ? new Date(s.updatedAt).toLocaleDateString()
                          : "-",
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 text-red-500 hover:text-red-600"
                    title={t("sprintnex.skill.title_deactivate")}
                    onClick={() => handleDeactivate(s.skillId)}
                    disabled={removingId === s.skillId}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
