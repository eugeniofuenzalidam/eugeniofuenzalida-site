---
name: write
description: Documenta y persiste en el vault local lo aprendido al terminar una tarea — episodios, decisiones, bugs, razones. Úsalo SIEMPRE al final de cualquier tarea no trivial, antes de cerrar la sesión, antes de hacer commit, o cuando el usuario diga "/write", "documentá", "guardá esto", "anota", "comentá", "persiste", "que no se pierda", "que la próxima sesión sepa". Sin esto, la memoria queda vacía y `/read` no funciona en sesiones futuras. NO confundir con la herramienta Write del editor — esto escribe Markdown estructurado en `<project>/.vault/`, no archivos arbitrarios. Stack 100% local, sin APIs externas, sin LLMs en background — vos (Claude) sos quien redacta y estructura el episodio.
---

# /write — documentar al terminar

Al cerrar una tarea, escribí dos tipos de archivo en el vault:

1. **Episodio** (siempre) → `episodes/YYYY-MM-DD-HHmm-<slug>.md`
2. **ADR** (solo si fue decisión de arquitectura) → `decisions/ADR-XXX-<slug>.md`

Ambos van vía `vault-<project>.write_note(...)`.

## 1. Episodio — SIEMPRE

Path: `episodes/YYYY-MM-DD-HHmm-<slug-corto>.md`

### Plantilla

```markdown
---
date: YYYY-MM-DD
time: HH:MM UTC
tags: [episode, <feature-area>, <bug|feature|refactor|review>]
files: [path/to/file1.ts, path/to/file2.ts]
---

# <Resumen 1 línea, imperativo>

## Tarea
Qué pidió el usuario (1-2 frases).

## Contexto consultado
- Vault: <qué notas leíste>
- Grafo: <qué nodos consultaste>
- Read: <archivos efectivamente leídos>

## Cambios
- `path/file.ts:142-178`: descripción breve
- `path/other.ts`: ...

## Decisiones tomadas
Qué elegiste hacer y POR QUÉ — lo que NO se ve en el diff.
- ...

## Bugs / gotchas encontrados
Cualquier cosa rara que la próxima sesión querría saber.
- ...

## Pendientes
- [ ] ...
```

### Ejemplo

```markdown
---
date: 2026-05-03
time: 11:42 UTC
tags: [episode, payments, bug]
files: [functions/src/routes/webhooks.ts]
---

# Fix idempotencia webhook MercadoPago

## Tarea
"Pagos duplicados desde el webhook MP".

## Contexto consultado
- Vault: episodes/ no había precedente
- Grafo: callers_of("processWebhookPayment") → 1 caller en webhooks.ts

## Cambios
- `functions/src/routes/webhooks.ts:142-178`: envolví el chequeo de existencia + create en `runTransaction`.

## Decisiones tomadas
Race condition entre dos webhooks idénticos llegando en <100ms — el chequeo de `mercadoPagoId` y el create no estaban en transacción. Fix mínimo en el handler, no agregué locks externos.

## Bugs / gotchas encontrados
El campo `payerEmail` viene `undefined` cuando MP no propaga el email — ya documentado en CLAUDE.md, manejar con default vacío en el normalize.

## Pendientes
- [ ] Agregar índice compuesto `(mercadoPagoId, type)` — no urgente, va en otra PR.
```

## 2. ADR — solo si es decisión de arquitectura

¿Cambiaste cómo funciona el sistema (no un bugfix puntual)? Path: `decisions/ADR-XXX-<slug>.md`

Numerar secuencialmente: buscá el último `ADR-NNN` en `decisions/` con `vault-<project>.list("decisions")` y +1.

Aplicá el template `~/.claude/skills/persistent-memory-graph/assets/adr-template.md`.

### Cuándo SÍ ADR
- Elegiste una librería/patrón sobre alternativas
- Cambiaste un contrato (esquema DB, formato API, formato de cookie)
- Definiste convención que otros archivos van a seguir
- Tradeoff explícito que vale la pena registrar

### Cuándo NO
- Bugfix puntual (eso va solo en `episodes/`)
- Refactor sin cambio de comportamiento
- Cambio cosmético

## 3. Actualizá `00-INDEX.md` — OBLIGATORIO

**Sin este paso, el episodio queda huérfano del MOC y `/read` no lo descubre en sesiones futuras** (lee el INDEX, no escanea `episodes/` entero). Es la causa #1 del síntoma "estoy alucinando / hago todo de nuevo" — el archivo existe pero ninguna sesión nueva lo encuentra.

### Para episodios

Editá `00-INDEX.md`, sección `## Episodios`. Insertá la línea **en orden cronológico** (cronológico ascendente — el más reciente va al final de la sección):

```
- [[episodes/YYYY-MM-DD-HHmm-<slug>]] — <una línea ≤140 chars: qué se hizo + por qué importa + IDs/archivos clave>
```

**Reglas para la descripción:**
- Keywords concretos (nombres de archivos, IDs, errores específicos) — la línea es buscable con grep
- Nunca genérica ("arreglé un bug", "fix import") — inútil para búsqueda
- Si supersede a un episodio anterior, agregá `(supersede 2026-MM-DD-slug)` al final
- Si el episodio cierra un bloqueante, mencionalo: `→ desbloquea X`

### Para ADRs

Sección `## Decisiones (ADRs)`:

```
- [[decisions/ADR-XXX-<slug>]] — <título corto> · <estado: aceptado / reemplazado por ADR-YYY / descartado>
```

### Para notas fijas (landscape, status, inventory)

Si la información es **persistente y consultable** (no un evento puntual: ej. "inventario de las 3 apps Meta existentes", "credenciales", "endpoints de prod"), va en `context/` o como nota fija con prefijo `state-` o `inventory-`, y se enlaza en `## Contexto` del INDEX. NO va en episodios.

### Verificación obligatoria al cerrar

Antes de declarar "/write completo":

```bash
ls .vault/episodes/*.md | grep -v README | wc -l   # episodios físicos
grep -c "\[\[episodes/" .vault/00-INDEX.md          # enlazados en INDEX
```

**Los dos números deben coincidir.** Si difieren, el INDEX está rezagado — agregá las entradas faltantes antes de cerrar. Es trivial detectarlo y obligatorio resolverlo.

## 4. Verificá que se guardó

```
vault-<project>.list("episodes")
```
El archivo recién creado debería aparecer. Si no, revisá que el MCP `vault-<project>` esté activo (`/read` con cualquier query falla si no lo está).

## Anti-patrones

- "El cambio se ve en el diff, no hace falta guardarlo" → el diff no captura *por qué*. La próxima sesión no lo va a deducir.
- Episodios genéricos ("arreglé un bug") → inútiles para búsqueda. Sé específico.
- Persistir cada cambio trivial → ruido. Saltá tareas triviales (typo, formato).
- Olvidar el ADR cuando corresponde → la decisión queda solo en `episodes/` (orden cronológico, difícil de encontrar).
- **Escribir episodio pero NO actualizar `00-INDEX.md`** → la próxima sesión empieza ciega al trabajo nuevo, repite tareas ya hechas. Es la causa más común del "haces todo de nuevo cada vez".
- Mezclar inventario persistente (ej. "estado actual de las apps Meta") dentro de un episodio fechado → queda enterrado. Va en `context/` o nota fija.

## Setup necesario

Igual que `/read` — `vault-<project>` activo en `.mcp.json`. Verificá con:
```bash
bash ~/.claude/skills/persistent-memory-graph/scripts/check-status.sh
```
