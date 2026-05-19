# Protocolo de lectura — referencia detallada

Esta es la referencia ampliada del flujo descrito en `SKILL.md`. Léela cuando necesites entender cómo combinar las 3 capas en una tarea concreta.

## El principio

> "Re-leer archivos en cada sesión es el desperdicio de tokens más caro que existe en agentes LLM. Memoria episódica + grafo estructural + lectura selectiva reduce 60-80% el consumo de contexto sin perder calidad."
> — Adaptado de Anthropic Engineering, *Effective context engineering for AI agents* (2025)

El código fuente es la verdad última, pero releerlo entero es como abrir un diccionario para recordar una palabra que ya buscaste ayer. La memoria episódica recuerda qué buscaste; el grafo estructural te dice exactamente qué página abrir.

## Pseudocódigo expandido

```python
def read_protocol(task: str) -> Plan:
    # === Capa 1: Memoria episódica ===
    nodes = graphiti.search_memory_nodes(query=task, limit=10)
    facts = graphiti.search_memory_facts(query=task, limit=10)

    if covers_completely(nodes + facts, task):
        # Decisión ya documentada → ejecutar sin re-investigar
        return plan_from_memory(nodes, facts)

    relevant_modules = extract_modules_mentioned(nodes + facts)

    # === Capa 2: Grafo estructural ===
    targets = []
    for module in relevant_modules or guess_modules_from(task):
        targets += code_graph.semantic_search_nodes(module)

    if task_requires_change():
        for t in targets:
            t.impact = code_graph.get_impact_radius(t.id)
            t.flows = code_graph.get_affected_flows(t.id)

    files_to_read = top_k_files_by_relevance(targets, k=3)

    # === Capa 3: Notas y MOCs (paralelo si la tarea es de diseño) ===
    if is_design_task(task) or is_onboarding(task):
        moc = vault.read("00-INDEX.md")
        adrs = vault.search_notes(folder="decisions/", query=task)

    # === Capa 4: Código fuente ===
    if len(files_to_read) > 5:
        # Tarea mal acotada — pedir al usuario que aclare
        return ask_for_scope_clarification()

    sources = [Read(f) for f in files_to_read]

    # === Trabajar ===
    result = execute_changes(sources, plan)

    # === Persistir ===
    graphiti.add_memory(
        name=summarize(task, result),
        episode_body=detail(task, files_changed=files_to_read,
                            decisions=result.decisions, why=result.rationale),
        source="text"
    )
    if is_architectural_decision(result):
        vault.write(
            f"decisions/ADR-{next_adr_number()}-{slug(task)}.md",
            adr_template(result)
        )

    return result
```

## Ejemplos por tipo de tarea

### "Implementa rate limiting en /api/users"

1. **Capa 1**: `search_memory_facts("rate limit api")` → recupera episodio "Implementamos express-rate-limit el 12 feb, configurado en `functions/src/app.ts`, límites: 300/15min global, 50/15min auth".
2. **Saltar Capa 2 parcialmente**: ya sabemos el archivo objetivo.
3. **Read selectivo**: leer solo `functions/src/app.ts` (1 archivo, no todo `functions/src/`).
4. **Edit**: agregar middleware específico para `/api/users`.
5. **Persistir**: `add_memory("Rate limiting users-specific aplicado, 100/15min", body=..., source="text")`.

**Sin protocolo**: hubieras leído ~5 archivos de `functions/src/routes/`, `app.ts`, middleware, y aún así habrías necesitado preguntar dónde están los rate limits actuales. Tokens ahorrados: ~15-20K.

### "Bug: pagos duplicados en webhook MP"

1. **Capa 1**: `search_memory_facts("webhook mercadopago duplicate idempotencia")` → "Webhook valida `mercadoPagoId` antes de crear payment (idempotencia). Implementado en `functions/src/routes/webhooks.ts`".
2. **Capa 2**: `query_graph(callers_of="processWebhookPayment")` → 1 caller en `webhooks.ts`. `get_impact_radius` → toca `payments` collection y `subscriptions`.
3. **Read selectivo**: `webhooks.ts`.
4. **Investigar**: leer la transacción Firestore, verificar que `runTransaction` esté envolviendo el chequeo de idempotencia + creación.
5. **Persistir**: si encontraste el bug, `add_memory` con root cause + fix.

### "Refactor: separar PersonClient de CompanyClient en módulos distintos"

1. **Capa 1**: `search_memory_nodes("client discriminated union")` → "Usamos `Client = PersonClient | CompanyClient`, type guards en `src/lib/normalize-client.ts`. Migración legacy todavía activa (1-2 deploys post-migración)".
2. **Capa 3**: `vault.read("decisions/")` → buscar ADR sobre client split. Si no existe → CREARLO ANTES de empezar (decisión grande).
3. **Capa 2**: `get_impact_radius("Client")` → 30+ archivos. Esto es un refactor grande, no una tarea atómica.
4. **STOP y discutir con usuario**: el grafo te dice que el blast radius es enorme. Pedir confirmación de scope antes de tocar código.
5. **Persistir ADR primero, código después**: el ADR es el contrato; el código lo implementa.

## Cuándo NO seguir el protocolo

- **Tareas triviales** (typo en mensaje de error, cambio de copy en un botón): leé directo y editá.
- **Investigación pura**: el usuario pregunta "cómo funciona X" — Capa 1 + Capa 3 (notas) suelen bastar sin Capa 2/4.
- **Primera sesión de un proyecto sin memoria todavía**: el grafo y el vault están vacíos. Caes a Read normal pero **persistí lo que aprendas** para que la próxima sesión funcione.

## Métricas para saber si funciona

| Métrica | Antes (sin skill) | Después (con skill bien usado) |
|---|---|---|
| `Read` calls antes del primer `Edit` | 5-15 | ≤3 |
| Tokens consumidos por tarea de mantenimiento | 30-80K | 8-25K |
| Tareas que requieren preguntar contexto al usuario | ~40% | <10% |
| Tiempo entre prompt → primer `Edit` útil | varía | reducido proporcionalmente |

Si tras 5-10 tareas no ves estos números mejorar, revisar `troubleshooting.md`. La causa más común: el agente no está ejecutando el paso 6 (persistir), así que la memoria nunca se llena.
