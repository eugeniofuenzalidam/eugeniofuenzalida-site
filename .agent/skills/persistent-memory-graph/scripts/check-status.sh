#!/usr/bin/env bash
# Reporta el estado del sistema de memoria local para el proyecto actual.
# Uso: bash check-status.sh

set -e

PROJECT_DIR="${PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
PROJECT_NAME="$(basename "$PROJECT_DIR")"
VAULT_DIR="$PROJECT_DIR/.vault"
MCP_FILE="$PROJECT_DIR/.mcp.json"

echo "=== Estado del sistema de memoria local ==="
echo "Proyecto:   $PROJECT_NAME"
echo "Directorio: $PROJECT_DIR"
echo

# Dependencias
for cmd in jq npx; do
  if command -v "$cmd" >/dev/null 2>&1; then
    echo "[OK]   $cmd disponible"
  else
    echo "[MISS] $cmd NO instalado — correr install-backend.sh"
  fi
done

# Vault del proyecto
if [ -d "$VAULT_DIR" ]; then
  EPISODES=$(find "$VAULT_DIR/episodes" -name '*.md' 2>/dev/null | wc -l)
  ADRS=$(find "$VAULT_DIR/decisions" -name 'ADR-*.md' 2>/dev/null | wc -l)
  echo "[OK]   Vault en $VAULT_DIR ($EPISODES episodios, $ADRS ADRs)"
else
  echo "[MISS] Vault NO existe — correr init-project.sh"
fi

# .mcp.json
if [ -f "$MCP_FILE" ]; then
  HAS_VAULT=$(jq -r ".mcpServers | has(\"vault-$PROJECT_NAME\")" "$MCP_FILE" 2>/dev/null || echo "false")
  HAS_GRAPHITI=$(jq -r '.mcpServers | has("graphiti-memory")' "$MCP_FILE" 2>/dev/null || echo "false")

  if [ "$HAS_VAULT" = "true" ]; then
    echo "[OK]   .mcp.json tiene vault-$PROJECT_NAME"
  else
    echo "[MISS] .mcp.json no tiene vault-$PROJECT_NAME"
  fi

  if [ "$HAS_GRAPHITI" = "true" ]; then
    echo "[WARN] .mcp.json tiene graphiti-memory (legacy) — correr init-project.sh para limpiar"
  fi
else
  echo "[MISS] .mcp.json no existe"
fi

# .gitignore
if [ -f "$PROJECT_DIR/.gitignore" ] && grep -q "^\.vault" "$PROJECT_DIR/.gitignore" 2>/dev/null; then
  echo "[OK]   .vault/ ignorado en .gitignore"
elif [ -d "$VAULT_DIR" ]; then
  echo "[WARN] .vault/ existe pero NO está en .gitignore"
fi

echo
echo "Si todo dice [OK]: estás listo. Si hay [MISS], correr init-project.sh"
