/**
 * Test Plan Store — local state for test plans.
 * Plans reference scenarios by ID only — import scenario-store for scenario CRUD.
 */

import { useState, useEffect } from "react";
import {
  createScenario,
  getScenario,
  type TestScenario,
} from "./scenario-store";

// ── Types ──────────────────────────────────────────────────────────────────

export type TestPlanStatus = "draft" | "ready" | "archived";

export type TestPlan = {
  id: string;
  name: string;
  description: string;
  projectId: string;
  createdBy: string;
  status: TestPlanStatus;
  scenarioIds: string[];
  testType: "regression" | "smoke" | "functional" | "e2e";
  createdAt: string;
  updatedAt: string;
};

export type TestPlanCreateInput = {
  name: string;
  description: string;
  testType: TestPlan["testType"];
  scenarioIds?: string[];
};

// ── Test Run types ─────────────────────────────────────────────────────────

export type ScenarioResultStatus =
  | "running"
  | "pass"
  | "fail"
  | "error"
  | "skipped";

export type ScenarioResult = {
  scenarioId: string;
  scenarioName: string;
  status: ScenarioResultStatus;
  steps: {
    stepId: string;
    action: string;
    status: ScenarioResultStatus;
    actualResult?: string;
  }[];
  screenshots: string[];
  logs: string[];
  startedAt: string;
  completedAt?: string;
  error?: string;
};

export type TestRunStatus = "running" | "completed" | "failed" | "aborted";

export type TestRun = {
  id: string;
  planId: string;
  planName: string;
  sessionId?: string;
  targetUrl?: string;
  status: TestRunStatus;
  scenarioResults: ScenarioResult[];
  startedAt: string;
  completedAt?: string;
  totalScenarios: number;
  passed: number;
  failed: number;
  errors: number;
};

// ── Plan Store ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "sprintnex.testPlans.v1";
let testPlanCache: Map<string, TestPlan> = new Map();
let listeners: Set<() => void> = new Set();
let loaded = false;

function loadCache(): void {
  if (loaded) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as (TestPlan & {
        scenarios?: TestScenario[];
      })[];
      for (const p of parsed) {
        if (
          p.scenarios &&
          Array.isArray(p.scenarios) &&
          p.scenarios.length > 0
        ) {
          for (const sc of p.scenarios) {
            if (!getScenario(sc.id)) {
              createScenario({
                name: sc.name,
                description: sc.description,
                steps: sc.steps,
                tags: sc.tags ?? [],
              });
            }
            if (!p.scenarioIds) p.scenarioIds = [];
            if (!p.scenarioIds.includes(sc.id)) p.scenarioIds.push(sc.id);
          }
          delete (p as Record<string, unknown>).scenarios;
        }
        if (!p.scenarioIds) p.scenarioIds = [];
      }
      testPlanCache = new Map(parsed.map((p) => [p.id, p as TestPlan]));
      persist();
    }
  } catch {
    /* ignore */
  }
  loaded = true;
}

function persist(): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(Array.from(testPlanCache.values())),
  );
}

function emit(): void {
  listeners.forEach((fn) => fn());
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getTestPlan(id: string): TestPlan | undefined {
  loadCache();
  return testPlanCache.get(id);
}

export function getAllTestPlans(): TestPlan[] {
  loadCache();
  return Array.from(testPlanCache.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function createTestPlan(input: TestPlanCreateInput): TestPlan {
  loadCache();
  const now = new Date().toISOString();
  const plan: TestPlan = {
    id: crypto.randomUUID(),
    ...input,
    projectId: "",
    createdBy: "",
    status: "draft",
    scenarioIds: input.scenarioIds ?? [],
    createdAt: now,
    updatedAt: now,
  };
  testPlanCache.set(plan.id, plan);
  persist();
  emit();
  return plan;
}

export function updateTestPlan(
  id: string,
  updates: Partial<TestPlan>,
): TestPlan | undefined {
  loadCache();
  const existing = testPlanCache.get(id);
  if (!existing) return undefined;
  const updated: TestPlan = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  testPlanCache.set(id, updated);
  persist();
  emit();
  return updated;
}

export function deleteTestPlan(id: string): boolean {
  loadCache();
  const deleted = testPlanCache.delete(id);
  if (deleted) {
    persist();
    emit();
  }
  return deleted;
}

export function reorderScenarios(
  planId: string,
  fromIndex: number,
  toIndex: number,
): TestPlan | undefined {
  loadCache();
  const plan = testPlanCache.get(planId);
  if (!plan) return undefined;
  const ids = [...plan.scenarioIds];
  const [moved] = ids.splice(fromIndex, 1);
  ids.splice(toIndex, 0, moved);
  return updateTestPlan(planId, { scenarioIds: ids });
}

export function addScenarioToPlan(
  planId: string,
  scenarioId: string,
): TestPlan | undefined {
  loadCache();
  const plan = testPlanCache.get(planId);
  if (!plan || plan.scenarioIds.includes(scenarioId)) return undefined;
  return updateTestPlan(planId, {
    scenarioIds: [...plan.scenarioIds, scenarioId],
  });
}

export function removeScenarioFromPlan(
  planId: string,
  scenarioId: string,
): TestPlan | undefined {
  loadCache();
  const plan = testPlanCache.get(planId);
  if (!plan) return undefined;
  return updateTestPlan(planId, {
    scenarioIds: plan.scenarioIds.filter((id) => id !== scenarioId),
  });
}

// ── Plan hooks ─────────────────────────────────────────────────────────────

export function useTestPlans(): TestPlan[] {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    loadCache();
    setVersion((v) => v + 1);
    const unsub = subscribe(() => setVersion((v) => v + 1));
    return unsub;
  }, []);
  return getAllTestPlans();
}

export function useTestPlan(id: string | undefined): TestPlan | undefined {
  const [snapshot, setSnapshot] = useState<TestPlan | undefined>(() =>
    id ? getTestPlan(id) : undefined,
  );
  useEffect(() => {
    if (!id) return;
    loadCache();
    setSnapshot(getTestPlan(id));
    const unsub = subscribe(() => setSnapshot(getTestPlan(id)));
    return unsub;
  }, [id]);
  return snapshot;
}

// ── Test Run Store ──────────────────────────────────────────────────────────

const RUNS_KEY = "sprintnex.testRuns.v1";

function loadRuns(): Map<string, TestRun> {
  try {
    const raw = localStorage.getItem(RUNS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TestRun[];
      return new Map(parsed.map((r) => [r.id, r]));
    }
  } catch {
    /* ignore */
  }
  return new Map();
}

function persistRuns(runs: Map<string, TestRun>): void {
  localStorage.setItem(RUNS_KEY, JSON.stringify(Array.from(runs.values())));
}

export function getTestRun(id: string): TestRun | undefined {
  return loadRuns().get(id);
}

export function getAllTestRuns(): TestRun[] {
  return Array.from(loadRuns().values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
}

export function createTestRun(
  planId: string,
  planName: string,
  targetUrl?: string,
): TestRun {
  const runs = loadRuns();
  const run: TestRun = {
    id: crypto.randomUUID(),
    planId,
    planName,
    targetUrl,
    status: "running",
    scenarioResults: [],
    startedAt: new Date().toISOString(),
    totalScenarios: 0,
    passed: 0,
    failed: 0,
    errors: 0,
  };
  runs.set(run.id, run);
  persistRuns(runs);
  return run;
}

export function updateTestRun(
  id: string,
  updates: Partial<TestRun>,
): TestRun | undefined {
  const runs = loadRuns();
  const existing = runs.get(id);
  if (!existing) return undefined;
  const updated: TestRun = { ...existing, ...updates };
  runs.set(id, updated);
  persistRuns(runs);
  return updated;
}

export function useTestRuns(): TestRun[] {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setVersion((v) => v + 1), 2000);
    return () => clearInterval(interval);
  }, []);
  return getAllTestRuns();
}

export function useTestRun(id: string | undefined): TestRun | undefined {
  const [snapshot, setSnapshot] = useState<TestRun | undefined>(() =>
    id ? getTestRun(id) : undefined,
  );
  useEffect(() => {
    if (!id) return;
    setSnapshot(getTestRun(id));
    const interval = setInterval(() => setSnapshot(getTestRun(id)), 2000);
    return () => clearInterval(interval);
  }, [id]);
  return snapshot;
}
