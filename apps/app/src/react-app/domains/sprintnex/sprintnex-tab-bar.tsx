/** @jsxImportSource react */
import {
  Brain,
  FileText,
  ListChecks,
  MessageSquare,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { t } from "@/i18n";

export type TabDefinition = {
  id: string;
  label: string;
  icon: LucideIcon;
  route?: string;
  onClick?: () => void;
  count?: number;
};

type TabId = "intake" | "tasks" | "knowledge" | "skills";

type Props = {
  activeTab: TabId | string;
  taskCount?: number;
  /** If provided, clicking Intake calls this instead of navigating. Used on the tasks page where Intake/Tasks share the same route. */
  onIntakeClick?: () => void;
  /** If provided, clicking Tasks calls this instead of navigating. Used on the tasks page where Intake/Tasks share the same route. */
  onTasksClick?: () => void;
  /** Custom tabs override — if provided, these are rendered instead of the defaults. */
  customTabs?: TabDefinition[];
};

export function SprintnexTabBar({
  activeTab,
  taskCount,
  onIntakeClick,
  onTasksClick,
  customTabs,
}: Props) {
  const navigate = useNavigate();

  const defaultTabs: TabDefinition[] = [
    {
      id: "tasks",
      label: t("sprintnex.tabs.tasks"),
      icon: ListChecks,
      onClick: onTasksClick,
      route: "/sprintnex/tasks",
    },
    {
      id: "knowledge",
      label: t("sprintnex.tabs.knowledge"),
      icon: FileText,
      route: "/sprintnex/knowledge",
    },
    {
      id: "skills",
      label: t("sprintnex.tabs.skills"),
      icon: Brain,
      route: "/sprintnex/skills",
    },
  ];

  const tabs = customTabs ?? defaultTabs;

  return (
    <div className="mt-3 inline-flex rounded-lg border border-dls-border bg-dls-surface p-0.5">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={`inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors ${
              isActive
                ? "bg-dls-bg text-dls-text shadow-sm"
                : "text-dls-secondary hover:text-dls-text"
            }`}
            onClick={() => {
              if (tab.onClick) tab.onClick();
              else if (tab.route) navigate(tab.route);
            }}
          >
            <Icon className="size-3.5" />
            {tab.label}
            {tab.count !== undefined && (
              <span className="inline-flex h-3.5 items-center rounded border border-dls-border px-1 text-[9px] font-medium text-dls-secondary">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
