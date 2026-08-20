/** @jsxImportSource react */
import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Brain,
  CheckCircle,
  Download,
  Plus,
  RotateCw,
  Search,
  Sparkles,
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
import { readSprintnexAicoeScope } from "@/app/lib/sprintnex-aicoe-api";
import { AICOE_BASE } from "@/app/lib/api-config";
import { t } from "@/i18n";
import { SprintnexTabBar } from "./sprintnex-tab-bar";

// ── Types ───────────────────────────────────────────────────────────────────
type MarketplaceSkill = {
  _id: string;
  id: string;
  name: string;
  category?: string;
  domain?: string;
  confidenceLevel?: string;
  status?: string;
  isPublished?: boolean;
  description?: string;
  toolsFrameworks?: string[];
  createdAt?: string;
  updatedAt?: string;
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

const N8N_MARKETPLACE_URL =
  "https://n8n.directintegrate.com/webhook/aicoe/skills/marketplace";
const N8N_MARKETPLACE_UPDATE_URL =
  "https://n8n.directintegrate.com/webhook/aicoe/skills/marketplace/update";

async function fetchMarketplaceSkills(): Promise<MarketplaceSkill[]> {
  try {
    const res = await fetch(N8N_MARKETPLACE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getApiHeaders() },
      body: JSON.stringify(getScope()),
    });
    if (res.ok) {
      const data = await res.json();
      const rawList = (data?.skills ?? data?.data ?? data ?? []) as Record<
        string,
        unknown
      >[];
      return Array.isArray(rawList)
        ? rawList.map((item) => ({
            _id: (item._id as string) || "",
            id: (item._id as string) || (item.id as string) || "",
            name:
              (item.skillName as string) ||
              (item.name as string) ||
              t("sprintnex.common.untitled"),
            category: (item.category as string) || "",
            domain: (item.domain as string) || "",
            confidenceLevel:
              (item.confidenceLevel as string) ||
              (item.skillConfidence as string) ||
              "",
            status: (item.status as string) || "published",
            isPublished: (item.isPublished as boolean) ?? false,
            description:
              (item.markdown as string) || (item.description as string) || "",
            toolsFrameworks: Array.isArray(item.tags)
              ? (item.tags as string[])
              : [],
            createdAt: (item.createdAt as string) || "",
            updatedAt: (item.updatedAt as string) || "",
          }))
        : [];
    }
  } catch {}
  return [];
}

async function activateSkill(skill: MarketplaceSkill): Promise<boolean> {
  const uid = getScope().userId;
  if (!uid) return false;
  const res = await fetch(`${AICOE_BASE}/users/${uid}/active-skills`, {
    method: "POST",
    headers: getApiHeaders(),
    body: JSON.stringify({
      skillId: skill._id,
      skillName: skill.name,
      skillCategory: skill.category,
      skillDomain: skill.domain,
      skillDescription: skill.description,
      skillToolsFrameworks: skill.toolsFrameworks ?? [],
    }),
  });
  return res.ok;
}

async function fetchActiveSkillIds(): Promise<Set<string>> {
  const uid = getScope().userId;
  if (!uid) return new Set();
  const res = await fetch(`${AICOE_BASE}/users/${uid}/active-skills`, {
    headers: getApiHeaders(),
  });
  if (!res.ok) return new Set();
  const data = await res.json();
  const items = (data?.data ?? []) as Array<{ skillId: string }>;
  return new Set(items.map((i) => i.skillId));
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function SprintnexMarketplacePage() {
  const navigate = useNavigate();
  const scope = readSprintnexAicoeScope();
  const [skills, setSkills] = useState<MarketplaceSkill[]>([]);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [allSkills, active] = await Promise.all([
      fetchMarketplaceSkills(),
      fetchActiveSkillIds(),
    ]);
    setSkills(allSkills);
    setActiveIds(active);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleActivate = async (skill: MarketplaceSkill) => {
    setActivatingId(skill._id);
    const ok = await activateSkill(skill);
    if (ok) setActiveIds((prev) => new Set(prev).add(skill._id));
    setActivatingId(null);
  };

  const filtered = searchQuery.trim()
    ? skills.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.category || "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          (s.domain || "").toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : skills;

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
                Skill Marketplace
              </h1>
              <p className="text-xs text-dls-secondary">
                {filtered.length} published skill
                {filtered.length !== 1 ? "s" : ""}
                {scope.projectName ? ` · ${scope.projectName}` : ""}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/sprintnex/skills/active")}
          >
            My Active Skills
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
            <Brain className="size-3.5" /> Profile
          </button>
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-dls-secondary transition-colors hover:text-dls-text"
            onClick={() => navigate("/sprintnex/skills")}
          >
            <Sparkles className="size-3.5" /> Extract
          </button>
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium bg-dls-bg text-dls-text shadow-sm transition-colors"
          >
            <Download className="size-3.5" /> Marketplace
          </button>
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-dls-secondary transition-colors hover:text-dls-text"
            onClick={() => navigate("/sprintnex/skills/active")}
          >
            <CheckCircle className="size-3.5" /> Active
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
              placeholder="Search marketplace..."
              className="h-7 w-[220px] pl-7 text-xs"
            />
          </div>
          <Button variant="ghost" size="sm" className="h-7" onClick={load}>
            <RotateCw className="size-3.5" /> {t("common.refresh")}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="rounded-lg border border-dls-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("sprintnex.common.name")}</TableHead>
                <TableHead className="w-32">
                  {t("sprintnex.common.category")}
                </TableHead>
                <TableHead className="w-28">
                  {t("sprintnex.common.confidence")}
                </TableHead>
                <TableHead className="w-24">
                  {t("sprintnex.common.status")}
                </TableHead>
                <TableHead className="w-24">
                  {t("sprintnex.form.action")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-12 text-center text-xs text-dls-secondary"
                  >
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-12 text-center text-xs text-dls-secondary"
                  >
                    No published skills found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => {
                  const isActive = activeIds.has(s._id);
                  return (
                    <TableRow
                      key={s._id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/sprintnex/skills/${s._id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isActive && (
                            <CheckCircle className="size-3.5 text-green-500" />
                          )}
                          <span className="text-sm font-medium text-dls-text">
                            {s.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-dls-secondary">
                        {s.category || "-"}
                      </TableCell>
                      <TableCell>
                        {s.confidenceLevel && (
                          <Badge variant="secondary" className="text-[10px]">
                            {s.confidenceLevel}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {s.status || "published"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div onClick={(e) => e.stopPropagation()}>
                          {isActive ? (
                            <Badge variant="default" className="text-[10px]">
                              Active
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleActivate(s)}
                              disabled={activatingId === s._id}
                            >
                              <Plus className="size-3" /> Activate
                            </Button>
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
