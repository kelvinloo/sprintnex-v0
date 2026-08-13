# Sprintnex Rebrand Plan

Repo: `openwork/openwork` (product being rebranded: OpenWork → **Sprintnex**)
Status: tracked as a phased rollout. Completed work is listed under Progress; remaining work is in the **Backlog**.

## Goal

Rename every OpenWork product artifact (packages, imports, env vars, config paths, storage keys, display strings, sidecars, plugins, file names) to Sprintnex without breaking the build, tests, packaging, or release pipeline.

## Progress (completed)

### Phase 1 — Package names ✅
- All 9 core package names renamed:
  - `@openwork/app` → `@sprintnex/app`
  - `@openwork/desktop` → `@sprintnex/desktop`
  - `@openwork/installer` → `@sprintnex/installer`
  - `@openwork/ui-demo` → `@sprintnex/ui-demo`
  - `@openwork/ui` → `@sprintnex/ui`
  - `@openwork/types` → `@sprintnex/types`
  - `@openwork/install-config` → `@sprintnex/install-config`
  - `openwork-orchestrator` → `sprintnex-orchestrator`
  - `openwork-server` → `sprintnex-server` (both `apps/server` and `apps/desktop/server`)
- Root `package.json` scripts + env vars updated (`SPRINTNEX_DEV_MODE`, `SPRINTNEX_ELECTRON_REMOTE_DEBUG_PORT`).
- Global `sed` across all `package.json` files (`@openwork` → `@sprintnex`, `openwork-` → `sprintnex-`).
- Regenerated `pnpm-lock.yaml` (16 workspace projects).

### Phase 2 — Source imports ✅
- Updated 18+ source files importing `@sprintnex/*` / `sprintnex-*`.
- Verified 0 remaining `@openwork` imports in source.

### Phase 3 — Environment variables ✅
- Swept `OPENWORK_` → `SPRINTNEX_` across **297+ files** (all source types incl. `.cjs`, `.mjs`, workflows, docker, READMEs). Final count: **0 remaining** in source.
- Renamed constants/functions:
  - `DEFAULT_OPENWORK_PORT` → `DEFAULT_SPRINTNEX_PORT`
  - `SANDBOX_INTERNAL_OPENWORK_PORT` → `SANDBOX_INTERNAL_SPRINTNEX_PORT`
  - `sanitizeOpenworkTemplateConfig` → `sanitizeSprintnexTemplateConfig`
- Sidecar/packaging consistency (`sprintnex-server` / `sprintnex-orchestrator`):
  - `apps/orchestrator/src/cli.ts`, `apps/desktop/scripts/prepare-sidecar.mjs`
  - `apps/desktop/electron-builder.yml`, `electron-after-pack.cjs`, `electron-after-sign.cjs`
  - `apps/orchestrator/bin/openwork` launcher (resolves `sprintnex-orchestrator-*` npm pkgs; `SPRINTNEX_ORCHESTRATOR_BIN_PATH`)
  - `apps/desktop/resources/sidecars/versions.json-*` manifests
  - `apps/orchestrator/script/build.ts` default `filename: "sprintnex"`
  - `apps/orchestrator/scripts/publish-npm.mjs` (source binary `sprintnex-${target.bun}`)
- File renames (imports had already been swept):
  - `apps/app/src/app/lib/openwork-server.ts` → `sprintnex-server.ts`
  - `apps/app/src/react-app/domains/connections/openwork-server-store.ts` → `sprintnex-server-store.ts`
  - `apps/app/src/react-app/domains/connections/openwork-server-provider.tsx` → `sprintnex-server-provider.tsx`
  - `apps/server/bin/openwork-server.mjs` → `sprintnex-server.mjs`
  - 9 opencode plugin files (`openwork-extensions-preview.ts` etc.) → `sprintnex-*` (build refs already pointed there; the build was broken before this fix)
- Test alignment: `openwork-runtime-config.test.ts` + `runtime-opencode-config-store.test.ts` now expect the `sprintnex` agent (source already produced it).

#### Phase 3 verification
- Orchestrator typecheck ✅, Server typecheck + build ✅, Installer tests 27/27 ✅.
- Server tests: 615 pass; 1 fail = stale `dist/workspace-init.test.js` artifact (pre-existing; source test passes 12/12).
- App typecheck: module-resolution errors fixed; 2 pre-existing errors remain in `domains/sprintnex/sprintnex-skill-profile.tsx` / `sprintnex-skills-page.tsx` (in-progress feature, zero openwork refs — unrelated).
- Edited `.cjs` / bin scripts pass `node --check`.

### Infrastructure (environment) ✅
- Upgraded Node to v24.19.0 (LTS) — pnpm 11.4.0 requires Node ≥22.13.
- Reinstalled pnpm 11.4.0; regenerated `pnpm-lock.yaml`.

## Backlog

### Phase 4 — Config paths (breaking change; needs migration strategy)
- `~/.config/openwork/` → `~/.config/sprintnex/` (env.json, sandbox-mount-allowlist.json)
- `%APPDATA%\openwork\` → `%APPDATA%\sprintnex\`
- `~/.openwork/` → `~/.sprintnex/`
- `openwork-dev-data` → `sprintnex-dev-data` (data dirs)
- Files: `apps/orchestrator/src/cli.ts`, `apps/server/src/*` (config loaders), desktop runtime env-store resolution.
- Note: existing installs will lose config unless a one-time migration (copy old → new) is added.

### Phase 5 — Storage keys
- `localStorage` keys: `openwork.*` → `sprintnex.*` (Zustand stores, preferences, `openwork.language`, `openwork:notifications:v1`).
- IPC channel names: `openwork:menu-overlay:*`, `openwork:*`.
- Electron `window.__OPENWORK_ELECTRON__` global (Phase 3 swept the `__OPENWORK_*__` prefix in source; verify preload↔renderer pairing).
- Existing user data is orphaned — needs migration code.

### Later / cosmetic
- i18n display strings: "OpenWork" → "Sprintnex" (`apps/app/src/i18n/locales/*.ts`), `settings.*openwork*` / `status.*` / `skills.*` translation keys.
- CLI flags: `--openwork-host` / `--openwork-port` / `--openwork-url` / `--openwork-token` / `--openwork-server-bin` → `--sprintnex-*` (in `cli.ts` help + `readFlag`).
- File/package renames: `apps/installer/src/openwork-logo.ts`, `apps/app/.../openwork-models-promo.ts`, `openwork-models-startup-dialog.tsx`, `packages/openwork-bootstrap`, `packages/openwork-ui-mcp`, `.opencode/skills/openwork-models/`.
- npm bin key / launcher: `bin/openwork` file name + `publish-npm.mjs` `bin.openwork` key (currently intentionally kept as `openwork`).
- API error codes: `openwork_workspace_discovery_failed`, `openwork_workspace_not_found`.
- Tool names: `openwork_snapshot`, `openwork_list_actions`, `openwork_execute_action`.
- `apps/desktop/server/` is a vestigial leftover (only stale `dist/`; server now runs in-process) — consider removing.

## Decisions / guardrails
- Kept GitHub repo URL (`github.com/different-ai/openwork` and `github.com/k3lvinlkf/openwork`) unchanged — that's the real repo.
- Kept `OPENWRK_SIDECAR_DIR` and `OPENCODE_ASSET` legacy fallbacks untouched.
- Kept `openwork:` IPC channels for now (Phase 5).
- Env var sweep used `OPENWORK_` → `SPRINTNEX_` (never touches `OPENWRK_` or `OPENCODE_`).

## Suggested next step
Proceed with **Phase 4 (config paths)**. It is a breaking change for existing installs — agree on a migration strategy (e.g., copy legacy config dir → new dir on first run) before implementing.
