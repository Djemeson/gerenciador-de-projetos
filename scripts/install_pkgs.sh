#!/bin/bash
# Instala as dependências do projeto no início de uma sessão do Claude Code na nuvem
# (web / app do celular). Sai imediatamente em sessões locais: no PC do Djemeson o
# node_modules já existe e reinstalar a cada sessão só atrasaria a abertura.
#
# Ligado pelo hook SessionStart em .claude/settings.json.

if [ "$CLAUDE_CODE_REMOTE" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || exit 0

# Já instalado (cache do ambiente de nuvem) — não refaz.
if [ -d node_modules/vite ]; then
  exit 0
fi

# npm ci respeita o package-lock.json; se ele estiver fora de sincronia, cai pro install.
npm ci --no-audit --no-fund || npm install --no-audit --no-fund

exit 0
