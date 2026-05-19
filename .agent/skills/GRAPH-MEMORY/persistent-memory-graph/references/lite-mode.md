# Modo lite — sin Graphiti, sin Docker

Para proyectos donde el setup completo es overkill (proyectos chicos, prototipos, sin OpenAI API key disponible). Reemplaza la **Capa 1** (Graphiti + FalkorDB) por **basic-memory** (Markdown + SQLite, todo local).

## Tradeoffs vs setup completo

| Aspecto               | Setup completo (Graphiti)                        | Lite (basic-memory)                     |
| --------------------- | ------------------------------------------------ | --------------------------------------- |
| Infraestructura       | Docker + FalkorDB                                | Ninguna (SQLite local)                  |
| API externa           | OpenAI (extracción de entidades)                 | Ninguna                                 |
| Razonamiento temporal | Bi-temporal con invalidación automática          | No — solo timestamps                    |
| Búsqueda              | Híbrida (BM25 + embeddings + grafo)              | Embeddings locales (FastEmbed)          |
| Costo runtime         | $ por ingesta + RAM contenedor                   | $0, ~50MB SQLite                        |
| Setup time            | ~5 min                                           | ~30s                                    |
| Cuándo usar           | Proyectos largos, decisiones que cambian, equipo | Solista, proyectos < 6 meses, prototipo |

## Instalación

```bash
# Una vez en la máquina
uv tool install basic-memory
```

## Configuración del MCP en `.mcp.json` del proyecto

```json
{
  "mcpServers": {
    "memory": {
      "command": "uvx",
      "args": ["basic-memory", "mcp"],
      "env": {
        "BASIC_MEMORY_HOME": "${PWD}/.memory"
      }
    }
  }
}
```

`${PWD}` no es interpolado por Claude Code automáticamente. Solución: usar path absoluto en `.mcp.json`:

```bash
PROJECT_DIR=$(pwd)
jq --arg dir "$PROJECT_DIR/.memory" \
   '.mcpServers.memory.env.BASIC_MEMORY_HOME = $dir' .mcp.json > tmp && mv tmp .mcp.json
```

## Aislamiento per-project

basic-memory usa el directorio de `BASIC_MEMORY_HOME` como root. Cada proyecto apunta a su propio directorio (`<proyecto>/.memory/` ignorado en `.gitignore`).

## Workflow del protocolo en lite-mode

Idéntico al del SKILL.md, reemplazando llamadas a `graphiti-memory` por `memory`:

- `graphiti-memory.search_memory_nodes(...)` → `memory.search_notes(...)`
- `graphiti-memory.add_memory(...)` → `memory.write_note(...)`

basic-memory escribe Markdown en `<project>/.memory/`, lo cual es:

- Inspeccionable (`cat .memory/notes/*.md`)
- Versionable si querés (sacalo del `.gitignore`)
- Compatible con Obsidian si querés visualizarlo (apuntá Obsidian a `.memory/` como vault)

## Cuándo migrar a Graphiti

Señales de que el lite-mode ya no alcanza:

- Decisiones que cambian (ej: "antes usábamos X, ahora Y") y querés que la memoria invalide automáticamente
- El agente repite errores porque la búsqueda solo-embedding no captura relaciones
- Múltiples agentes/sesiones simultáneas (basic-memory tiene locking limitado)

Migración: ingerí los `.md` de basic-memory como episodios iniciales en Graphiti vía un script que itere y llame `add_memory`. No hay path automático todavía.
