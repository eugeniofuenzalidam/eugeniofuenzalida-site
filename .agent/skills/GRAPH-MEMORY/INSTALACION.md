# INSTALACIÓN — Skills de Memoria Local para Claude Code

> **Para el usuario humano**: abrí Claude Code en cualquier carpeta y decile:
> _"Leé el archivo `INSTALACION.md` de esta carpeta y ejecutá la instalación completa."_
> Claude se encarga del resto.
>
> **Para Claude Code**: este archivo es un instructivo ejecutable. Seguí los pasos en orden. No salteés verificaciones. Reportá cada paso al usuario en una línea.

---

## Qué es esto

Un sistema de **memoria persistente para Claude Code**, 100% local:

- **Sin Docker**, sin servicios corriendo en background.
- **Sin APIs externas**, sin OpenAI/Anthropic API key extra, sin costos recurrentes.
- **Sin LLMs en background** — vos (Claude) sos quien redacta los episodios.
- Todo es **Markdown en disco** + un MCP server (`mcpvault`) que expone esos Markdown.

Arquitectura final:

```
~/.claude/skills/               ← instalación GLOBAL (una sola vez por máquina)
    read/                       ← /read    — consultar memoria
    write/                      ← /write   — persistir lo aprendido
    write-init/                 ← /write-init — inicializar memoria en UN proyecto
    persistent-memory-graph/    ← scripts y templates compartidos

<cada-proyecto>/.vault/         ← memoria AISLADA por proyecto
    00-INDEX.md                 ← Map of Content raíz
    episodes/                   ← qué pasó, cuándo, qué archivos se tocaron
    decisions/                  ← ADRs (decisiones de arquitectura)
    context/                    ← snapshot de CLAUDE.md, etc.
    sessions/                   ← notas de sesión por fecha
<cada-proyecto>/.mcp.json       ← entrada `vault-<proyecto>` agregada acá
```

**Punto clave**: los skills se instalan UNA VEZ a nivel global (`~/.claude/skills/`) y funcionan en **todos** los proyectos. Pero cuando documentás con `/write`, la documentación va al `.vault/` del proyecto donde estés parado — completamente aislada de los otros proyectos. Cada proyecto tiene su propia memoria.

---

## Pre-requisitos

Antes de empezar, verificá que estos 3 comandos respondan:

```bash
command -v claude && command -v npx && command -v jq
```

Si alguno falta, instalarlo:

| Falta    | Linux (Debian/Ubuntu)               | macOS (Homebrew)    | Windows        |
| -------- | ----------------------------------- | ------------------- | -------------- |
| `claude` | https://docs.claude.com/claude-code | igual               | usar WSL2      |
| `npx`    | `sudo apt install nodejs npm`       | `brew install node` | dentro de WSL2 |
| `jq`     | `sudo apt install jq`               | `brew install jq`   | dentro de WSL2 |

> **Windows**: el sistema usa scripts bash. Se requiere WSL2 (Ubuntu adentro). En Windows nativo no funciona.

No hace falta Docker, ni Python, ni API keys de ningún tipo.

---

## Instalación paso a paso (Claude ejecuta esto)

### Paso 0 — Confirmar la ubicación de esta carpeta

Esta carpeta (`skills-memoria-local/`) puede estar en cualquier lado: `~/Desktop`, `~/Downloads`, un pendrive, etc. Detectá su ruta absoluta:

```bash
# La ruta real de la carpeta que contiene este INSTALACION.md
SRC="$(cd "$(dirname "INSTALACION.md")" && pwd)"
echo "Origen: $SRC"
```

Si Claude no puede inferirla automáticamente, preguntale al usuario:

> "¿Dónde está la carpeta `skills-memoria-local`? Pegá la ruta absoluta."

Verificá que adentro estén las 4 subcarpetas esperadas:

```bash
ls "$SRC" | grep -E '^(read|write|write-init|persistent-memory-graph)$' | wc -l
# Debe imprimir: 4
```

Si imprime menos de 4, **parar** y avisar al usuario que la carpeta está incompleta.

### Paso 1 — Verificar dependencias del sistema

```bash
for cmd in claude npx jq bash; do
  if command -v "$cmd" >/dev/null 2>&1; then
    echo "[OK]   $cmd"
  else
    echo "[FAIL] $cmd NO instalado"
  fi
done
```

Si algo dice `[FAIL]`, **parar** y pedirle al usuario que lo instale (ver tabla de pre-requisitos arriba). No seguir hasta que los 4 estén OK.

### Paso 2 — Copiar los 4 skills a `~/.claude/skills/` (instalación GLOBAL)

```bash
mkdir -p ~/.claude/skills

# Si alguno ya existe, preguntar antes de sobrescribir.
for skill in read write write-init persistent-memory-graph; do
  if [ -d "$HOME/.claude/skills/$skill" ]; then
    echo "[WARN] ~/.claude/skills/$skill ya existe — preguntar al usuario antes de sobrescribir"
  fi
done
```

Si hay warnings, preguntale al usuario:

> "Ya existe `~/.claude/skills/<nombre>`. ¿Lo sobrescribo? (sí/no/backup)"

Opciones:

- **sí** → `rm -rf` y copiar encima.
- **backup** → renombrar a `<nombre>.bak-YYYYMMDD` antes de copiar.
- **no** → saltar ese skill (NO recomendado — los 4 deben quedar consistentes).

Copia efectiva:

```bash
cp -r "$SRC/read"                    ~/.claude/skills/
cp -r "$SRC/write"                   ~/.claude/skills/
cp -r "$SRC/write-init"              ~/.claude/skills/
cp -r "$SRC/persistent-memory-graph" ~/.claude/skills/
```

### Paso 3 — Permisos de ejecución a los scripts

```bash
chmod +x ~/.claude/skills/persistent-memory-graph/scripts/*.sh
```

### Paso 4 — Verificación con el script oficial

```bash
bash ~/.claude/skills/persistent-memory-graph/scripts/install-backend.sh
```

Esperás que imprima `[OK] jq y npx disponibles` y `[OK] mcpvault accesible vía npx` (o un `[WARN]` no fatal si no hay internet — la descarga real ocurre al primer `/write-init`).

### Paso 5 — Sanity check final

```bash
ls ~/.claude/skills/ | grep -E '^(read|write|write-init|persistent-memory-graph)$' | wc -l
# Debe imprimir: 4

ls ~/.claude/skills/persistent-memory-graph/scripts/*.sh | wc -l
# Debe imprimir: 6 (init-project, init-vault, init-vault-mcp, install-backend, check-status, init-graphiti)
```

### Paso 6 — Reportar al usuario

Mostrar este resumen exacto:

```
✓ Instalación global completa

  Skills instalados en ~/.claude/skills/ :
    • read                      → slash command /read
    • write                     → slash command /write
    • write-init                → slash command /write-init
    • persistent-memory-graph   → scripts y templates compartidos

  Dependencias verificadas:
    • jq, npx, bash, claude — todos OK

Próximos pasos:

  1. CERRÁ Y VOLVÉ A ABRIR Claude Code. Los skills se cargan al arrancar.

  2. En cada proyecto donde quieras activar memoria local:
       cd <ruta-del-proyecto>
       claude
       > /write-init
     (UNA vez por proyecto. Después reiniciar Claude para cargar el .mcp.json.)

  3. Uso diario en cualquier proyecto ya inicializado:
       /read   ← al EMPEZAR una tarea no trivial
       /write  ← al TERMINAR (persiste episodio + ADR si corresponde)
```

---

## Cómo funciona el aislamiento por proyecto

Esta es la pregunta importante: **los skills son globales, pero la memoria es por-proyecto**.

| Capa                                      | Dónde vive                                          | Alcance                                         |
| ----------------------------------------- | --------------------------------------------------- | ----------------------------------------------- |
| Skills (`/read`, `/write`, `/write-init`) | `~/.claude/skills/`                                 | **Global** — disponibles en TODOS los proyectos |
| Scripts auxiliares                        | `~/.claude/skills/persistent-memory-graph/scripts/` | **Global**                                      |
| Vault de memoria                          | `<proyecto>/.vault/`                                | **Aislado por proyecto**                        |
| MCP `vault-<proyecto>`                    | `<proyecto>/.mcp.json`                              | **Aislado por proyecto**                        |
| `.gitignore` con `.vault/`                | `<proyecto>/.gitignore`                             | **Aislado por proyecto**                        |

Lo que esto significa en la práctica:

- Instalás **una vez** este sistema (este archivo).
- En cada proyecto donde quieras memoria, hacés `/write-init` **una vez** (crea `.vault/`, mergea `.mcp.json`, agrega a `.gitignore`).
- Al usar `/write` dentro de un proyecto, los episodios van **solo** al `.vault/` de ese proyecto.
- Al usar `/read`, Claude consulta **solo** el vault del proyecto actual. Cero contaminación cruzada entre proyectos.
- El `.vault/` queda fuera de git por default (los Markdown son notas personales/de sesión, no documentación del repo).

---

## Los 3 slash-commands en uso diario

### `/write-init` — una vez por proyecto

Bootstrap de la memoria en un proyecto nuevo. Crea `.vault/`, mergea `.mcp.json`, importa `CLAUDE.md` si existe, y opcionalmente pobla 5-10 episodios iniciales leyendo `git log`. Idempotente: si ya está inicializado, solo agrega lo que falte.

### `/read` — al empezar una tarea

Antes de leer código directo, Claude consulta:

1. El vault (`.vault/episodes/`, `.vault/decisions/`, `.vault/context/`).
2. El grafo estructural si hay `code-review-graph` MCP activo.
3. Solo entonces lee archivos (idealmente ≤5).

Reduce 60-80% el consumo de tokens vs leer código directo.

### `/write` — al terminar una tarea

Persiste lo aprendido:

- Episodio en `.vault/episodes/YYYY-MM-DD-HHmm-<slug>.md` — siempre.
- ADR en `.vault/decisions/ADR-XXX-<slug>.md` — solo si fue decisión de arquitectura.
- Actualiza `.vault/00-INDEX.md` con la nueva entrada (obligatorio — sin esto la próxima sesión no encuentra el episodio).

---

## Troubleshooting

| Síntoma                                               | Causa probable                         | Solución                                                          |
| ----------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| `/read`, `/write` no aparecen como slash-commands     | Claude Code no recargó skills          | Cerrar y reabrir Claude Code completo                             |
| `/write-init` corre pero el vault no funciona después | `.mcp.json` no recargado               | Reiniciar Claude Code después de `/write-init`                    |
| `npx -y @bitbonsai/mcpvault` falla                    | Sin internet o npm registry caído      | `npm config get registry` debe responder; reintentar con conexión |
| `jq: command not found` (macOS)                       | jq no instalado                        | `brew install jq`                                                 |
| Scripts `.sh` no ejecutan ("permission denied")       | Falta `chmod +x`                       | Repetir el Paso 3                                                 |
| Windows nativo no funciona                            | Los scripts son bash                   | Usar WSL2 (Ubuntu adentro)                                        |
| `vault-<proyecto>` no aparece en el MCP de Claude     | `.mcp.json` mal formado o no recargado | `jq . <proyecto>/.mcp.json` para validar, luego reiniciar Claude  |

---

## Anti-patrones

- **Editar archivos directamente en `~/.claude/skills/`** → si querés modificar algo, copiá el skill afuera, editá ahí, y reinstalá. Los cambios in-place se pueden perder en futuras reinstalaciones.
- **Versionar `.vault/` en git** → ya está en `.gitignore` por default. Las notas son personales/de sesión; si querés compartir decisiones con el equipo, ponelas en `docs/` del repo (no en `.vault/`).
- **Correr `/write-init` desde el directorio incorrecto** → el script usa `git rev-parse --show-toplevel` o `pwd`. Verificá que estés en la raíz del proyecto antes de invocarlo.
- **Olvidar reiniciar Claude Code** después de instalar o después de `/write-init` → es la causa #1 de "no me funciona". Los `.mcp.json` se leen UNA vez al arrancar.
- **Compartir el `.vault/` entre proyectos** → rompe el aislamiento. Cada proyecto debe tener el suyo.

---

## Estructura de archivos de este paquete

```
skills-memoria-local/
├── INSTALACION.md                   ← este archivo
├── read/
│   └── SKILL.md
├── write/
│   └── SKILL.md
├── write-init/
│   └── SKILL.md
└── persistent-memory-graph/
    ├── SKILL.md
    ├── scripts/
    │   ├── install-backend.sh       ← verifica deps
    │   ├── init-project.sh          ← bootstrap per-project
    │   ├── init-vault.sh            ← crea .vault/
    │   ├── init-vault-mcp.sh        ← mergea .mcp.json
    │   ├── check-status.sh          ← reporta estado
    │   └── init-graphiti.sh         ← legacy (modo Graphiti con Docker, no se usa por default)
    ├── assets/
    │   ├── moc-index.md             ← template del 00-INDEX.md
    │   ├── adr-template.md          ← template de ADRs
    │   └── docker-compose.yml       ← solo si se quiere modo Graphiti (opcional)
    └── references/
        ├── read-protocol.md
        ├── moc-templates.md
        ├── troubleshooting.md
        ├── lite-mode.md
        └── community-sources.md
```

---

## Para Claude: criterio de éxito

La instalación está completa cuando:

1. `ls ~/.claude/skills/ | grep -E '^(read|write|write-init|persistent-memory-graph)$' | wc -l` imprime `4`.
2. `bash ~/.claude/skills/persistent-memory-graph/scripts/install-backend.sh` termina sin `[ERROR]`.
3. Los scripts en `~/.claude/skills/persistent-memory-graph/scripts/` son ejecutables (`ls -l` muestra `x`).
4. El usuario confirma que reinició Claude Code.

Después de esto, NO seguir tocando nada. La activación per-proyecto es responsabilidad de `/write-init`, ejecutado por el usuario dentro de cada repo que quiera tener memoria.
