#!/usr/bin/env sh
set -eu

SPRINTNEX_WORKSPACE="${SPRINTNEX_WORKSPACE:-/workspace}"
SPRINTNEX_DATA_DIR="${SPRINTNEX_DATA_DIR:-/data/sprintnex-orchestrator}"
SPRINTNEX_SIDECAR_DIR="${SPRINTNEX_SIDECAR_DIR:-/data/sidecars}"
SPRINTNEX_PORT="${SPRINTNEX_PORT:-8787}"
SPRINTNEX_OPENCODE_PORT="${SPRINTNEX_OPENCODE_PORT:-4096}"
SPRINTNEX_TOKEN="${SPRINTNEX_TOKEN:-microsandbox-token}"
SPRINTNEX_HOST_TOKEN="${SPRINTNEX_HOST_TOKEN:-microsandbox-host-token}"
SPRINTNEX_APPROVAL_MODE="${SPRINTNEX_APPROVAL_MODE:-auto}"
SPRINTNEX_CORS_ORIGINS="${SPRINTNEX_CORS_ORIGINS:-*}"
SPRINTNEX_CONNECT_HOST="${SPRINTNEX_CONNECT_HOST:-127.0.0.1}"
HOME="${HOME:-/root}"
USER="${USER:-root}"
SHELL="${SHELL:-/bin/sh}"
XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
XDG_STATE_HOME="${XDG_STATE_HOME:-$HOME/.local/state}"

if [ "$HOME" = "/" ]; then
  HOME=/root
  XDG_CONFIG_HOME="$HOME/.config"
  XDG_CACHE_HOME="$HOME/.cache"
  XDG_DATA_HOME="$HOME/.local/share"
  XDG_STATE_HOME="$HOME/.local/state"
fi

export HOME USER SHELL XDG_CONFIG_HOME XDG_CACHE_HOME XDG_DATA_HOME XDG_STATE_HOME

mkdir -p "$SPRINTNEX_WORKSPACE" "$SPRINTNEX_DATA_DIR" "$SPRINTNEX_SIDECAR_DIR"
mkdir -p "$HOME" "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME" "$XDG_DATA_HOME" "$XDG_STATE_HOME"

printf '%s\n' "Starting OpenWork micro-sandbox"
printf '%s\n' "- workspace: $SPRINTNEX_WORKSPACE"
printf '%s\n' "- home: $HOME"
printf '%s\n' "- openwork url: http://$SPRINTNEX_CONNECT_HOST:$SPRINTNEX_PORT"
printf '%s\n' "- client token: $SPRINTNEX_TOKEN"
printf '%s\n' "- host token: $SPRINTNEX_HOST_TOKEN"
printf '%s\n' "- health: curl http://$SPRINTNEX_CONNECT_HOST:$SPRINTNEX_PORT/health"
printf '%s\n' "- auth test: curl -H \"Authorization: Bearer $SPRINTNEX_TOKEN\" http://$SPRINTNEX_CONNECT_HOST:$SPRINTNEX_PORT/workspaces"

exec openwork serve \
  --workspace "$SPRINTNEX_WORKSPACE" \
  --remote-access \
  --openwork-port "$SPRINTNEX_PORT" \
  --opencode-host 127.0.0.1 \
  --opencode-port "$SPRINTNEX_OPENCODE_PORT" \
  --openwork-token "$SPRINTNEX_TOKEN" \
  --openwork-host-token "$SPRINTNEX_HOST_TOKEN" \
  --approval "$SPRINTNEX_APPROVAL_MODE" \
  --cors "$SPRINTNEX_CORS_ORIGINS" \
  --connect-host "$SPRINTNEX_CONNECT_HOST" \
  --allow-external \
  --sidecar-source external \
  --opencode-source external \
  --sprintnex-server-bin /usr/local/bin/sprintnex-server \
  --opencode-bin /usr/local/bin/opencode
