# Diretrizes do Projeto — Gerenciador de Projetos

> Documento vivo. Tudo o que foi definido nas decisões de produto e design deve ser
> seguido daqui em diante. Antes de criar ou alterar qualquer tela que envolva
> hierarquia, navegação ou tarefas, **leia este arquivo e mantenha a consistência**.

---

## 1. Princípio central

O produto segue o modelo do **ClickUp**: visual limpo, comercial e consistente.
A regra de ouro é **um só padrão para cada coisa**. Nunca criar uma variação nova de
um componente que já existe (sidebar, painel de tarefas, ícone de tarefa, menus).
Se algo precisa aparecer em mais de um lugar, **reutilize o componente existente**.

---

## 2. Hierarquia (inquebrável)

```
Workspace
└── Espaço            (Space)   — 1º nível
    ├── Pasta         (Folder)  — 2º nível (opcional)
    │   └── Projeto   (Project) — lista de tarefas
    └── Projeto                 — projeto direto no espaço (sem pasta)
```

Regras:

- A seção **"Espaços"** da sidebar contém **somente espaços**. Nunca colocar projetos
  soltos nem o botão "Novo projeto" no topo dessa seção.
- Um **projeto** pode estar: dentro de uma pasta, direto no espaço, ou sem espaço.
- Projetos **sem espaço** aparecem só num grupo discreto **"Sem espaço"** no fim da
  lista — nunca no topo.
- A pasta é **opcional**: o projeto não precisa estar numa pasta.
- Criar projeto **sempre nasce no contexto correto**: o botão "+ Projeto"/"Novo projeto"
  de um espaço cria dentro daquele espaço; o de uma pasta cria dentro da pasta. O modal
  abre com espaço/pasta pré-selecionados (`openNewProject(spaceId?, folderId?)`).
- **Mover** projeto: menu do projeto → "Mover para" → escolher Sem espaço / Espaço / Pasta
  (`moveProject(id, spaceId, folderId)`).

---

## 3. Sidebar (estilo ClickUp)

- Cada **espaço/pasta/projeto** tem ícone:
  - Espaço sem ícone → quadradinho arredondado na cor do espaço com a inicial em branco.
  - Espaço com ícone → emoji sobre fundo tênue da cor do espaço.
  - Pasta sem ícone → ícone de pasta (âmbar); com ícone → emoji.
  - Projeto sem ícone → quadradinho na cor do projeto; com ícone → emoji.
- **Ícones são emoji**, escolhidos pelo `EmojiPicker` (grade curada em `ICON_OPTIONS`,
  com opção "Remover ícone"). Definidos ao criar ou via menu → "Alterar ícone".
- **Chevron à esquerda** = só expandir/recolher. **Clicar no nome** = abrir o painel
  daquele espaço/pasta (`openSpace(id)` / `openFolder(id)`).
- Ações (`+` e `...`) aparecem **no hover**. O item ativo fica destacado (`bg-cu-active`).
- Hierarquia dentro do espaço tem linha-guia vertical à esquerda. Pasta vazia mostra "Vazia".

---

## 4. Painel de tarefas unificado (`TaskPanel`)

**Todo lugar que exibe tarefas usa o mesmo painel** — `components/tasks/TaskPanel.tsx`.
Nunca criar um painel/lista de tarefas próprio numa tela nova.

Já usam o `TaskPanel`: **Espaço, Pasta, Minhas tarefas, Todas as tarefas**.
A página de **Projeto** (`ProjectDetailView`) é a referência rica desse mesmo estilo
(mantém filtros, colunas personalizadas, GUT e visualizações salvas).

O `TaskPanel` oferece:

- Abas: **Overview, Tarefas (lista), Board, Tabela, Calendário, Mapa mental, Atividade, Painéis**
  (via prop `views` dá pra escolher o subconjunto).
- Barra de progresso e contagem de tarefas.
- Controle **"Agrupar por"**: Status, Prioridade, Prazo, Responsável e Projeto
  (Projeto/Responsável só onde fizer sentido — escopos com vários projetos).
- Detalhe da tarefa (`TaskDetail`) ao selecionar.
- A escolha de aba e agrupamento é **lembrada por escopo** (`scopeKey`, em `localStorage`).

Ao criar uma nova tela com tarefas: monte um array de `tasks`, defina `scopeKey`,
`title`, `accent`, `icon` e renderize `<TaskPanel .../>`. Use `key={scopeKey}` quando o
mesmo componente serve a escopos diferentes (ex.: espaços), para remontar e recarregar a preferência.

---

## 5. Ícone de tarefa (regra fechada)

- O **ícone do tipo de tarefa substitui o círculo de status** — nunca um símbolo dentro
  de um círculo com borda.
- Ícones no estilo ClickUp, **cinza neutro `#656f7d`** (`TYPE_ICON_COLOR`):
  Tarefa = círculo; Marco = losango; Anotação = bloco de notas; Erro = inseto;
  Meta = troféu; Objetivo = alvo; Resposta de formulário = prancheta; Solicitação = balão.
- Clicar no ícone **conclui/reabre**; ao passar o mouse mostra ✓ verde; concluída =
  círculo verde com check; nome com `line-through`.
- A setinha discreta ao lado (hover) abre o **seletor de tipo**, que segue o ClickUp:
  campo "Pesquisar...", cabeçalho "Tipos de tarefa", ícones cinza (sem chip colorido),
  "(padrão)" no Tarefa e ✓ no selecionado.
- Mapa de ícones: `TYPE_ICON` em `components/tasks/TaskRow.tsx`. Novos tipos entram lá.

---

## 6. Modelo de dados

Em `src/types/index.ts`:

- `Space { id, name, color, icon?, collapsed, ... }`
- `Folder { id, name, spaceId, icon?, collapsed, ... }`
- `Project { id, name, color, description, icon?, spaceId|null, folderId|null, gut, ... }`
- `Task { id, projectId, parentId|null, title, status, priority, taskType, ... }`

Regras:

- Campos novos opcionais entram com `?` e fallback em `migrateProject` (compatibilidade).
- Persistência via store (`useAppStore`) → `localStorage`. Sempre salvar pelas ações do
  store (`addSpace`, `updateFolder`, `moveProject`, etc.), nunca escrever direto.

---

## 7. Navegação

- `View` inclui `space_detail` e `folder_detail` (além de `project_detail` etc.).
- Estado no store: `activeView`, `activeProjectId`, `activeSpaceId`, `activeFolderId`.
- Ações: `setView(view, projectId?)`, `openSpace(id)`, `openFolder(id)`.
  Cada uma **zera os outros ids** ativos para não vazar contexto.
- Roteamento em `App.tsx` (switch por `activeView`).

---

## 8. Tokens visuais

- **Sidebar (tema escuro)**: `cu-bg`, `cu-hover`, `cu-active`, `cu-border`, `cu-input`,
  `cu-text`, `cu-muted` (ver `tailwind.config.js`).
- **Marca**: paleta `brand-*` (roxo `#7B68EE`).
- **Conteúdo (claro)**: branco com bordas `gray-100/200`, cantos arredondados
  (`rounded-lg`/`rounded-xl`), sombras suaves (`shadow-sm`).
- Cores de status: A fazer `#888780` · Em progresso `#378ADD` · Concluído `#1D9E75`.
- Use sempre os tokens; não cravar cores novas fora dessa paleta sem necessidade.

---

## 9. Componentes-chave (onde mexer)

| Componente | Arquivo | Responsabilidade |
|---|---|---|
| Sidebar | `components/layout/Sidebar.tsx` | Hierarquia, ícones, menus, navegação |
| Painel de tarefas | `components/tasks/TaskPanel.tsx` | Abas/agrupamento/visões — reutilizável |
| Linha de tarefa | `components/tasks/TaskRow.tsx` | Ícone de tipo, status, seletor de tipo |
| Lista | `components/tasks/TaskList.tsx` | Agrupamento da lista |
| Seletor de emoji | `components/ui/EmojiPicker.tsx` | Ícones de espaço/pasta/projeto |
| Espaço/Pasta | `views/SpaceFolderView.tsx` | Telas que abrem ao clicar no nome |
| Store | `stores/useAppStore.ts` | Estado, ações, persistência |

---

## 10. Fluxo de trabalho

- **Não** subir nada para o GitHub automaticamente — o push é **manual**, feito pelo Djemeson.
- Mudança nova deve respeitar este documento. Se contrariar algo aqui, **alinhar antes**
  e, se a decisão mudar, **atualizar este arquivo** na mesma entrega.
- Idioma da interface: **português (Brasil)**.
- Ao terminar, lembrar que a verificação local de build pode falhar por atraso de
  sincronização do OneDrive; quando isso ocorrer, confirmar a integridade relendo os
  arquivos e validar de fato no build do GitHub Actions após o push.

---

## 11. Colunas da lista de tarefas

- "Nome" é fixo à esquerda. As demais colunas (Tags, Responsável, Prazo, Prioridade,
  Projeto e personalizadas) são **reordenáveis por arrastar**, **renomeáveis** (duplo-clique
  no título) e **ordenáveis** (clique no título: 1x crescente, 2x decrescente, 3x desliga).
- Ordem, rótulos e ordenação são **salvos por escopo** (`tf_cols_*`, `tf_collabels_*`,
  `tf_colsort_*` no `localStorage`) via `lib/taskColumns.ts`. Cada lista (projeto, espaço,
  pasta, minhas/todas) tem sua própria configuração através do `scopeKey`.
- A renderização das células é **dirigida pela ordem das colunas** (`ListColumn[]`):
  `TaskRow` e `ColumnHeaders` recebem `orderedColumns` de `TaskList`. Nunca cravar colunas
  no JSX de novo — adicionar tipos de coluna em `taskColumns.ts` + `renderCellContent` do `TaskRow`.
- A caixa de entrada usa o `ColumnHeaders` em **modo legado** (sem reordenar/ordenar) e
  **sem botão de adicionar coluna**.

## 12. Criação contínua

- Em tarefa, subtarefa, checklist e item de checklist: **Enter cria e já abre o próximo
  vazio** (fluxo contínuo). Esc fecha. Vale para `QuickAddRow` e para os inputs do `TaskDetail`.
- A **primeira** checklist de uma tarefa abre com o nome "Checklist" pré-preenchido.

## 13. Caixa de entrada (Inbox)

- O menu "Mover para" mostra **apenas projetos ativos** (não arquivados / que ainda existem).
- Ao mover, a tarefa recebe o projeto e volta para "A fazer".
- Tarefas da caixa de entrada **não aparecem** em "Todas as tarefas" nem "Minhas tarefas"
  (só entram nas listas depois de receberem um projeto).

## 14. Painel da tarefa (TaskDetail)

- Propriedades (Prioridade, Status, Prazo, Responsável) em **grade de 3 por linha**.
- Logo abaixo do nome há **ações rápidas** (+ Subtarefa, + Checklist, + Conteúdo).
- A seção **"Conteúdo" é colapsável**.
- Em modo lateral, o painel abre **grande (≈55% da janela)** e é redimensionável até ~85%.

---

_Última atualização: 20/06/2026._
