# Troubleshooting

## El backend no arranca

### `docker compose up` falla con "port already in use"
Puerto 6379 ocupado por Redis local. Opciones:
- Parar Redis local: `sudo systemctl stop redis`
- Cambiar el puerto en `~/.graphiti/docker-compose-shared.yml` (ej: `6380:6379`) y actualizar `FALKORDB_URI` en cada `.mcp.json` del proyecto a `redis://localhost:6380`.

### `falkordb-graphiti` se reinicia en loop
```bash
docker logs falkordb-graphiti
```
Causa común: permisos del directorio `~/.graphiti/data`. Solución:
```bash
sudo chown -R $USER:$USER ~/.graphiti/data
docker compose -f ~/.graphiti/docker-compose-shared.yml restart
```

## `.mcp.json` no recarga

Claude Code lee `.mcp.json` SOLO al arrancar. Después de correr `init-project.sh`:
1. Cerrar la sesión de Claude Code (Ctrl+C en el TTY o cerrar la app)
2. Reabrir: `claude` o relanzar la app
3. El status bar debería listar `graphiti-memory` y `vault-<project>` como MCPs activos

Si los MCPs no aparecen tras reiniciar:
- Validá JSON: `jq . .mcp.json` no debe dar error
- Mirá los logs: `~/.claude/logs/` (varía por plataforma)

## El agente no encuentra contexto en Graphiti

Causas, en orden de probabilidad:

1. **Memoria vacía** — proyecto recién inicializado, todavía no hay episodios. Solución: persistir activamente al final de cada tarea (paso 6 del protocolo).
2. **`group_id` mal configurado** — el server arrancó con `--group-id main` por default. Verificá:
   ```bash
   jq '.mcpServers["graphiti-memory"].args' .mcp.json
   ```
   Debe contener `["--group-id", "<nombre-del-proyecto>"]`.
3. **OPENAI_API_KEY ausente** — Graphiti usa OpenAI para extraer entidades al ingerir. Sin key, los `add_memory` fallan silenciosamente. `echo $OPENAI_API_KEY` debe imprimir algo.
4. **FalkorDB caído** — `docker ps | grep falkordb`. Si no aparece, `docker compose -f ~/.graphiti/docker-compose-shared.yml up -d`.

## Group_id duplicado entre proyectos

Si dos directorios distintos se llaman igual (ej: clonaste `simulatore` dos veces), el `basename` colisiona. Soluciones:
- Renombrá uno de los directorios
- O editá manualmente `--group-id` en uno de los `.mcp.json` con un sufijo (`simulatore-fork`)

## Vault MCP server no responde

`mcpvault` requiere `npx -y @bitbonsai/mcpvault@latest` con acceso a internet la primera vez. Si Claude Code falla al inicializar:
```bash
npx -y @bitbonsai/mcpvault@latest --help
```
debe responder. Si no:
- Verificá conexión a registry de npm
- Forzá una versión: cambiá `@latest` por una específica en `.mcp.json`

## Quiero empezar de cero en un proyecto

```bash
cd <proyecto>
bash ~/.claude/skills/persistent-memory-graph/scripts/purge-project.sh <nombre-proyecto>
rm -rf .vault
# Editá .mcp.json y remové las entradas graphiti-memory + vault-<project>
# (o eliminá .mcp.json entero si no tenés otros MCPs)
bash ~/.claude/skills/persistent-memory-graph/scripts/init-project.sh
# Reiniciá Claude Code
```

## Migrar el vault a un nombre/path diferente

Si querés mover el vault de `.vault/` a otra ubicación:
1. Mover físicamente: `mv .vault ~/ObsidianVaults/MyProject`
2. Editar `.mcp.json` y actualizar el path en `vault-<project>.args`
3. Actualizar `.gitignore` si corresponde
4. Reiniciar Claude Code
