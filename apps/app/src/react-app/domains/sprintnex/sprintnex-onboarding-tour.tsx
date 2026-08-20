/** @jsxImportSource react */
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Layout,
  ListChecks,
  MessageSquare,
  PlayCircle,
  Settings,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { t } from "@/i18n";

const STORAGE_KEY = "sprintnex.onboardingTourShown.v1";

type TourStep = {
  icon: LucideIcon;
  titleKey: string;
  descriptionKey: string;
  actionKey?: string;
};

const STEPS: TourStep[] = [
  {
    icon: Workflow,
    titleKey: "sprintnex.onboarding.step_welcome_title",
    descriptionKey: "sprintnex.onboarding.step_welcome_description",
  },
  {
    icon: Settings,
    titleKey: "sprintnex.onboarding.step_mappings_title",
    descriptionKey: "sprintnex.onboarding.step_mappings_description",
    actionKey: "sprintnex.onboarding.step_mappings_action",
  },
  {
    icon: KeyRound,
    titleKey: "sprintnex.onboarding.step_providers_title",
    descriptionKey: "sprintnex.onboarding.step_providers_description",
    actionKey: "sprintnex.onboarding.step_providers_action",
  },
  {
    icon: Layout,
    titleKey: "sprintnex.onboarding.step_sidebar_title",
    descriptionKey: "sprintnex.onboarding.step_sidebar_description",
    actionKey: "sprintnex.onboarding.step_sidebar_action",
  },
  {
    icon: MessageSquare,
    titleKey: "sprintnex.onboarding.step_intake_title",
    descriptionKey: "sprintnex.onboarding.step_intake_description",
    actionKey: "sprintnex.onboarding.step_intake_action",
  },
  {
    icon: ListChecks,
    titleKey: "sprintnex.onboarding.step_execution_title",
    descriptionKey: "sprintnex.onboarding.step_execution_description",
    actionKey: "sprintnex.onboarding.step_execution_action",
  },
  {
    icon: PlayCircle,
    titleKey: "sprintnex.onboarding.step_chat_title",
    descriptionKey: "sprintnex.onboarding.step_chat_description",
    actionKey: "sprintnex.onboarding.step_chat_action",
  },
  {
    icon: CheckCircle2,
    titleKey: "sprintnex.onboarding.step_done_title",
    descriptionKey: "sprintnex.onboarding.step_done_description",
  },
];

type SprintnexOnboardingTourProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SprintnexOnboardingTour({
  open,
  onOpenChange,
}: SprintnexOnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const isFirst = stepIndex === 0;
  const Icon = step.icon;

  const handleNext = useCallback(() => {
    if (isLast) {
      onOpenChange(false);
    } else {
      setStepIndex((i) => i + 1);
    }
  }, [isLast, onOpenChange]);

  const handlePrev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  // Reset to first step when dialog opens
  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg rounded-2xl p-0 sm:max-w-lg"
        style={{ paddingBottom: 0, margin: 16 }}
      >
        <div className="px-6 pb-6 pt-8">
          {/* Step indicator */}
          <div className="mb-4 flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= stepIndex ? "bg-dls-text" : "bg-dls-border"
                }`}
              />
            ))}
          </div>

          {/* Icon */}
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-[#111827] text-white">
            <Icon className="size-6" />
          </div>

          {/* Title */}
          <DialogTitle className="mb-2 text-lg font-semibold text-dls-text">
            {t(step.titleKey)}
          </DialogTitle>

          {/* Description */}
          <div className="mb-4 space-y-3 text-sm leading-relaxed text-dls-secondary">
            {t(step.descriptionKey).split("\n").map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>

          {/* Action hint */}
          {step.actionKey && (
            <div className="rounded-lg border border-dls-border bg-dls-surface px-3 py-2 text-xs text-dls-tertiary">
              <span className="font-medium text-dls-secondary">
                {t("sprintnex.onboarding.tip")}{" "}
              </span>
              {t(step.actionKey)}
            </div>
          )}
        </div>

        <DialogFooter
          className="flex items-center justify-between border-t border-dls-border px-6 py-4"
          style={{ paddingBottom: 24, marginBottom: 16, marginRight: 16 }}
        >
          <div className="text-xs text-dls-tertiary">
            {stepIndex + 1} / {STEPS.length}
          </div>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="outline" size="sm" onClick={handlePrev}>
                Back
              </Button>
            )}
            <Button variant="default" size="sm" onClick={handleNext}>
              {isLast ? "Get started" : "Next"}
              {!isLast && <ArrowRight className="ml-1.5 size-3.5" />}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Check if the onboarding tour has been shown before. */
export function hasOnboardingTourBeenShown(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return true;
  }
}

/** Mark the onboarding tour as completed. */
export function markOnboardingTourShown(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    /* not critical */
  }
}

/** Reset the onboarding tour so it shows again. */
export function resetOnboardingTour(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* not critical */
  }
}
