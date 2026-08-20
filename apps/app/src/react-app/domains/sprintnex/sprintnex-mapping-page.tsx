/** @jsxImportSource react */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyRound, Link as LinkIcon, Unlink, Workflow } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getMappedWorkspaceForSprintnexProject,
  getSprintnexTeamSpaces,
  getSprintnexWorkspaces,
  mapSprintnexProjectToWorkspace,
  readSprintnexAicoeScope,
  type SprintnexTeamSpaceNode,
  type SprintnexTenantWorkspaceNode,
} from "@/app/lib/sprintnex-aicoe-api";
import { readActiveWorkspaceId } from "@/react-app/shell/session-memory";
import { resolveOpenworkConnection } from "@/react-app/shell/openwork-connection";
import { createOpenworkServerClient } from "@/app/lib/openwork-server";

type WorkspaceRef = {
  id: string;
  name: string;
  displayName?: string;
};

type ProjectRow = {
  project: SprintnexTenantWorkspaceNode;
  team: SprintnexTeamSpaceNode | null;
  mappedWorkspaceId: string;
};

export function SprintnexMappingPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"mappings">("mappings");
  const [teams, setTeams] = useState<SprintnexTeamSpaceNode[]>([]);
  const [projects, setProjects] = useState<SprintnexTenantWorkspaceNode[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceRef[]>(() => {
    // Read workspace IDs that appear in any existing mapping.
    const ids = new Set<string>();
    const activeId = readActiveWorkspaceId();
    if (activeId) ids.add(activeId);
    return Array.from(ids).map((id) => ({ id, name: id }));
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [teamData, projectData] = await Promise.all([
        getSprintnexTeamSpaces(),
        getSprintnexWorkspaces(),
      ]);
      setTeams(teamData);
      setProjects(projectData);
      // Fetch all OpenWork workspaces with names from the server.
      const owWorkspaces: WorkspaceRef[] = [];
      try {
        const { normalizedBaseUrl, resolvedToken } =
          await resolveOpenworkConnection();
        if (normalizedBaseUrl && resolvedToken) {
          const serverClient = createOpenworkServerClient({
            baseUrl: normalizedBaseUrl,
            token: resolvedToken,
          });
          const wsList = await serverClient.listWorkspaces();
          for (const ws of wsList.items) {
            owWorkspaces.push({
              id: ws.id,
              name: ws.name || ws.id,
              displayName: ws.displayName || ws.name || ws.id,
            });
          }
        }
      } catch {
        // Non-critical; fall back to mapped IDs only.
      }
      setWorkspaces(owWorkspaces);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("sprintnex.common.failed_to_load_data"),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const currentScope = readSprintnexAicoeScope();

  const rows: ProjectRow[] = useMemo(() => {
    const activeWorkspaceId = readActiveWorkspaceId() || "";
    return projects.map((project) => {
      const team = teams.find((t) => t.id === project.teamSpaceId) ?? null;
      const mappedId = getMappedWorkspaceForSprintnexProject(project.id);
      return {
        project,
        team,
        mappedWorkspaceId:
          mappedId ||
          (project.id === currentScope.projectId ? activeWorkspaceId : ""),
      };
    });
  }, [currentScope.projectId, projects, teams]);

  const grouped = useMemo(() => {
    const map = new Map<string, ProjectRow[]>();
    for (const row of rows) {
      const teamId = row.team?.id || row.project.teamSpaceId || "_ungrouped";
      const teamName = row.team?.name || t("sprintnex.common.unknown_team");
      const existing = map.get(teamId) ?? [];
      existing.push(row);
      map.set(teamId, existing);
    }
    return Array.from(map.entries()).map(([teamId, teamRows]) => ({
      teamId,
      teamName:
        teams.find((t) => t.id === teamId)?.name ||
        t("sprintnex.common.unknown_team"),
      rows: teamRows,
    }));
  }, [rows, teams]);

  const handleMap = useCallback(
    (projectId: string, workspaceId: string) => {
      mapSprintnexProjectToWorkspace(projectId, workspaceId);
      // Force re-render by updating a state tick
      setError(null);
      loadData();
    },
    [loadData],
  );

  const handleUnmap = useCallback(
    (projectId: string) => {
      mapSprintnexProjectToWorkspace(projectId, "");
      loadData();
    },
    [loadData],
  );

  // Show all OpenWork workspaces. Already-mapped ones are disabled in the UI.
  const workspaceOptions = useMemo(() => {
    // Collect IDs already mapped to any project.
    const mappedIds = new Set(
      rows.map((r) => r.mappedWorkspaceId).filter(Boolean),
    );
    return workspaces.filter((ws) => ws.id.trim());
  }, [rows, workspaces]);

  const goToSession = useCallback(() => {
    navigate("/session");
  }, [navigate]);

  return (
    <main className="mx-auto flex h-screen max-w-5xl flex-col bg-dls-bg p-6 overflow-hidden">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#111827] text-white">
              <Workflow size={20} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-dls-text">
                {t("sprintnex.mapping.settings_title")}
              </h1>
              <p className="mt-1 text-sm text-dls-secondary">
                {t("sprintnex.mapping.configure_description")}
              </p>
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={goToSession}>
          {t("sprintnex.mapping.back_to_session")}
        </Button>
      </div>

      {/* Tab bar */}
      <div className="mb-6 inline-flex rounded-lg border border-dls-border bg-dls-surface p-0.5 self-start">
        <button
          type="button"
          className={`inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors ${
            activeTab === "mappings"
              ? "bg-dls-bg text-dls-text shadow-sm"
              : "text-dls-secondary hover:text-dls-text"
          }`}
          onClick={() => setActiveTab("mappings")}
        >
          <LinkIcon className="size-3.5" />
          {t("sprintnex.mapping.mappings")}
        </button>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-dls-secondary transition-colors hover:text-dls-text"
          onClick={() => navigate("/settings/ai")}
        >
          <KeyRound className="size-3.5" />
          {t("sprintnex.mapping.providers")}
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-7/30 bg-red-2/50 px-4 py-3 text-sm text-red-11">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-dls-secondary">
            {t("sprintnex.mapping.loading_projects")}
          </p>
        </div>
      ) : grouped.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-sm text-dls-secondary">
            {t("sprintnex.mapping.no_projects")}
          </p>
          <p className="text-xs text-dls-tertiary">
            {t("sprintnex.mapping.sign_in_hint")}
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-6 overflow-auto">
          {grouped.map(({ teamId, teamName, rows: groupRows }) => (
            <div key={teamId}>
              <h2 className="mb-3 text-sm font-medium text-dls-text">
                {teamName}
              </h2>
              <div className="space-y-2">
                {groupRows.map((row) => {
                  const mappedWs = workspaceOptions.find(
                    (w) => w.id === row.mappedWorkspaceId,
                  );
                  const isMapped = Boolean(row.mappedWorkspaceId && mappedWs);
                  return (
                    <div
                      key={row.project.id}
                      className="flex items-center justify-between gap-4 rounded-lg border border-dls-border bg-dls-surface p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-dls-text">
                          {row.project.name}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-dls-secondary">
                          {t("sprintnex.mapping.id", { id: row.project.id })}
                        </p>
                        {isMapped ? (
                          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-green-7/30 bg-green-2/40 px-2 py-0.5 text-xs text-green-11">
                            <LinkIcon className="size-3" />
                            {t("sprintnex.mapping.workspace", {
                              name:
                                mappedWs?.displayName ||
                                mappedWs?.name ||
                                row.mappedWorkspaceId,
                            })}
                          </div>
                        ) : (
                          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-dls-border bg-dls-bg px-2 py-0.5 text-xs text-dls-tertiary">
                            <Unlink className="size-3" />
                            {t("sprintnex.mapping.not_mapped")}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Select
                          value={isMapped ? row.mappedWorkspaceId : ""}
                          onValueChange={(value) => {
                            if (value) handleMap(row.project.id, value);
                          }}
                        >
                          <SelectTrigger className="w-56 rounded-lg">
                            <SelectValue
                              placeholder={t("sprintnex.form.select_workspace")}
                            />
                          </SelectTrigger>
                          <SelectContent align="end">
                            <SelectGroup>
                              <SelectLabel>
                                {t("sprintnex.common.workspaces")}
                              </SelectLabel>
                              {workspaceOptions.length === 0 ? (
                                <div className="px-2 py-4 text-center text-xs text-dls-tertiary">
                                  {t("sprintnex.mapping.no_workspaces")}
                                </div>
                              ) : (
                                workspaceOptions.map((ws) => {
                                  const isMapped = rows.some(
                                    (r) => r.mappedWorkspaceId === ws.id,
                                  );
                                  return (
                                    <SelectItem
                                      key={ws.id}
                                      value={ws.id}
                                      disabled={isMapped}
                                    >
                                      {ws.displayName || ws.name || ws.id}
                                    </SelectItem>
                                  );
                                })
                              )}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        {isMapped ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0 text-dls-tertiary hover:text-red-11"
                            onClick={() => handleUnmap(row.project.id)}
                            aria-label={t("sprintnex.action.unmap_workspace")}
                          >
                            <Unlink className="size-4" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
