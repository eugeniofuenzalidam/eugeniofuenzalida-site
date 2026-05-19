#!/usr/bin/env bash
# Verifica que las dependencias mínimas estén instaladas.
# Stack: SIN APIs externas. Solo vault Obsidian local + mcpvault MCP server.
# No requiere Docker, ni LLM externo, ni OpenAI.

set -e

echo "=== Verificando dependencias del sistema de memoria ==="

# 1. Dependencias de sistema
for cmd in jq npx; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[ERROR] '$cmd' no está instalado."
    case "$cmd" in
      jq)  echo "  → sudo apt install jq";;
      npx) echo "  → sudo apt install nodejs npm";;
    esac
    exit 1
  fi
done
echo "[OK] jq y npx disponibles"

# 2. Probar que mcpvault corre (se descarga la primera vez via npx)
echo "[..] Verificando @bitbonsai/mcpvault (npx descarga si falta)"
if npx -y @bitbonsai/mcpvault@latest --help >/dev/null 2>&1; then
  echo "[OK] mcpvault accesible vía npx"
else
  echo "[WARN] mcpvault no respondió a --help, pero se descargará al primer uso"
fi

echo
echo "=== Listo ==="
echo "El stack es 100% local: vault Markdown + mcpvault + code-review-graph (si existe)."
echo "Cero APIs externas, cero costos, cero LLMs en background."
echo
echo "Próximo paso: en cada proyecto donde quieras usar memoria persistente,"
echo "  cd <proyecto>"
echo "  bash ~/.claude/skills/persistent-memory-graph/scripts/init-project.sh"
