/** @jsxImportSource react */
import { useState, useEffect } from "react";
import { ArrowLeft, Briefcase, DollarSign, Info, Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/i18n";
import { AICOE_BASE } from "@/app/lib/api-config";
import { readSprintnexAicoeScope } from "@/app/lib/sprintnex-aicoe-api";

// ── Types ───────────────────────────────────────────────────────────────────

type TierInfo = {
  tier: string;
  label: string;
  minimumBudget: number;
  minimumRating: number;
  description: string;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

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

async function fetchTiers(): Promise<TierInfo[]> {
  try {
    const res = await fetch(`${AICOE_BASE}/marketplace/tiers`, {
      headers: getApiHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      const raw = data?.data ?? data ?? [];
      return Array.isArray(raw) ? raw : [];
    }
  } catch {}
  return [];
}

const TIER_LABELS: Record<string, string> = {
  S: "S — Strategic / Enterprise",
  A: "A — High Value",
  B: "B — Standard",
  C: "C — Quick Win",
};

const PRIORITY_OPTIONS = [
  { value: "LOW", label: t("sprintnex.priority.low") },
  { value: "MEDIUM", label: t("sprintnex.priority.medium") },
  { value: "HIGH", label: t("sprintnex.priority.high") },
  { value: "CRITICAL", label: t("sprintnex.priority.critical") },
];

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function SprintnexJobPostPage() {
  const navigate = useNavigate();
  const scope = readSprintnexAicoeScope();
  const uid = getUserId();

  const [tiers, setTiers] = useState<TierInfo[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [estimatedCompletionDays, setEstimatedCompletionDays] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetCurrency, setBudgetCurrency] = useState("USD");
  const [tier, setTier] = useState("");
  const [paymentDisclaimerAccepted, setPaymentDisclaimerAccepted] =
    useState(false);

  useEffect(() => {
    fetchTiers().then(setTiers);
  }, []);

  const selectedTierInfo = tiers.find((t) => t.tier === tier);

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !requiredSkills.includes(s)) {
      setRequiredSkills((prev) => [...prev, s]);
    }
    setSkillInput("");
  };

  const removeSkill = (skill: string) => {
    setRequiredSkills((prev) => prev.filter((s) => s !== skill));
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSkill();
    }
  };

  const handleSubmit = async () => {
    if (!uid) {
      setError(t("sprintnex.job.error.login_required"));
      return;
    }
    if (!title.trim()) {
      setError(t("sprintnex.form.title_required"));
      return;
    }
    if (!tier) {
      setError(t("sprintnex.form.select_tier"));
      return;
    }
    if (!paymentDisclaimerAccepted) {
      setError(t("sprintnex.job.error.accept_payment_disclaimer"));
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`${AICOE_BASE}/marketplace`, {
        method: "POST",
        headers: getApiHeaders(),
        body: JSON.stringify({
          userId: uid,
          title: title.trim(),
          description: description.trim(),
          priority,
          requiredSkills,
          estimatedHours: estimatedHours ? Number(estimatedHours) : 0,
          estimatedCompletionDays: estimatedCompletionDays
            ? Number(estimatedCompletionDays)
            : 0,
          budgetAmount: budgetAmount ? Number(budgetAmount) : 0,
          budgetCurrency,
          tier,
          posterName:
            scope.userId ||
            localStorage.getItem("userName") ||
            t("sprintnex.common.anonymous"),
          paymentDisclaimer: paymentDisclaimerAccepted,
        }),
      });

      if (res.ok) {
        navigate("/sprintnex/jobs");
      } else {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? t("sprintnex.job.error.failed_post"));
      }
    } catch {
      setError(t("sprintnex.job.error.network_retry"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-dls-bg">
      {/* Header */}
      <div className="shrink-0 border-b border-dls-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#111827] text-white">
              <Briefcase size={16} />
            </div>
            <div>
              <h1 className="text-base font-semibold text-dls-text">
                {t("sprintnex.job.post_a_job")}
              </h1>
              <p className="text-xs text-dls-secondary">
                {t("sprintnex.job.post_description")}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/session")}
          >
            <ArrowLeft className="size-4" />
            {t("common.back")}
          </Button>
        </div>
        {/* Sub-nav: Pool / My Jobs / Post */}
        <div className="mt-2 inline-flex rounded-lg border border-dls-border bg-dls-surface p-0.5">
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-dls-secondary transition-colors hover:text-dls-text"
            onClick={() => navigate("/sprintnex/jobs")}
          >
            <Briefcase className="size-3.5" />
            {t("sprintnex.job.pool")}
          </button>
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-dls-secondary transition-colors hover:text-dls-text"
            onClick={() => navigate("/sprintnex/jobs/mine")}
          >
            {t("sprintnex.job.my_jobs")}
          </button>
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-dls-bg px-3 text-xs font-medium text-dls-text shadow-sm"
          >
            {t("sprintnex.job.post_a_job")}
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="mx-auto max-w-2xl space-y-6">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              <Info className="size-3.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-dls-text">
              {t("sprintnex.job.field.title_required")}
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("sprintnex.job.placeholder.title")}
              className="h-8 text-sm"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-dls-text">
              {t("sprintnex.job.field.description")}
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("sprintnex.job.placeholder.description")}
              rows={5}
            />
          </div>

          {/* Priority + Tier row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-dls-text">
                {t("sprintnex.task.priority")}
              </Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v ?? "MEDIUM")}
              >
                <SelectTrigger className="h-8 w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-dls-text">
                {t("sprintnex.job.field.tier_required")}
              </Label>
              <Select value={tier} onValueChange={(v) => setTier(v ?? "")}>
                <SelectTrigger className="h-8 w-full text-xs">
                  <SelectValue placeholder={t("sprintnex.job.placeholder.select_tier")} />
                </SelectTrigger>
                <SelectContent>
                  {tiers.map((t) => (
                    <SelectItem key={t.tier} value={t.tier}>
                      {TIER_LABELS[t.tier] ?? t.tier}
                    </SelectItem>
                  ))}
                  {tiers.length === 0 &&
                    ["S", "A", "B", "C"].map((t) => (
                      <SelectItem key={t} value={t}>
                        {TIER_LABELS[t] ?? t}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tier info */}
          {selectedTierInfo && (
            <Card variant="outline" size="sm">
              <CardContent className="space-y-1 px-4 py-3">
                <p className="text-xs text-dls-secondary">
                  {selectedTierInfo.description}
                </p>
                <div className="flex gap-4 text-xs">
                  <span className="text-dls-secondary">
                    {t("sprintnex.job.min_budget")}{" "}
                    <strong className="text-dls-text">
                      ${selectedTierInfo.minimumBudget.toLocaleString()}
                    </strong>
                  </span>
                  <span className="text-dls-secondary">
                    {t("sprintnex.job.min_rating")}{" "}
                    <strong className="text-dls-text">
                      {selectedTierInfo.minimumRating.toFixed(1)}
                    </strong>
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Required Skills */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-dls-text">
              {t("sprintnex.job.field.required_skills")}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleSkillKeyDown}
                placeholder={t("sprintnex.job.placeholder.required_skill")}
                className="h-8 flex-1 text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={addSkill}
                type="button"
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
            {requiredSkills.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {requiredSkills.map((skill) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="flex items-center gap-1 pr-1 text-[10px]"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                    >
                      <X className="size-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Hours + Days row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-dls-text">
                {t("sprintnex.job.field.estimated_hours")}
              </Label>
              <Input
                type="number"
                min={0}
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder={t("sprintnex.job.placeholder.hours")}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-dls-text">
                {t("sprintnex.job.field.estimated_completion_days")}
              </Label>
              <Input
                type="number"
                min={0}
                value={estimatedCompletionDays}
                onChange={(e) => setEstimatedCompletionDays(e.target.value)}
                placeholder={t("sprintnex.job.placeholder.completion_days")}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Budget row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-dls-text">
                {t("sprintnex.job.field.budget_amount")}
              </Label>
              <Input
                type="number"
                min={0}
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                placeholder={t("sprintnex.job.placeholder.budget")}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-dls-text">
                {t("sprintnex.job.field.currency")}
              </Label>
              <Select
                value={budgetCurrency}
                onValueChange={(v) => setBudgetCurrency(v ?? "USD")}
              >
                <SelectTrigger className="h-8 w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="CAD">CAD</SelectItem>
                  <SelectItem value="AUD">AUD</SelectItem>
                  <SelectItem value="SGD">SGD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Payment Disclaimer */}
          <div className="flex items-start gap-2 rounded-lg border border-dls-border p-3">
            <Checkbox
              checked={paymentDisclaimerAccepted}
              onCheckedChange={(checked: boolean) =>
                setPaymentDisclaimerAccepted(checked)
              }
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <Label className="text-xs font-medium text-dls-text cursor-pointer">
                {t("sprintnex.job.field.payment_disclaimer")}
              </Label>
              <p className="text-xs text-dls-secondary leading-relaxed">
                {t("sprintnex.job.payment_disclaimer_body")}
              </p>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-2 pb-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/sprintnex/jobs")}
            >
              {t("common.cancel")}
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? t("sprintnex.job.posting") : t("sprintnex.job.post_job")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
