# CLAUDE.md

> Instruções carregadas automaticamente neste projeto.

## Regra obrigatória

**Antes de qualquer alteração, leia e siga `DIRETRIZES.md` (na raiz).**
Ele é a fonte da verdade sobre hierarquia (Espaço → Pasta → Projeto), painel de
tarefas unificado (`TaskPanel`), ícones de tarefa estilo ClickUp, convenções da
sidebar, modelo de dados, navegação e tokens visuais.

Nunca criar uma variação nova de um componente que já existe — reutilize o existente.
Se uma decisão precisar mudar, **atualize `DIRETRIZES.md` na mesma entrega**.

## Lembretes rápidos

- **Publicar é sempre nos dois** (regra desde 29/07/2026, substitui o "push manual"):
  o que vai para o GitHub vai para a Vercel e vice-versa. Na prática é um movimento só —
  a Vercel faz deploy de produção a cada push na `main` —, então **nunca deixar um commit
  parado no local** depois de uma entrega aprovada, e conferir o deploy depois do push.
- Interface sempre em **português (Brasil)**.
- A verificação local de build pode falhar por atraso de sincronização do OneDrive;
  quando ocorrer, confirmar integridade relendo os arquivos e validar no build do
  GitHub Actions após o push.
