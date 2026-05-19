#!/usr/bin/env bash
# Mergea entrada de vault-<project> (mcpvault) en .mcp.json del proyecto.
# Preserva otros MCP servers (ej: code-review-graph). Idempotente.
# Limpia entradas obsoletas de graphiti-memory si existen.
# Uso: bash init-vault-mcp.sh [project_dir]

set -e

PROJECT_DIR="${1:-$(pwd)}"
PROJECT_NAME="$(basename "$PROJECT_DIR")"
VAULT_DIR="$PROJECT_DIR/.vault"
MCP_FILE="$PROJECT_DIR/.mcp.json"

if ! command -v jq >/dev/null 2>&1; then
  echo "[ERROR] jq es requerido — sudo apt install jq"
  exit 1
fi

if [ ! -f "$MCP_FILE" ]; then
  echo '{"mcpServers": {}}' > "$MCP_FILE"
fi

TMP="$(mktemp)"
jq \
  --arg vault "$VAULT_DIR" \
  --arg vname "vault-$PROJECT_NAME" \
  '
  # Eliminar Graphiti si quedó del setup viejo
  del(.mcpServers["graphiti-memory"])
  # Agregar vault MCP
  | .mcpServers[$vname] = {
    "command": "npx",
    "args": ["-y", "@bitbonsai/mcpvault@latest", $vault]
  }
  ' "$MCP_FILE" > "$TMP" && mv "$TMP" "$MCP_FILE"

echo "[OK] .mcp.json actualizado: vault-$PROJECT_NAME → $VAULT_DIR"
