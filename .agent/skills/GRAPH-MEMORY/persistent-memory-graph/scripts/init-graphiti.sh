#!/usr/bin/env bash
# DEPRECATED — el stack actual NO usa Graphiti.
# Este script existe solo para compatibilidad con init-project.sh viejo.
# Ahora delega a init-vault-mcp.sh.
exec bash "$(dirname "$0")/init-vault-mcp.sh" "$@"
