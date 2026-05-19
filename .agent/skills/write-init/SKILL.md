---
name: write-init
description: Bootstrap "primera vez" del sistema de memoria local para un proyecto. Úsalo cuando el usuario diga "/write-init", "inicializar memoria", "bootstrap vault", "primera vez memoria", "configurar /write en este proyecto", "activar sistema de memoria", "setup memoria local". Complementario a `/write` (documenta episodios) y `/read` (consulta vault). NO confundir con la herramienta Write del editor. Idempotente — si el vault ya existe, verifica estado y puebla lo que falte sin duplicar.
---

# /write-init — bootstrap del sistema de memoria local

Ejecutar UNA VEZ por proyecto la primera vez que se activa la memoria local.

## Workflow

### Paso 1 — Verificar deps del sistema

```bash
bash ~/.claude/skills/persistent-memory-graph/scripts/install-backend.sh
```

Si ya están instaladas, el script lo indica y sale sin cambios.

### Paso 2 — Inicializar el vault del proyecto

```bash
bash ~/.claude/skills/persistent-memory-graph/scripts/init-project.sh
```

Esto crea `.vault/` con MOCs base, mergea `.mcp.json` con `vault-<project>` (mcpvault), agrega `.vault/` al `.gitignore`, importa `CLAUDE.md` como `context/claude-md.md`.

**Detección de idempotencia**: si `.vault/episodes/` ya existe, el vault está inicializado. En ese caso, saltear Paso 2 y pasar directo al Paso 3 (poblar lo que falte).

### Paso 3 — Verificar estado

```bash
bash ~/.claude/skills/persistent-memory-graph/scripts/check-status.sh
```

### Paso 4 — Poblar vault con historia del proyecto

Solo si el proyecto tiene historial rico y `.vault/episodes/` está vacío (o tiene < 3 episodios).

**4a. Leer fuentes disponibles** (en paralelo, solo las que existan):

- `git log --oneline -50` — historia de commits
- `CLAUDE.md` — arquitectura, decisiones, gotchas
- `docs/` o `MEJORAS.md`, `AUDIT-*.md` si existen

**4b. Crear episodios iniciales** (5-10 episodios, uno por área temática):

Para cada episodio usar la fecha del commit más representativo del área (de `git log`). Nunca inventar fechas.

Ejemplo de episodio desde git log:

```markdown
---
date: 2026-02-13   ← fecha del commit relevante
time: 00:00 UTC
tags: [episode, auth, bootstrap]
files: [src/lib/firebase/auth.ts, functions/src/middleware/auth.ts]
---

# Sistema de auth con Google Sign-In + session cookie httpOnly

## Tarea

Historia inicial del sistema: Google Sign-In → ID token → POST /api/auth/session → cookie \_\_session (httpOnly). Custom claims { role, clientId }.

## Contexto consultado

- Read: CLAUDE.md sección Autenticación

## Decisiones tomadas

Cookie llamada \_\_session (obligatorio para Firebase Hosting forwarding). En producción no hay middleware Next.js — la seguridad está en Cloud Functions Express middleware.

## Bugs / gotchas encontrados

onAuthStateChanged dispara ANTES de que la cookie exista durante sign-in → race condition. Fix: isInitialCheck flag en auth-context.tsx. window.location.reload() requerido post-login (no router.push).
```

**4c. Crear ADRs iniciales** para decisiones de arquitectura visibles en CLAUDE.md:

Candidatos típicos: static export + Cloud Functions, dual API code (dev vs prod), Firebase \_\_session cookie, MercadoPago PreApproval sin planes, client discriminated union.

**4d. Actualizar `00-INDEX.md`** en el vault con lista de episodios y ADRs creados.

Todos los archivos se escriben via `vault-<project>.write_note(path, content)`.

### Paso 5 — Reportar al usuario

Informar:

- Qué se creó (vault path, episodios, ADRs)
- Si ya estaba inicializado, qué se agregó
- **Recordar reiniciar Claude Code** para que cargue el `.mcp.json` actualizado

## Anti-patrones

- No sobrescribir vault existente ni episodios ya creados
- No duplicar episodios si se re-ejecuta — verificar con `vault-<project>.list("episodes")` antes de escribir
- No inventar fechas — usar `git log` como fuente de verdad
- No crear episodios por cada commit — agrupar por área temática (auth, payments, UI, etc.)
- No poblar si `.vault/episodes/` ya tiene contenido sustancial (> 5 episodios)
