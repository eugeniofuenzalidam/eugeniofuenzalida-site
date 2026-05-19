# {{PROJECT_NAME}} — Map of Content

Vault local del proyecto. Este archivo es el punto de entrada — todas las notas relevantes deberían ser alcanzables desde aquí en ≤2 saltos.

## Contexto

- [[context/claude-md]] — Snapshot de `CLAUDE.md` (arquitectura, stack, gotchas)
- [[context/architecture]] — Visión de alto nivel (crear cuando aplique)
- [[context/glossary]] — Términos del dominio (crear cuando aparezcan ambigüedades)

## Decisiones (ADRs)

Las decisiones de arquitectura van en `decisions/`. Cada una en su archivo. Status: `propuesto`, `aceptado`, `descartado`, `reemplazado`.

- [[decisions/ADR-000-template]] — Template a copiar

## Sesiones AI

Notas por fecha de sesiones de trabajo con Claude Code. Útiles para retomar contexto rápido cuando Graphiti aún no tiene episodios suficientes.

Carpeta: `sessions/`. Convención: `YYYY-MM-DD-<tema>.md`

## Convenciones

- **Wiki-links** (`[[archivo]]`) en vez de Markdown links cuando enlaces dentro del vault
- **Frontmatter** opcional con `tags:`, `status:`, `created:`
- **Atomic notes**: una idea por archivo, links liberalmente
- No commitear el vault (`.vault/` está en `.gitignore`)

## Cómo usar este vault desde Claude Code

El skill `persistent-memory-graph` configuró el MCP `vault-{{PROJECT_NAME}}` en `.mcp.json`. Desde Claude Code podés leer/escribir notas sin abrir Obsidian.

Para visualizar el grafo y backlinks: abrí Obsidian → File → Open vault → seleccioná `.vault/` de este proyecto.
