#!/usr/bin/env bash
# Bootstrap del sistema de memoria local (sin APIs externas) para el proyecto actual.
# - Crea .vault/ con MOCs base + carpeta episodes/
# - Mergea .mcp.json con vault-<project> (mcpvault)
# - Limpia entradas viejas de graphiti-memory si existen
# - Agrega .vault/ al .gitignore
# - Si existe CLAUDE.md, lo importa al vault
#
# Idempotente: re-correr no rompe nada.

set -e

PROJECT_DIR="${PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
PROJECT_NAME="$(basename "$PROJECT_DIR")"
VAULT_DIR="$PROJECT_DIR/.vault"
MCP_FILE="$PROJECT_DIR/.mcp.json"
GITIGNORE="$PROJECT_DIR/.gitignore"

SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Inicializando memoria local para: $PROJECT_NAME ==="
echo "Directorio: $PROJECT_DIR"

# 1. Verificar dependencias mínimas (jq, npx)
for cmd in jq npx; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[ERROR] '$cmd' no instalado. Correr primero: bash $SKILL_DIR/scripts/install-backend.sh"
    exit 1
  fi
done

# 2. Crear vault con MOCs base + carpeta episodes/
bash "$SKILL_DIR/scripts/init-vault.sh" "$PROJECT_DIR"
mkdir -p "$VAULT_DIR/episodes"

# 3. Importar CLAUDE.md al vault si existe
if [ -f "$PROJECT_DIR/CLAUDE.md" ] && [ ! -f "$VAULT_DIR/context/claude-md.md" ]; then
  echo "[..] Importando CLAUDE.md al vault como context/claude-md.md"
  mkdir -p "$VAULT_DIR/context"
  cp "$PROJECT_DIR/CLAUDE.md" "$VAULT_DIR/context/claude-md.md"
fi

# 4. Mergear .mcp.json (limpia graphiti-memory si quedó del setup viejo)
bash "$SKILL_DIR/scripts/init-vault-mcp.sh" "$PROJECT_DIR"

# 5. .gitignore
if [ -f "$GITIGNORE" ]; then
  if ! grep -qE '^\.vault/?$' "$GITIGNORE" 2>/dev/null; then
    echo ".vault/" >> "$GITIGNORE"
    echo "[OK] .vault/ agregado a .gitignore"
  else
    echo "[OK] .vault/ ya está en .gitignore"
  fi
else
  echo ".vault/" > "$GITIGNORE"
  echo "[OK] .gitignore creado con .vault/"
fi

# 6. Nota de inicialización
INIT_NOTE="$VAULT_DIR/sessions/$(date -u +%Y-%m-%d)-init.md"
mkdir -p "$VAULT_DIR/sessions"
if [ ! -f "$INIT_NOTE" ]; then
  cat > "$INIT_NOTE" <<EOF
# Init memoria local — $(date -u +%Y-%m-%d)

Sistema de memoria local inicializado para **$PROJECT_NAME**.

- Vault: \`$VAULT_DIR\`
- MCP: \`vault-$PROJECT_NAME\` (mcpvault)
- Stack: 100% local, sin APIs externas, sin LLM en background

## Estructura
- \`episodes/\` — entradas escritas por \`/write\` (qué pasó, cuándo, archivos tocados)
- \`decisions/\` — ADRs (decisiones de arquitectura)
- \`context/\` — snapshots de docs (CLAUDE.md, etc.)
- \`sessions/\` — notas de sesión por fecha

## Próximos pasos
1. Reiniciar Claude Code para que cargue \`.mcp.json\`
2. Usar \`/write\` al terminar cada tarea para documentar
3. Usar \`/read\` al inicio de cada tarea para consultar memoria
EOF
fi

echo
echo "=== Inicialización completa ==="
echo "Vault:       $VAULT_DIR"
echo "MCP config:  $MCP_FILE"
echo
echo ">>> REINICIÁ Claude Code para que cargue el .mcp.json actualizado <<<"
