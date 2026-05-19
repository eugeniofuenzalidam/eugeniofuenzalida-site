#!/usr/bin/env bash
# Crea estructura mínima de vault Obsidian en <project>/.vault/
# Usado internamente por init-project.sh, también ejecutable solo.
# Uso: bash init-vault.sh [project_dir]

set -e

PROJECT_DIR="${1:-$(pwd)}"
PROJECT_NAME="$(basename "$PROJECT_DIR")"
VAULT_DIR="$PROJECT_DIR/.vault"
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [ -d "$VAULT_DIR" ]; then
  echo "[OK] Vault ya existe en $VAULT_DIR"
  exit 0
fi

mkdir -p "$VAULT_DIR/.obsidian"
mkdir -p "$VAULT_DIR/decisions"
mkdir -p "$VAULT_DIR/context"
mkdir -p "$VAULT_DIR/sessions"

# Config mínima de Obsidian (se completa al abrir en la app)
cat > "$VAULT_DIR/.obsidian/app.json" <<'EOF'
{
  "promptDelete": false,
  "trashOption": "local",
  "useMarkdownLinks": true,
  "newLinkFormat": "shortest"
}
EOF
echo '[]' > "$VAULT_DIR/.obsidian/community-plugins.json"

# 00-INDEX.md (MOC raíz)
sed "s/{{PROJECT_NAME}}/$PROJECT_NAME/g" "$SKILL_DIR/assets/moc-index.md" > "$VAULT_DIR/00-INDEX.md"

# Template ADR
cp "$SKILL_DIR/assets/adr-template.md" "$VAULT_DIR/decisions/ADR-000-template.md"

# README del vault
cat > "$VAULT_DIR/README.md" <<EOF
# Vault de $PROJECT_NAME

Vault Obsidian local para notas, ADRs y MOCs del proyecto.
Generado por el skill \`persistent-memory-graph\`.

- \`00-INDEX.md\` — Map of Content raíz
- \`decisions/\` — Architecture Decision Records
- \`context/\` — Snapshots de \`CLAUDE.md\`, arquitectura, decisiones de negocio
- \`sessions/\` — Notas de sesiones AI por fecha

Para abrir en Obsidian: File → Open vault → seleccionar \`$VAULT_DIR\`
(O usar el MCP \`vault-$PROJECT_NAME\` desde Claude Code sin abrir Obsidian.)
EOF

echo "[OK] Vault creado: $VAULT_DIR"
