# Templates de MOCs y notas

Templates listos para copiar al vault del proyecto. El skill ya pone `00-INDEX.md` y `decisions/ADR-000-template.md` en cada init; estos son adicionales para cuando los necesites.

## context/architecture.md

```markdown
---
tags: [context, architecture]
created: YYYY-MM-DD
---

# Arquitectura — {{PROJECT_NAME}}

## Diagrama de alto nivel
```

[Browser] → [Edge/CDN] → [App] → [DB]
↓
[Workers]

```

## Componentes

### {{Componente 1}}
- Responsabilidad: ...
- Tecnología: ...
- Archivos clave: `src/...`

### {{Componente 2}}
...

## Flujos críticos

- [[context/flow-auth]] — login y sesiones
- [[context/flow-payment]] — pago + webhook + idempotencia
- ...

## Invariantes

- ...
- ...
```

## context/glossary.md

```markdown
---
tags: [context, glossary]
---

# Glosario

Términos del dominio que aparecen en el código y conviene desambiguar.

- **Cliente**: registro en `clients` collection. Puede ser `PersonClient` o `CompanyClient`. NO confundir con "usuario" (`users` collection, sirve para auth).
- **Mantención**: servicio mensual recurrente. Diferente de un "proyecto" (one-shot con fases).
- **Pago**: registro en `payments`. Puede estar vinculado a un proyecto, mantención u "other".
- ...
```

## sessions/YYYY-MM-DD-titulo.md

```markdown
---
date: YYYY-MM-DD
tags: [session]
---

# Sesión: <título>

## Tarea

¿Qué pidió el usuario?

## Capas consultadas

- Memoria: ...
- Grafo: ...
- Notas: ...
- Read: archivos específicos

## Cambios

- `path/file.ts`: ...

## Decisiones

- ...

## Pendientes

- [ ] ...

## Persistido en Graphiti

Sí / No — id del episodio si aplica
```

## decisions/ADR-XXX-titulo.md

Ver `assets/adr-template.md`. Convención de numeración: incremento secuencial (`ADR-001`, `ADR-002`, ...). El template ya está copiado en cada vault como `ADR-000-template.md`.

## Buenas prácticas

1. **Atomic notes**: una idea por archivo. Si una nota crece demasiado, partila y enlazala desde el MOC.
2. **Wiki-links sobre paths**: `[[ADR-001-auth-cookie]]` viaja mejor que `decisions/ADR-001-auth-cookie.md`.
3. **Frontmatter mínimo pero útil**: `status`, `tags`, `created` son suficientes. Más campos = más mantenimiento.
4. **No duplicar lo que ya está en `CLAUDE.md`**: `context/claude-md.md` se importa al init, mantenelo sincronizado pero no lo expandas indefinidamente.
5. **Sessions son efímeras pero útiles**: pasan a memoria episódica vía Graphiti; podés purgar carpetas de sesiones viejas sin perder información, ya está en el grafo.
