---
name: read
description: Consulta el vault local del proyecto (memoria, decisiones, episodios pasados) y el grafo estructural del código ANTES de leer archivos o actuar. Úsalo proactivamente al inicio de CADA tarea no trivial — implementar feature, fix de bug, refactor, review, "¿por qué existe X?", "¿qué rompe si cambio Y?". Reduce 60-80% el consumo de tokens vs leer código directo. Si el usuario dice "/read", "leé el grafo", "qué sabemos de", "investigá antes", "contexto", "memoria", "antes de tocar nada", invocalo. NO confundir con la herramienta Read del editor — esto consulta el vault Markdown (`.vault/`) y el grafo del código (code-review-graph), no archivos arbitrarios del filesystem. Stack 100% local, sin APIs externas.
---

# /read — consultar memoria antes de actuar

Antes de tocar código, consultá las 2 capas en orden. Parar en cuanto tengas lo necesario.

## Las 2 capas, en orden

### 1. Vault local (memoria + decisiones + episodios)

El MCP `vault-<project>` lee Markdown en `<project>/.vault/`:

```
vault-<project>.read("00-INDEX.md")              # MOC raíz
vault-<project>.search(query="<keywords>")       # busca en todo el vault
vault-<project>.list("episodes")                 # episodios de sesiones pasadas
vault-<project>.list("decisions")                # ADRs
```

Buscá en este orden:

- `episodes/` — qué se hizo, cuándo, qué archivos se tocaron, por qué
- `decisions/` — ADRs (decisiones de arquitectura)
- `context/claude-md.md` — snapshot de CLAUDE.md
- `00-INDEX.md` — mapa raíz

**Si la tarea ya está documentada acá, saltá al paso 3.**

### 2. Grafo estructural — code-review-graph

```
code-review-graph.semantic_search_nodes(query="<función/módulo>")
code-review-graph.get_impact_radius(node_id="<id>")   # solo si vas a cambiar algo
code-review-graph.query_graph(pattern="callers_of"|"imports_of"|"tests_for", target="<id>")
```

Identificá los **3-5 archivos exactos** que necesitás. No más.

### 3. Código fuente — Read

Leé SOLO los archivos identificados en paso 2.
**Si necesitás >5 archivos, parate y volvé al paso 1** — la tarea está mal acotada.

## Triggers rápidos

| Pedido                    | Capas mínimas                                                   |
| ------------------------- | --------------------------------------------------------------- |
| "Implementa X"            | 1 (¿precedente?) → 2 → 3                                        |
| "Bug en Y"                | 1 (`search` "bug Y") → 2 (`callers_of`) → 3                     |
| "Revisá este diff"        | 2 (`detect_changes` + `get_review_context`) — NO ir a 3         |
| "¿Por qué existe Z?"      | 1 (`decisions/`)                                                |
| "¿Qué rompe si cambio W?" | 2 (`get_impact_radius` + `get_affected_flows`)                  |
| "Onboarding"              | 1 (`00-INDEX.md` + `context/claude-md.md`)                      |
| "Refactor grande"         | 1 → 2 (`get_impact_radius`) → STOP, confirmar scope con usuario |

## Setup necesario

Este skill asume que el proyecto ya tiene `vault-<project>` (mcpvault) y `code-review-graph` activos en `.mcp.json`. Si no:

```bash
bash ~/.claude/skills/persistent-memory-graph/scripts/check-status.sh
bash ~/.claude/skills/persistent-memory-graph/scripts/init-project.sh   # si falta algo
```

## Anti-patrones

- Saltarse capa 1 e ir directo a Read → repetís errores resueltos.
- Leer >5 archivos sin pasar por capa 2 → consumo innecesario.
- Inventar contexto cuando no encontrás nada → mejor decir "no hay registro previo".

## Después de actuar

Cuando termines la tarea, invocá **`/write`** para persistir lo aprendido. Sin eso, la próxima sesión empieza ciega.
