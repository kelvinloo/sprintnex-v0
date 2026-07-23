/** @jsxImportSource react */
import { useState, useEffect } from "react";
import { ArrowLeft, Brain, Save } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AICOE_BASE } from "@/app/lib/api-config";
import { SprintnexTabBar } from "./sprintnex-tab-bar";

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
const CONFIDENCE_LEVELS = ["beginner", "intermediate", "advanced", "expert"];

function getApiHeaders() {
  const token =
    localStorage.getItem("auth_token") ||
    localStorage.getItem("accessToken") ||
    "";
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export function SprintnexSkillEditPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!id) return;
    fetch(`${AICOE_BASE}/skills`, { headers: getApiHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list = data?.data ?? data?.skills ?? data ?? [];
        const found = Array.isArray(list)
          ? list.find((i: Record<string, unknown>) => (i.id as string) === id)
          : null;
        if (found) setForm({ ...found });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const res = await fetch(`${AICOE_BASE}/skills/${id}`, {
        method: "PUT",
        headers: getApiHeaders(),
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          domain: form.domain,
          role: form.role,
          confidenceLevel: form.confidenceLevel,
          yearsOfExperience: form.yearsOfExperience,
          description: form.description,
          toolsFrameworks: form.toolsFrameworks,
          reusablePatterns: form.reusablePatterns,
          realProjectExamples: form.realProjectExamples,
          commonMistakes: form.commonMistakes,
          aiCoeUsage: form.aiCoeUsage,
        }),
      });
      if (res.ok) navigate(`/sprintnex/skills/${id}`);
    } catch {
    } finally {
      setSaving(false);
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

  return (
    <div className="flex h-full min-h-0 flex-col bg-dls-bg">
      <div className="shrink-0 border-b border-dls-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7 shrink-0"
              onClick={() => navigate(`/sprintnex/skills/${id}`)}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#111827] text-white">
              <Brain size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold text-dls-text">
                Edit: {(form.name as string) || ""}
              </h1>
            </div>
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="size-3.5" /> Save
          </Button>
        </div>
        <SprintnexTabBar activeTab="skills" />
      </div>

      <div className="flex min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <div className="flex w-full max-w-2xl flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-dls-secondary">
              Name
            </label>
            <Input
              value={(form.name as string) || ""}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 h-8 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-dls-secondary">
                Category
              </label>
              <Select
                value={(form.category as string) || ""}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-dls-secondary">
                Domain
              </label>
              <Input
                value={(form.domain as string) || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, domain: e.target.value }))
                }
                className="mt-1 h-8 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-dls-secondary">
                Role
              </label>
              <Input
                value={(form.role as string) || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, role: e.target.value }))
                }
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-dls-secondary">
                Confidence
              </label>
              <Select
                value={(form.confidenceLevel as string) || ""}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, confidenceLevel: v }))
                }
              >
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONFIDENCE_LEVELS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-dls-secondary">
                Years of Experience
              </label>
              <Input
                type="number"
                value={(form.yearsOfExperience as number) || 0}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    yearsOfExperience: parseInt(e.target.value) || 0,
                  }))
                }
                className="mt-1 h-8 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-dls-secondary">
              Description
            </label>
            <Textarea
              value={(form.description as string) || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              className="mt-1 min-h-[120px] text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
