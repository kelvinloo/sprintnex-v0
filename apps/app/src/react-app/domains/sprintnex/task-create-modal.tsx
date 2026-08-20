/** @jsxImportSource react */
import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/i18n";
import type { WorkspaceInfo } from "@/app/lib/desktop";
import { workspaceLabel } from "@/react-app/shell/route-workspaces";
import type {
  SprintnexTaskCreateInput,
  SprintnexTaskExecutionMode,
  SprintnexTaskPriority,
} from "./task-store";

const priorityItems: { value: SprintnexTaskPriority; label: string }[] = [
  { value: "medium", label: t("sprintnex.priority.medium") },
  { value: "high", label: t("sprintnex.priority.high") },
  { value: "urgent", label: t("sprintnex.priority.urgent") },
  { value: "low", label: t("sprintnex.priority.low") },
];

const executionModeItems: { value: SprintnexTaskExecutionMode; label: string }[] = [
  { value: "guided", label: t("sprintnex.execution.guided") },
  { value: "autonomous", label: t("sprintnex.execution.autonomous") },
];

type SprintnexTaskCreateModalProps = {
  open: boolean;
  workspace: WorkspaceInfo | null;
  initialPrompt?: string;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (input: SprintnexTaskCreateInput) => void;
};

function initialTitle(prompt: string | undefined) {
  const firstLine = prompt?.trim().split(/\r?\n/).find(Boolean)?.trim() ?? "";
  if (!firstLine) return "";
  return firstLine.length > 90 ? `${firstLine.slice(0, 87)}...` : firstLine;
}

export function SprintnexTaskCreateModal(props: SprintnexTaskCreateModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<SprintnexTaskPriority>("medium");
  const [executionMode, setExecutionMode] = useState<SprintnexTaskExecutionMode>("guided");
  const [skills, setSkills] = useState("");
  const [mcpRules, setMcpRules] = useState("");

  useEffect(() => {
    if (!props.open) return;
    setTitle(initialTitle(props.initialPrompt));
    setDescription(props.initialPrompt?.trim() ?? "");
    setPriority("medium");
    setExecutionMode("guided");
    setSkills("");
    setMcpRules("");
  }, [props.initialPrompt, props.open]);

  const projectName = useMemo(
    () =>
      props.workspace
        ? workspaceLabel(props.workspace)
        : t("sprintnex.task.no_project_selected"),
    [props.workspace],
  );
  const canSubmit = Boolean(props.workspace && title.trim() && !props.submitting);

  const submit = () => {
    if (!canSubmit) return;
    props.onSubmit({
      title,
      description,
      priority,
      executionMode,
      skills,
      mcpRules,
    });
  };

  return (
    <Dialog open={props.open} onOpenChange={(open) => {
      if (!open && !props.submitting) props.onClose();
    }}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto rounded-2xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="size-4" />
            {t("sprintnex.task.create_title")}
          </DialogTitle>
          <DialogDescription>
            {projectName}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="sprintnex-task-title">
              {t("sprintnex.task.title")}
            </Label>
            <Input
              id="sprintnex-task-title"
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
              placeholder={t("sprintnex.task.title_placeholder")}
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sprintnex-task-description">
              {t("sprintnex.task.description")}
            </Label>
            <Textarea
              id="sprintnex-task-description"
              value={description}
              onChange={(event) => setDescription(event.currentTarget.value)}
              placeholder={t("sprintnex.task.description_placeholder")}
              className="min-h-28"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>{t("sprintnex.task.priority")}</Label>
              <Select
                value={priority}
                items={priorityItems}
                onValueChange={(value) => setPriority(value as SprintnexTaskPriority)}
              >
                <SelectTrigger className="w-full rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectGroup>
                    <SelectLabel>{t("sprintnex.task.priority")}</SelectLabel>
                    {priorityItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>{t("sprintnex.task.execution_mode")}</Label>
              <Select
                value={executionMode}
                items={executionModeItems}
                onValueChange={(value) => setExecutionMode(value as SprintnexTaskExecutionMode)}
              >
                <SelectTrigger className="w-full rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectGroup>
                    <SelectLabel>
                      {t("sprintnex.task.execution_mode")}
                    </SelectLabel>
                    {executionModeItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sprintnex-task-skills">
              {t("sprintnex.task.skills")}
            </Label>
            <Textarea
              id="sprintnex-task-skills"
              value={skills}
              onChange={(event) => setSkills(event.currentTarget.value)}
              placeholder={t("sprintnex.task.skills_placeholder")}
              className="min-h-20"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sprintnex-task-mcp-rules">
              {t("sprintnex.task.mcp_rules")}
            </Label>
            <Textarea
              id="sprintnex-task-mcp-rules"
              value={mcpRules}
              onChange={(event) => setMcpRules(event.currentTarget.value)}
              placeholder={t("sprintnex.task.mcp_rules_placeholder")}
              className="min-h-20"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={props.onClose} disabled={props.submitting}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {props.submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("sprintnex.action.create_task")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
