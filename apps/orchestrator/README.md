# OpenWork Orchestrator

Host orchestrator for opencode + OpenWork server. This is a CLI-first way to run host mode without the desktop UI.

Published on npm as `sprintnex-orchestrator` and installs the `openwork` command.

## Quick start

```bash
npm install -g sprintnex-orchestrator
openwork start --workspace /path/to/workspace --approval auto
```

When run in a TTY, `openwork` shows an interactive status dashboard with service health, ports, and
connection details. Use `openwork serve` or `--no-tui` for log-only mode.

```bash
openwork serve --workspace /path/to/workspace
```

`openwork` ships as a compiled binary, so Bun is not required at runtime.

If npm skips the optional platform package, `postinstall` falls back to downloading the matching
binary from the `sprintnex-orchestrator-v<version>` GitHub release. Override the download host with
`SPRINTNEX_ORCHESTRATOR_DOWNLOAD_BASE_URL` when you need to use a mirror.

`openwork` downloads and caches the `sprintnex-server` and `opencode` sidecars on
first run using a SHA-256 manifest. Use `--sidecar-dir` or `SPRINTNEX_SIDECAR_DIR` to control the
cache location, and `--sidecar-base-url` / `--sidecar-manifest` to point at a custom host.

Use `--sidecar-source` to control where `sprintnex-server` is resolved (`auto` | `bundled` |
`downloaded` | `external`), and `--opencode-source` to control `opencode` resolution. Set
`SPRINTNEX_SIDECAR_SOURCE` / `SPRINTNEX_OPENCODE_SOURCE` to apply the same policies via env vars.

By default the manifest is fetched from
`https://github.com/different-ai/openwork/releases/download/sprintnex-orchestrator-v<version>/sprintnex-orchestrator-sidecars.json`.

For development overrides only, set `SPRINTNEX_ALLOW_EXTERNAL=1` or pass `--allow-external` to use
locally installed `sprintnex-server` binaries.

Add `--verbose` (or `SPRINTNEX_VERBOSE=1`) to print extra diagnostics about resolved binaries.

OpenCode hot reload is enabled by default when launched via `openwork`.
Tune it with:

- `--opencode-hot-reload` / `--no-opencode-hot-reload`
- `--opencode-hot-reload-debounce-ms <ms>`
- `--opencode-hot-reload-cooldown-ms <ms>`

Equivalent env vars:

- `SPRINTNEX_OPENCODE_HOT_RELOAD` (router mode)
- `SPRINTNEX_OPENCODE_HOT_RELOAD_DEBOUNCE_MS`
- `SPRINTNEX_OPENCODE_HOT_RELOAD_COOLDOWN_MS`
- `SPRINTNEX_OPENCODE_HOT_RELOAD` (start/serve mode)
- `SPRINTNEX_OPENCODE_HOT_RELOAD_DEBOUNCE_MS`
- `SPRINTNEX_OPENCODE_HOT_RELOAD_COOLDOWN_MS`

Or from source:

```bash
pnpm --filter sprintnex-orchestrator dev -- \
  start --workspace /path/to/workspace --approval auto --allow-external
```

When `SPRINTNEX_DEV_MODE=1` is set, orchestrator uses an isolated OpenCode dev state for config, auth, data, cache, and state. OpenWork's repo-level `pnpm dev` commands enable this automatically so local development does not reuse your personal OpenCode environment.

The command prints pairing URLs by default and withholds live credentials from stdout to avoid leaking them into shell history or collected logs. Use `--json` only when you explicitly need the raw pairing secrets in command output.

Use `--detach` to keep services running and exit the dashboard. The detach summary includes the
OpenWork URL and a redacted `opencode attach` command, while keeping live credentials out of the detached summary.

## Sandbox mode (Docker / Apple container)

`openwork` can run the sidecars inside a Linux container boundary while still mounting your workspace
from the host.

```bash
# Auto-pick sandbox backend (prefers Apple container on supported Macs)
openwork start --sandbox auto --workspace /path/to/workspace --approval auto

# Explicit backends
openwork start --sandbox docker --workspace /path/to/workspace --approval auto
openwork start --sandbox container --workspace /path/to/workspace --approval auto
```

Notes:

- `--sandbox auto` prefers Apple `container` on supported Macs (arm64), otherwise Docker.
- Docker backend requires `docker` on your PATH.
- Apple container backend requires the `container` CLI (https://github.com/apple/container).
- In sandbox mode, sidecars are resolved for a Linux target (and `--sidecar-source` / `--opencode-source`
  are effectively `downloaded`).
- Custom `--*-bin` overrides are not supported in sandbox mode yet.
- Use `--sandbox-image` to pick an image with the toolchain you want available to OpenCode.
- Use `--sandbox-persist-dir` to control the host directory mounted at `/persist` inside the container.

### Extra mounts (allowlisted)

You can add explicit, validated mounts into `/workspace/extra/*`:

```bash
openwork start --sandbox auto --sandbox-mount "/path/on/host:datasets:ro" --workspace /path/to/workspace
```

Additional mounts are blocked unless you create an allowlist at:

- `~/.config/openwork/sandbox-mount-allowlist.json`

Override with `SPRINTNEX_SANDBOX_MOUNT_ALLOWLIST`.

## Logging

`openwork` emits a unified log stream from OpenCode and OpenWork server. Use JSON format for
structured, OpenTelemetry-friendly logs and a stable run id for correlation.

```bash
SPRINTNEX_LOG_FORMAT=json openwork start --workspace /path/to/workspace
```

Use `--run-id` or `SPRINTNEX_RUN_ID` to supply your own correlation id.

OpenCode runs at `INFO` by default, which produces large log files in
`~/.local/share/opencode/log/`. Pass `--opencode-log-level <DEBUG|INFO|WARN|ERROR>` (or set
`SPRINTNEX_OPENCODE_LOG_LEVEL`) to forward `--log-level` to managed `opencode serve` and reduce log
volume.

OpenWork server logs every request with method, path, status, and duration. Disable this when running
`sprintnex-server` directly by setting `SPRINTNEX_LOG_REQUESTS=0` or passing `--no-log-requests`.

## Router daemon (multi-workspace)

The router keeps a single OpenCode process alive and switches workspaces JIT using the `directory` parameter.

```bash
openwork daemon start
openwork workspace add /path/to/workspace-a
openwork workspace add /path/to/workspace-b
openwork workspace list --json
openwork workspace path <id>
openwork instance dispose <id>
```

Use `SPRINTNEX_DATA_DIR` or `--data-dir` to isolate router state in tests.

## Pairing notes

- Use the **OpenWork connect URL** and **client token** to connect a remote OpenWork client.
- The OpenWork server advertises the **OpenCode connect URL** plus optional basic auth credentials to the client.

## Approvals (manual mode)

```bash
openwork approvals list \
  --openwork-url http://<host>:8787 \
  --host-token <token>

openwork approvals reply <id> --allow \
  --openwork-url http://<host>:8787 \
  --host-token <token>
```

## Health checks

```bash
openwork status \
  --openwork-url http://<host>:8787 \
  --opencode-url http://<host>:4096
```

## File sessions (JIT catalog + batch read/write)

Create a short-lived workspace file session and sync files in batches:

```bash
# Create writable session
openwork files session create \
  --openwork-url http://<host>:8787 \
  --token <client-token> \
  --workspace-id <workspace-id> \
  --write \
  --json

# Fetch catalog snapshot
openwork files catalog <session-id> \
  --openwork-url http://<host>:8787 \
  --token <client-token> \
  --limit 200 \
  --json

# Read one or more files
openwork files read <session-id> \
  --openwork-url http://<host>:8787 \
  --token <client-token> \
  --paths "README.md,notes/todo.md" \
  --json

# Write a file (inline content or --file)
openwork files write <session-id> \
  --openwork-url http://<host>:8787 \
  --token <client-token> \
  --path notes/todo.md \
  --content "hello from openwork" \
  --json

# Watch change events and close session
openwork files events <session-id> --openwork-url http://<host>:8787 --token <client-token> --since 0 --json
openwork files session close <session-id> --openwork-url http://<host>:8787 --token <client-token> --json
```

## Smoke checks

```bash
openwork start --workspace /path/to/workspace --check --check-events
```

This starts the services, verifies health + SSE events, then exits cleanly.

## Local development

Point to source CLIs for fast iteration:

```bash
openwork start \
  --workspace /path/to/workspace \
  --allow-external \
  --sprintnex-server-bin apps/server/src/cli.ts
```
