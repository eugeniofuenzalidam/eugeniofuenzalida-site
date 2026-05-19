# Fuentes y referencias de la comunidad

Material consultado para diseñar este skill. Útil para profundizar en partes específicas o validar decisiones.

## Productos / repos

- **Graphiti (Zep)** — https://github.com/getzep/graphiti — knowledge graph temporal, MCP server oficial
- **FalkorDB** — https://docs.falkordb.com/agentic-memory/graphiti-mcp-server.html — backend recomendado sobre Neo4j para agentes
- **mcpvault** — https://github.com/bitbonsai/mcpvault — MCP server para vaults Obsidian, filesystem-based
- **basic-memory** — https://github.com/basicmachines-co/basic-memory — alternativa lite (Markdown + SQLite)
- **rawr-ai/mcp-graphiti** — https://github.com/rawr-ai/mcp-graphiti — fork con Docker per-project (no usado por overhead)
- **Graphify** — https://github.com/safishamsi/graphify — indexación estática de código (similar a code-review-graph)
- **MegaMem** — https://github.com/C-Bjorn/MegaMem — Obsidian + Graphiti combo (más pesado)

## Documentación oficial

- Anthropic — *Effective context engineering for AI agents*: https://www.anthropic.com/engineering/effective-context-engineering-for-aiagents
- Zep — *Knowledge Graph MCP Server*: https://help.getzep.com/graphiti/getting-started/mcp-server
- Neo4j blog — *Graphiti: Knowledge Graph Memory for an Agentic World*: https://neo4j.com/blog/developer/graphiti-knowledge-graph-memory/
- Anthropic Cookbook — *Memory & context management*: https://platform.claude.com/cookbook/tool-use-memory-cookbook

## Papers

- *Zep: A Temporal Knowledge Graph Architecture for Agent Memory* — arXiv:2501.13956
- *MAGMA: A Multi-Graph based Agentic Memory Architecture* — arXiv:2601.03236
- *Reducing Token Usage of Software Engineering Agents* — TU Wien 2025

## Análisis comparativos

- Cognee — *AI Memory Benchmarking: Cognee, LightRAG, Graphiti, Mem0*: https://www.cognee.ai/blog/deep-dives/ai-memory-evals-0825
- *Mem0 vs Zep vs LangMem vs MemoClaw: AI Agent Memory Comparison 2026*: https://dev.to/anajuliabit/mem0-vs-zep-vs-langmem-vs-memoclaw-ai-agent-memory-comparison-2026-1l1k
- Mem0 — *Graph-Based Memory Solutions for AI Context: Top 5 Compared*: https://mem0.ai/blog/graph-memory-solutions-ai-agents
- *Obsidian MCP Servers — Eight Servers, Three Architectures*: https://chatforest.com/reviews/obsidian-mcp-servers/

## Tutoriales / charlas

- Cole Medin — Graphiti + MCP setup tutorials (YouTube)
- Martin Fowler — *Context Engineering for Coding Agents*: https://martinfowler.com/articles/exploring-gen-ai/context-engineering-coding-agents.html
- LangChain — *Context Engineering for Agents*: https://blog.langchain.com/context-engineering-for-agents/

## Skills relacionados (Claude Code)

Estos skills cubren piezas adyacentes pero no el sistema completo:

- `everything-claude-code:codebase-onboarding` — primera lectura de un repo desconocido (complementa Capa 3)
- `everything-claude-code:iterative-retrieval` — patrón de retrieval progresivo en subagentes
- `everything-claude-code:strategic-compact` — compactación de contexto en puntos lógicos
- `everything-claude-code:context-budget` — auditoría de uso del context window
- `everything-claude-code:architecture-decision-records` — captura de ADRs (pareable con vault)

Ninguno cubre el aislamiento per-project + memoria temporal + grafo estructural unificados — gap que llena este skill.

## Métricas de referencia citadas

- Graphify: 71x reducción tokens (1.7K vs 123K) por query AST vs read-everything
- Mem0: hasta 80% reducción de prompt tokens
- Graphiti: P95 retrieval 300ms, no LLM en query path
- LongMemEval temporal accuracy: Zep/Graphiti 63.8% vs Mem0 49.0% (con GPT-4o)
