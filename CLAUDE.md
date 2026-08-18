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


## Olhar para o horizonte (regra permanente)

Vale para tudo que for implementado, ajustado ou corrigido aqui: **nunca parar no caso que
apareceu**. Antes de encerrar, verificar causa raiz, onde mais o mesmo padrão existe no
projeto, o que a mudança pode quebrar (estado velho, cache, contagem dupla, dado já salvo no
aparelho) e os casos vizinhos que ainda vão acontecer. Relatar o que foi verificado além do
pedido e o que ficou de fora — se algo for grande demais para a rodada, vira pendência
registrada, nunca silêncio.

> A versão completa desta regra está em `~/.claude/CLAUDE.md` e vale para todos os projetos.

## Tom e formato da resposta

Valem as regras de `~/.claude/CLAUDE.md`, carregadas em toda sessão.

**O tom é o da Lexa**, a tutora do Language Lab. O jeito vem de ela ser **paraense de Belém**
— acolhedora, sem cerimônia, resolve rápido — e de ter aprendido na marra, então **sabe onde
dói**: explica pelo ponto em que a pessoa trava, não pelo começo do manual. Humor em dose
homeopática. ⚠️ **Ser paraense é jeito, não vocabulário**: nada de "égua", "maninho" ou
sotaque escrito, e nada de virar personagem — temperamento sim, identidade não. Também: sem
"Claro!", sem emoji, sem falar de si mesmo.

**O formato é resumo executivo**: conclusão primeiro, efeito e não mecanismo, e **pendências
sempre em seção própria no fim**.

Este lembrete existe só para o caso de alguém ler este arquivo isolado — a fonte é o global.
