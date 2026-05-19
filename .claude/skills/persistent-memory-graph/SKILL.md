---
name: persistent-memory-graph
description: Sistema unificado de memoria persistente, indexación de código y notas estructuradas para agentes Claude Code, aislado por proyecto. Combina Graphiti (memoria episódica/temporal vía knowledge graph), code-review-graph (índice estructural del código vía Tree-sitter) y un vault Obsidian local (MOCs y ADRs en Markdown), todos accedidos vía MCP. Use SIEMPRE este skill cuando el usuario mencione memoria persistente, knowledge graph, Graphiti, Obsidian, MOC, ADR, indexación de código, navegación de codebase, optimización de contexto, "no quiero que releas todo el código", reducir tokens, onboarding a un proyecto, o cuando empiece a trabajar en un proyecto nuevo y necesite inicializar el sistema. También úselo proactivamente al inicio de CADA sesión de trabajo en cualquier proyecto bajo `~/Documents/REPOSITORY/` para consultar memoria antes de leer archivos.
---

# Persistent Memory Graph

Stack global, aislamiento per-project, protocolo de lectura en cascada.

## Por qué existe este skill

Re-leer archivos en cada sesión agota contexto y cuesta tokens. La comunidad (Anthropic, Cole Medin, Martin Fowler) converge en un patrón de **3 capas en cascada**: memoria episódica → grafo estructural → código fuente. Este skill formaliza ese patrón sobre tres MCPs que ya tienen implementaciones maduras y lo aísla por proyecto, de modo que un único skill global sirve a N proyectos sin que sus grafos se mezclen.

## Las 3 capas

| Capa | Sistema | MCP | Qué guarda | Cuándo consultar |
|------|---------|-----|------------|------------------|
| **1. Episódica** | Graphiti (Zep) sobre FalkorDB | `graphiti-memory` | Decisiones, bugs, lo que pasó cuándo. Bi-temporal, invalidación automática | **Primero, siempre** al inicio de cualquier tarea |
| **2. Estructural** | code-review-graph | `code-review-graph` | AST, callers, callees, imports, tests, impact radius | Antes de leer archivos de código |
| **3. Notas** | Obsidian vault local + mcpvault | `vault-<project>` | MOCs, ADRs, arquitectura, contexto de negocio | Para diseño, onboarding, decisiones de alto nivel |

El código fuente (`Read` directo) es el último recurso, no el primero.

## Aislamiento per-project

El skill vive en `~/.claude/skills/persistent-memory-graph/` y es global. Pero los datos viven por proyecto:

- **Graphiti**: un único FalkorDB compartido en `~/.graphiti/`. Cada proyecto tiene su `group_id` derivado del nombre del directorio (`basename $(pwd)`). Los nodos están etiquetados con ese group_id, así que las queries no se mezclan.
- **Vault Obsidian**: vive en `<project>/.vault/`, ignorado en `.gitignore`. Cada proyecto su propio vault.
- **code-review-graph**: ya indexa por proyecto (vive en el cwd).

Resultado: al activar el skill en un proyecto nuevo, se crea su grafo + su vault + se inyectan las entradas correspondientes en `.mcp.json` del proyecto. Cero contaminación cruzada.

## Workflow al iniciar trabajo en un proyecto

### 1. Detectar estado

Ejecutá:
```bash
bash ~/.claude/skills/persistent-memory-graph/scripts/check-status.sh
```

Reporta: si el backend (FalkorDB) está corriendo, si el proyecto tiene `.vault/`, si `.mcp.json` tiene `graphiti-memory`, qué `group_id` está configurado.

### 2. Si el proyecto NO está inicializado

```bash
bash ~/.claude/skills/persistent-memory-graph/scripts/init-project.sh
```

Este script:
- Verifica que FalkorDB esté corriendo (lo arranca si no, vía Docker)
- Crea `<project>/.vault/` con MOCs base (`00-INDEX.md`, carpetas `decisions/`, `context/`, `sessions/`)
- Hace merge en `.mcp.json` agregando `graphiti-memory` con `--group-id <basename>` y `vault-<project>` con la ruta del vault
- Agrega `.vault/` al `.gitignore`
- Si existe un `CLAUDE.md`, lo importa como episodio inicial al grafo (`add_memory`) y como nota en `context/claude-md.md`
- Imprime instrucciones para reiniciar Claude Code (los `.mcp.json` se leen al arrancar)

### 3. Si el backend no está instalado (one-time setup)

```bash
bash ~/.claude/skills/persistent-memory-graph/scripts/install-backend.sh
```

Clona Graphiti a `~/.graphiti/`, instala dependencias con `uv`, descarga la imagen de FalkorDB, configura `docker-compose.yml`. Solo se corre UNA vez por máquina.

## El protocolo de lectura (en cada tarea)

Cuando el usuario te pide algo en un proyecto que ya tiene este skill activo:

```
PROTOCOLO_LECTURA(tarea):
  1. Capa 1 — Memoria episódica
     graphiti-memory.search_memory_nodes(query=<keywords de la tarea>)
     graphiti-memory.search_memory_facts(query=<keywords>)
     → Si hay decisiones previas o bugs registrados, considéralos antes de actuar
     → Si la tarea está completamente documentada en memoria, salta a paso 4

  2. Capa 2 — Grafo estructural
     code-review-graph.semantic_search_nodes(query=<función/módulo>)
     code-review-graph.get_impact_radius(node_id=<si modificas algo>)
     code-review-graph.query_graph(pattern="callers_of"|"imports_of")
     → Identifica los 3-5 archivos exactos que necesitas leer

  3. Capa 3 — Código fuente
     Read los archivos identificados en paso 2
     Si necesitas leer >5 archivos, la tarea está mal acotada — vuelve a paso 1

  4. Notas / MOCs (paralelo a 2-3 si es tarea de diseño)
     vault-<project>.read("00-INDEX.md")
     vault-<project>.read("decisions/ADR-relevante.md")

  5. Trabajar (Edit/Write)

  6. AL TERMINAR: persistir lo aprendido
     graphiti-memory.add_memory(
       name=<resumen 1 línea>,
       episode_body=<qué hiciste, por qué, qué archivos tocaste, qué decisiones tomaste>,
       source="text",
       group_id=<auto, ya configurado en el server>
     )
     Si la decisión es de arquitectura → también vault-<project>.write("decisions/ADR-XXX-titulo.md")
```

### Triggers concretos por tipo de tarea

| Pedido del usuario | Orden del protocolo |
|--------------------|---------------------|
| "Implementa feature X" | Capa 1 (¿hay precedente?) → Capa 2 (`semantic_search` de módulos relevantes) → leer ≤3 archivos → Edit |
| "Revisa este PR / diff" | Capa 2 (`detect_changes` + `get_review_context`) → NO leer código directamente |
| "¿Por qué existe Y?" | Capa 3 notas (`00-INDEX.md`, ADRs) → Capa 1 (episodios) |
| "¿Qué rompe si cambio Z?" | Capa 2 (`get_impact_radius` + `get_affected_flows`) → leer SOLO impacto alto |
| "Bug reportado" | Capa 1 (`search_memory_facts` "bug similar") → Capa 2 (`callers_of` función sospechosa) → Read |
| "Onboarding / sesión nueva" | Capa 3 (`00-INDEX.md` del vault) → Capa 1 (episodios recientes) → NO leer código hasta tener tarea concreta |
| "Refactor X a Y" | Capa 1 (¿se intentó antes?) → Capa 2 (`get_impact_radius`) → Capa 3 (registrar como ADR antes de empezar) |

## Anti-patrones

1. **No leer Capa 1 antes de actuar** — perdés contexto histórico, repetís errores resueltos.
2. **Leer múltiples archivos sin pasar por Capa 2** — agotás contexto sin necesidad.
3. **No persistir al final de la tarea** — la memoria queda incompleta, la próxima sesión empieza ciega.
4. **Inventar resúmenes cuando no encontrás contexto** — mejor decirle al usuario "no hay registro previo" que fabricar.
5. **Mezclar group_ids** — el script de init garantiza aislamiento; nunca pases manualmente un group_id de otro proyecto.
6. **Dejar el vault sin `.gitignore`** — los logs de sesión y notas internas no van al repo.

## Tradeoffs y opciones

Si el setup completo (Docker + FalkorDB + OpenAI API key) es overkill para un proyecto chico, hay un modo ligero: usar **basic-memory** en lugar de Graphiti (Markdown puro + SQLite, sin API externa). Ver `references/lite-mode.md`. Las capas 2 y 3 quedan iguales.

## Referencias

- `references/read-protocol.md` — pseudocódigo expandido, ejemplos por tipo de tarea
- `references/moc-templates.md` — templates para `00-INDEX.md`, ADRs, notas de sesión
- `references/troubleshooting.md` — backend no arranca, `.mcp.json` no recarga, group_id duplicado
- `references/lite-mode.md` — alternativa basic-memory sin Docker
- `references/community-sources.md` — links a Cole Medin, Anthropic, Zep docs

## Métrica de éxito

Después de adoptar el protocolo, mediar:
- **`Read` calls antes del primer `Edit`**: objetivo ≤3 para tareas de mantenimiento
- **Tokens consumidos por tarea**: con Capa 1+2 funcionando, esperar 60-80% reducción vs leer código directo
- **Señal subjetiva**: el agente no pregunta "¿en qué framework están?" ni repite errores resueltos en sesiones previas

Si después de 5-10 tareas no se ven estos resultados, revisá `references/troubleshooting.md` — probablemente la persistencia (paso 6 del protocolo) no se está ejecutando.
