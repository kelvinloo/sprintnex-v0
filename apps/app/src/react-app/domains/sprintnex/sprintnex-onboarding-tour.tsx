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

const STORAGE_KEY = "sprintnex.onboardingTourShown.v1";

const STEPS = [
  {
    icon: Workflow,
    title: "Welcome to Sprintnex",
    description:
      "Sprintnex connects project management with AI agent workspaces for automated task delivery. This tour will walk you through the key features.",
  },
  {
    icon: Settings,
    title: "1. Configure Mappings",
    description:
      "Go to **Sprintnex settings** in the sidebar footer. Under the **Mappings** tab, select a team and map each Sprintnex project to an OpenWork workspace. This tells the system which workspace to use for each project.",
    action: "Navigate: Sidebar footer → Sprintnex settings → Mappings tab",
  },
  {
    icon: KeyRound,
    title: "2. Connect AI Providers",
    description:
      "In **Sprintnex settings → Providers** tab, check that your AI provider (e.g., DeepSeek, Anthropic) is connected. Click **Manage providers** to open the AI settings page if needed.",
    action: "Navigate: Sprintnex settings → Providers tab → Manage providers",
  },
  {
    icon: Layout,
    title: "3. Sidebar Overview",
    description:
      "The left sidebar shows the **Sprintnex project selector** at the top. Choose a team and project to scope your work. The workspace list below shows only the mapped workspace for the selected project.",
    action: "Sidebar header → Select team + project",
  },
  {
    icon: MessageSquare,
    title: "4. Task Intake (Chat)",
    description:
      "Open **Sprintnex tasks** from the sidebar footer. The **Intake** tab lets you describe what you want to build. The system classifies your request — small changes are handled directly, while large requests are routed through the Sprintnex delivery flow.",
    action: "Sidebar footer → Sprintnex tasks → Intake tab",
  },
  {
    icon: ListChecks,
    title: "5. Task Execution",
    description:
      "Approved tasks appear in the **Tasks** tab. Click **Start Execution** to create an OpenCode session in the mapped workspace. The agent executes the task with the Delivery Agent prompt. You can chat with the agent in the session.",
    action: "Sprintnex tasks → Tasks tab → Start Execution",
  },
  {
    icon: PlayCircle,
    title: "6. Chat with the Agent",
    description:
      "In the session chat, the **Workspace Agent** handles questions, code inspection, and small changes. Large feature requests are blocked and routed to the Sprintnex intake flow. Select your model (e.g., DeepSeek V4 Flash) from the model picker.",
    action: "Session chat → Type your request",
  },
  {
    icon: CheckCircle2,
    title: "You're all set!",
    description:
      "You can now manage Sprintnex projects, execute tasks, and collaborate with AI agents. Re-open this guide anytime from the **Help** button in the Sprintnex tasks page.",
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
            {step.title}
          </DialogTitle>

          {/* Description */}
          <div className="mb-4 space-y-3 text-sm leading-relaxed text-dls-secondary">
            {step.description.split("\n").map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>

          {/* Action hint */}
          {step.action && (
            <div className="rounded-lg border border-dls-border bg-dls-surface px-3 py-2 text-xs text-dls-tertiary">
              <span className="font-medium text-dls-secondary">Tip: </span>
              {step.action}
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
