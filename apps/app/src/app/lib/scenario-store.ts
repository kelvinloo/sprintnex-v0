/**
 * Scenario Store — standalone CRUD for test scenarios.
 * No dependency on TestPlan. Plans reference scenarios by ID only.
 */

import { useState, useEffect } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export type TestStep = {
  id: string;
  action: string;
  expectedResult: string;
  order: number;
};

export type TestScenario = {
  id: string;
  name: string;
  description: string;
  steps: TestStep[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type TestScenarioInput = {
  name: string;
  description: string;
  steps?: TestStep[];
  tags?: string[];
};

// ── Store ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "sprintnex.scenarios.v1";
let cache: Map<string, TestScenario> = new Map();
let listeners: Set<() => void> = new Set();
let loaded = false;

function load(): void {
  if (loaded) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TestScenario[];
      cache = new Map(parsed.map((s) => [s.id, s]));
    }
  } catch {
    /* ignore */
  }
  loaded = true;
}

function persist(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(cache.values())));
}

function emit(): void {
  listeners.forEach((fn) => fn());
}

export function subscribeScenarios(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getScenario(id: string): TestScenario | undefined {
  load();
  return cache.get(id);
}

export function getAllScenarios(): TestScenario[] {
  load();
  return Array.from(cache.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function createScenario(input: TestScenarioInput): TestScenario {
  load();
  const now = new Date().toISOString();
  const scenario: TestScenario = {
    id: crypto.randomUUID(),
    name: input.name,
    description: input.description,
    steps: input.steps ?? [],
    tags: input.tags ?? [],
    createdAt: now,
    updatedAt: now,
  };
  cache.set(scenario.id, scenario);
  persist();
  emit();
  return scenario;
}

export function duplicateScenario(id: string): TestScenario | undefined {
  load();
  const original = cache.get(id);
  if (!original) return undefined;
  const now = new Date().toISOString();
  const copy: TestScenario = {
    ...original,
    id: crypto.randomUUID(),
    name: `${original.name} (copy)`,
    createdAt: now,
    updatedAt: now,
  };
  cache.set(copy.id, copy);
  persist();
  emit();
  return copy;
}

export function updateScenario(
  id: string,
  updates: Partial<Omit<TestScenario, "id" | "createdAt">>,
): TestScenario | undefined {
  load();
  const existing = cache.get(id);
  if (!existing) return undefined;
  const updated: TestScenario = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  cache.set(id, updated);
  persist();
  emit();
  return updated;
}

export function deleteScenario(id: string): boolean {
  load();
  const deleted = cache.delete(id);
  if (deleted) {
    persist();
    emit();
  }
  return deleted;
}

// ── Step CRUD ──────────────────────────────────────────────────────────────

export function addStepToScenario(
  scenarioId: string,
  step: Omit<TestStep, "id" | "order">,
): TestScenario | undefined {
  load();
  const sc = cache.get(scenarioId);
  if (!sc) return undefined;
  const newStep: TestStep = {
    ...step,
    id: crypto.randomUUID(),
    order: sc.steps.length,
  };
  return updateScenario(scenarioId, { steps: [...sc.steps, newStep] });
}

export function removeStepFromScenario(
  scenarioId: string,
  stepId: string,
): TestScenario | undefined {
  load();
  const sc = cache.get(scenarioId);
  if (!sc) return undefined;
  return updateScenario(scenarioId, {
    steps: sc.steps
      .filter((s) => s.id !== stepId)
      .map((s, i) => ({ ...s, order: i })),
  });
}

export function updateStepInScenario(
  scenarioId: string,
  stepId: string,
  updates: { action?: string; expectedResult?: string },
): TestScenario | undefined {
  load();
  const sc = cache.get(scenarioId);
  if (!sc) return undefined;
  return updateScenario(scenarioId, {
    steps: sc.steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s)),
  });
}

export function reorderStepsInScenario(
  scenarioId: string,
  fromIndex: number,
  toIndex: number,
): TestScenario | undefined {
  load();
  const sc = cache.get(scenarioId);
  if (!sc) return undefined;
  const steps = [...sc.steps];
  const [moved] = steps.splice(fromIndex, 1);
  steps.splice(toIndex, 0, moved);
  return updateScenario(scenarioId, {
    steps: steps.map((s, i) => ({ ...s, order: i })),
  });
}

// ── React hooks ────────────────────────────────────────────────────────────

export function useAllScenarios(): TestScenario[] {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    load();
    setVersion((v) => v + 1);
    const unsub = subscribeScenarios(() => setVersion((v) => v + 1));
    return unsub;
  }, []);
  return getAllScenarios();
}

export function useScenario(id: string | undefined): TestScenario | undefined {
  const [snapshot, setSnapshot] = useState<TestScenario | undefined>(() =>
    id ? getScenario(id) : undefined,
  );
  useEffect(() => {
    if (!id) return;
    load();
    setSnapshot(getScenario(id));
    const unsub = subscribeScenarios(() => setSnapshot(getScenario(id)));
    return unsub;
  }, [id]);
  return snapshot;
}

/** Resolve a list of scenario IDs to full scenario objects, preserving order, filtering missing. */
export function resolveScenarios(ids: string[]): TestScenario[] {
  load();
  return ids.map((id) => cache.get(id)).filter((s): s is TestScenario => !!s);
}

/** Alias: resolve scenarios for a plan by its scenarioIds array. */
export function getPlanScenarios(plan: {
  scenarioIds: string[];
}): TestScenario[] {
  return resolveScenarios(plan.scenarioIds);
}
