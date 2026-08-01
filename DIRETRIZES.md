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

## 3. Sidebar (redesign 07/2026 — pílulas + workspaces)

> A partir do redesign de 07/2026 (importado de um protótipo Claude Design), a sidebar
> trocou o visual "cards" do ClickUp por um estilo mais próximo de Linear/Notion: nav
> primário em **pílulas** (`rounded-full`), cabeçalho de espaço com **tinta de fundo
> permanente** na cor do espaço, badges em **degradê**, e um seletor de **workspace**
> no topo. Continua reutilizando os mesmos componentes únicos (`TaskPanel`, etc.).

- **Nav primário e Espaços são mutuamente exclusivos** (15/07/2026, fidelidade ao
  protótipo): dois botões logo abaixo do cabeçalho do workspace (`GitFork` = mostrar
  Espaços, `List` = mostrar nav primário — Caixa de entrada...Automações) alternam qual
  seção aparece; **nunca os dois ao mesmo tempo**. Estado `navMode` (`'nav'|'spaces'`,
  padrão `'spaces'`) persistido em `tf_sidebar_navmode`. Não reintroduzir os dois juntos.
- **Itens do nav primário têm ícone dentro de um quadradinho colorido** (26px,
  `rounded-lg`), igual ao tratamento de Espaço/Projeto — não mais ícone solto. Cada item
  tem sua própria cor fixa (`navItem(view, label, Icon, bg, iconColor, badge?,
  projectId?)` em `Sidebar.tsx`): Caixa de entrada azul, Minhas tarefas verde, Todas as
  tarefas índigo, Calendário laranja, Projetos roxo, Relatórios teal, Automações rosa.
- Cada **espaço/pasta/projeto** tem ícone:
  - Espaço → sempre um quadrado em **degradê** (`SpaceBadge`, `components/ui/EntityBadges.tsx`)
    com a inicial do nome em branco; a **cor** é customizável (clique no badge abre o
    `IconColorPicker` em `mode="color"`), mas o espaço **não tem ícone próprio** —
    só a cor muda (decisão do protótipo original, mantida).
  - Pasta → sempre o ícone de pasta (`FolderBadgeIcon`), **cor** customizável (clique no
    ícone abre `IconColorPicker` em `mode="color"`, padrão âmbar `DEFAULT_FOLDER_COLOR`).
    Pasta também não tem ícone customizável, só cor.
  - Projeto → ícone **lucide** + cor, ambos customizáveis (clique no ícone/quadradinho
    abre `IconColorPicker` em `mode="icon"`, com busca e grade categorizada). Sem ícone
    escolhido, mostra o quadradinho na cor do projeto (`ProjectIcon`).
- **Ícones são lucide-react** (nome kebab-case em `Project.icon`), não mais emoji. Fonte
  única de categorias/paleta: `lib/sidebarIcons.ts` (`ICON_CATEGORIES`, `SWATCH_COLORS`,
  `getIconComponent`). O antigo `EmojiPicker`/`ICON_OPTIONS` (emoji) foi removido; o
  `IconColorPicker` (`components/ui/IconColorPicker.tsx`) é a **fonte única** de seleção
  de ícone/cor em toda a sidebar **e** no `NewProjectModal` (que usa `mode="icon"` com
  `showColorRow={false}`, já que ali a cor tem sua própria grade separada). Cores
  personalizadas (color picker nativo) podem ser **salvas** por usuário
  (`tf_saved_icon_colors`, compartilhado entre todos os pickers).
- **Renomear** é por **duplo-clique** no nome (espaço/pasta/projeto/workspace) — não
  existe mais item "Renomear" no menu `...`.
- **Clicar no nome/ícone** = abrir o painel daquele espaço/pasta (`openSpace(id)` /
  `openFolder(id)`). **Chevron de expandir/recolher fica à direita** da linha (depois da
  contagem, não mais um botão separado à esquerda) — contagem e chevron ficam **sempre
  visíveis**; só `+` (adicionar) e `...` (menu) aparecem no hover, nessa ordem da esquerda
  pra direita: `+` → `...` → contagem → chevron. Mesmo padrão para espaço e pasta.
- **Hierarquia sem indentação/borda no nível do espaço**: pastas e projetos soltos direto
  no espaço são **irmãos no mesmo nível** (sem `<div>` de indentação/borda envolvendo o
  corpo do espaço). Só os **projetos dentro de uma pasta** ganham indentação extra com
  linha-guia vertical (`border-l`) + tracinho conector — a pasta em si não tem guia própria.
- **Botão `+` do espaço abre um menu** (Pasta / Projeto) em vez de criar direto. As duas
  opções — e o botão `+` da pasta (que cria projeto direto, sem menu, pasta não tem
  sub-pasta) — criam o item **instantaneamente** com nome/ícone padrão (pasta = "Nova
  Pasta"; projeto = "Novo Projeto", ícone `circle`, cor da pasta quando criado dentro de
  uma, senão índigo) e entram **direto em modo de renomear** com o texto **selecionado**
  (`renameInput` tem `onFocus` → `select()`), pronto pra digitar por cima — mesmo fluxo do
  duplo-clique, só que disparado automaticamente na criação. **Não abre mais o
  `NewProjectModal`** a partir da sidebar (esse modal continua existindo e sendo usado em
  outras telas — Projetos, Espaço, Pasta — só não é mais o caminho da sidebar). **Não
  existe mais** a linha de atalho "Pasta / + Projeto" abaixo da lista de projetos do
  espaço — foi substituída por esse fluxo do `+`. `addProject` no store retorna o
  `Project` criado (como `addSpace`/`addFolder` já faziam) — necessário pra esse fluxo
  poder chamar `startRename` com o id logo em seguida.
- **Detalhes de fidelidade ao protótipo** (fáceis de esquecer, checar contra o `.dc.html`
  se mexer de novo no visual): nav ativo em **negrito** (`font-bold`, não `font-medium`);
  cor do texto ativo (nav e projeto) muda por tema — `#3730A3` no escuro, `#4338CA` no
  claro; `navbadge`/avatar do rodapé usam `brand-600` (`#4F46E5`), não `brand-500`; logo
  do workspace padrão é uma **caixa neutra** (`#1B1C22` escuro / branco claro, com borda)
  com o Zap **colorido de índigo** (`text-brand-400`) — não um quadrado índigo sólido com
  ícone branco; nomes renomeáveis têm `cursor-text`; badge de espaço tem sombra colorida
  (`box-shadow` usando a própria cor do espaço) e cresce no hover do cabeçalho
  (`group-hover/space:scale-105`); ícone de projeto clareia no hover
  (`hover:brightness-125`); botão de tema no rodapé tem fundo translúcido em repouso
  (não só no hover) — o de configurações não tem caixa, só o ícone. O popover de
  ícone+cor (`mode="icon"`, ou seja, projeto) tem um rodapé com toggle "Perguntar cor ao
  trocar ícone" — **decorativo, sem lógica associada** (mesmo comportamento do protótipo
  original). Workspace/espaço vazio mostra um **estado ilustrado** (ícone `LayoutGrid` em
  caixa + título "Nenhum espaço ainda" + subtítulo), não só um botão de texto.
- **Espaço também tem ícone escolhível** (não só cor) — clicar no badge abre o
  `IconColorPicker` em `mode="icon"` (igual projeto). `Space.icon` (lucide, kebab-case)
  é opcional; sem ícone, o badge mostra a inicial do nome (`SpaceBadge` em
  `EntityBadges.tsx` decide isso). Pasta continua só-cor (sem ícone escolhível).
- **Contagem ao lado do projeto conta só tarefas não concluídas** (`t.status!=='done'`)
  — tarefas concluídas não entram no número.
- **Dois gatilhos de "novo espaço"** (o `+` ao lado do rótulo "Espaços" e o botão
  "+ Novo espaço" no fim da lista) — cada um abre o campo de nome **na própria posição**
  onde foi clicado (`addingSpace: 'top'|'bottom'|null`), não sempre no topo. O espaço
  criado sempre aparece na lista (ordem normal), independente de qual gatilho foi usado.
- **Linha-guia dos projetos dentro de pasta** (`index.css`, classes `.folder-line-head-dark`/
  `-light` no cabeçalho da pasta e `.folder-line-item-dark`/`-light` em cada projeto
  filho): réplica das medidas exatas do protótipo — `left:22px` (mesmo x do ícone da
  pasta, com `margin:mx-2` uniforme em `.spacehd`/`.folderhd`/`.proj`/`.folderproj` e
  padding-left `pl-5`/`pl-8`/`pl-[42px]` respectivamente), dash de `9px` em `top:14px`,
  segmento vertical de `-7px` até o fundo em cada item. **O talo do cabeçalho da pasta
  começa em `top:100%; height:6px`** (nunca `top:14px` sobre o próprio ícone/texto da
  pasta) — pode **tocar** a borda do cabeçalho mas nunca **sobrepor** o ícone/texto.
  **Não** usar `border-l` num container envolvendo todos os projetos da pasta (não
  alinha com o ícone).
- **Ritmo vertical das linhas da sidebar** (espaço/pasta/projeto) — confirmado como
  referência correta, não alterar sem necessidade clara: cada linha usa `py-[7px]`
  (7px de padding vertical) e as linhas-irmãs no mesmo nível só têm `space-y-0.5` (2px)
  entre si → gap visual de **16px** entre a maioria das linhas. Exceção: do cabeçalho
  da pasta para o **primeiro** filho não há `space-y` (o wrapper dos filhos fica colado
  no cabeçalho) → gap de **14px**, ligeiramente mais justo — é intencional.
- **Menu do item (`...`)**: popover fixo com **Mover · Duplicar · Arquivar · Excluir**
  (espaço não tem "Mover" nem "Arquivar" — não há hierarquia acima de espaço nem conceito
  de espaço arquivado; pasta tem Mover/Duplicar/Excluir; projeto tem os quatro). "Mover"
  abre uma segunda tela no mesmo popover (botão "← Mover para") listando espaços/pastas do
  **workspace ativo**. **Pontuação GUT saiu do menu da sidebar** — o ponto de acesso
  permanece a tela "Projetos" (`ProjectsListView`, botão "Editar GUT"), que já existia.
  **Duplicar** é uma ação real de store (`duplicateSpace`/`duplicateFolder`/`duplicateProject`
  em `useAppStore.ts`) — duplica a hierarquia (pasta duplica seus projetos; espaço duplica
  pastas+projetos), mas **nunca duplica tarefas** (evita explosão de dados; é uma cópia do
  "molde", não do conteúdo).
- Ações (`+` e `...`) aparecem **no hover**. O item ativo fica destacado com pílula
  clara (`bg-[#EEF0FF] text-[#3730A3]`), igual ao nav primário.
- **O espaço reservado à direita cresce só no hover** (29/07/2026): o `padding-right` da
  linha em repouso reserva apenas o que está realmente visível — nada (`pr-3`) quando não
  há contagem, `pr-10` quando há (espaço: `pr-9`/`pr-[68px]`, por causa do chevron sempre
  visível) — e sobe para `pr-16` (espaço: `pr-24`) no `group-hover`, quando `+` e `...`
  aparecem. Antes o padding era fixo no tamanho do estado de hover, então o nome truncava
  cedo com 50px de vazio à direita ("Novo Proj…" numa linha quase vazia). A transição é
  `transition-[padding,background-color,color]` para o nome não saltar. **Ao mexer nessas
  linhas, manter essa regra**: reservar o espaço do hover em repouso é o que causa o bug.
- Hierarquia dentro do espaço tem linha-guia vertical à esquerda. Pasta vazia mostra "Vazia".
- **Redimensionável e retrátil**: a sidebar tem largura ajustável arrastando a borda
  direita (alça `col-resize`, 184–420px, salva em `tf_sidebar_width`, padrão 240) e
  um botão de **recolher** no cabeçalho (`PanelLeftClose`). Recolhida, vira um trilho
  fino (48px) com logo + botão de **expandir** (`PanelLeftOpen`); estado salvo em
  `tf_sidebar_collapsed`. A `<aside>` usa `width` inline + `flex-shrink-0` (nunca
  cravar `w-52`).
- **Tema claro/escuro é global** (atualizado 30/07/2026 — antes era só da sidebar): o
  botão sol/lua no rodapé da sidebar alterna `tf_sidebar_theme` **e** aplica/remove a
  classe `.dark` no `<html>`; o app inteiro tematiza a partir dela (ver seção 8.4).

### 3.1. Workspaces (multi-workspace)

- Novo nível **acima** de Espaço: `Workspace` (`types/index.ts`), com `id`, `name`,
  `color` (cor do avatar/inicial quando não é o workspace padrão). Store: `workspaces[]`,
  `activeWorkspaceId`, ações `addWorkspace`/`updateWorkspace`/`switchWorkspace`
  (`useAppStore.ts`), persistidos em `tf_workspaces`/`tf_active_workspace`.
- `Space` e `Project` guardam `workspaceId` (obrigatório). Pasta e tarefa **não** guardam
  workspace — herdam do espaço/projeto. `addSpace`/`addProject` atribuem automaticamente
  `activeWorkspaceId` — nunca passar workspace na mão.
- Cabeçalho da sidebar é clicável e abre o **seletor de workspace** (lista + "Criar
  workspace"). Trocar de workspace zera a navegação (`switchWorkspace` já chama o
  equivalente de `setView('my_tasks')` e limpa seleção ativa).
- **Isolamento total por workspace** (14/07/2026): `Task` e `Automation` também têm
  `workspaceId` (como `Space`/`Project` já tinham) — `addTask`/`quickAddTask`/
  `addAutomation` atribuem `get().activeWorkspaceId` automaticamente, sem precisar
  passar na mão. **Toda tela que lista tarefas/automações direto da store filtra por
  `activeWorkspaceId`**: Caixa de entrada, Minhas tarefas, Todas as tarefas, Calendário,
  Relatórios (`ReportsView` sombreia `tasks`/`projects` com versões já filtradas logo
  no topo do componente — todo o resto do arquivo usa esses nomes sem precisar tocar
  em cada `useMemo`), Automações, geração de notificações (`App.tsx`), `AIPanel`
  (contexto da IA e projeto de fallback), `QuickCapture` e `FilterPanel` (tags/
  responsáveis) — inclusive `getAllTags()` e `runAutomations()` na própria store.
  **Não precisa filtrar** telas escopadas a um projeto/espaço/pasta já conhecido
  (`ProjectDetailView`, `SpaceFolderView`, subtarefas em `TaskRow`) — like o projeto/
  espaço em si já pertence a um workspace, suas tarefas são automaticamente isoladas
  por construção, sem precisar checar `workspaceId` de novo.
  **Ao adicionar uma nova tela ou painel que lista tarefas/automações direto da
  store**, sempre filtrar por `activeWorkspaceId` — esse é o padrão daqui pra frente,
  não uma exceção.
- Workspace padrão tem id fixo `DEFAULT_WORKSPACE_ID = 'default'` e usa o logo `Zap`
  (marca) em vez de avatar com inicial — é o único tratado como "workspace principal".
  Dados antigos (antes desta migração) são todos migrados para ele em `init()`.

---

## 4. Painel de tarefas unificado (`TaskPanel`)

**Todo lugar que exibe tarefas usa o mesmo painel** — `components/tasks/TaskPanel.tsx`.
Nunca criar um painel/lista de tarefas próprio numa tela nova.

Já usam o `TaskPanel`: **Espaço, Pasta, Minhas tarefas, Todas as tarefas**.
A página de **Projeto** (`ProjectDetailView`) é a referência rica desse mesmo estilo
(mantém filtros, colunas personalizadas, GUT e visualizações salvas).

O `TaskPanel` oferece:

- Abas: **Overview, Tarefas (lista), Board, Tabela, Calendário, Quadro branco, Atividade, Painéis**
  (via prop `views` dá pra escolher o subconjunto).
- Barra de progresso e contagem de tarefas.
- Controle **"Agrupar por"**: Status, Prioridade, Prazo, Responsável e Projeto
  (Projeto/Responsável só onde fizer sentido — escopos com vários projetos).
- Detalhe da tarefa (`TaskDetail`) ao selecionar.
- A escolha de aba e agrupamento é **lembrada por escopo** (`scopeKey`, em `localStorage`).

Ao criar uma nova tela com tarefas: monte um array de `tasks`, defina `scopeKey`,
`title`, `accent`, `icon` e renderize `<TaskPanel .../>`. Use `key={scopeKey}` quando o
mesmo componente serve a escopos diferentes (ex.: espaços), para remontar e recarregar a preferência.

### 4.1. Quadro branco (substitui o antigo "Mapa mental")

- Aba de desenho livre (`components/tasks/WhiteboardView.tsx`), SVG próprio e leve
  (sem lib externa tipo tldraw/Excalidraw). Ferramentas: selecionar, caneta livre,
  retângulo ("Atividade"), losango ("Decisão"), elipse ("Início/Fim"), seta ("Fluxo")
  e texto — pensadas para **mapear processos em BPMN**.
- Persistência por escopo em `localStorage` (`tf_whiteboard_${scopeKey}`) via
  `lib/whiteboard.ts` (`loadWhiteboard`/`saveWhiteboard`).
- Nunca recriar essa lógica em outro componente — todo lugar que precisar de quadro
  branco reusa `<WhiteboardView scopeKey={...}/>`.

### 4.2. "+ Visualização" generalizado (visualizações personalizadas)

- Disponível em **qualquer tela com `TaskPanel`** (Espaço, Pasta, Minhas tarefas, Todas
  as tarefas) e também em Projeto — não é mais exclusivo de dentro de um projeto.
- Modelo de dados: `customViewsByScope: Record<scopeKey, CustomProjectView[]>` no
  store (`useAppStore.ts`), com ações genéricas `getCustomViews(scopeKey)`,
  `addCustomView(scopeKey, view)`, `deleteCustomView(scopeKey, viewId)`. Substituiu o
  antigo `project.customViews` (mantida migração automática one-time em `init()`).
  `scopeKeyForProject(id)` gera o scope de um projeto.
- Modal de criação é único e compartilhado: `components/tasks/NewViewModal.tsx`
  (renderizado uma vez em `App.tsx`, controlado por `newViewModal` = scopeKey no
  store). **Nunca duplicar esse modal por tela.**
- O modal abre com **modelos prontos** (presets de um clique, redesign 30/07/2026):
  "Concluídas no período" (status Concluído + Data de conclusão + Esta semana — o caso
  mais importante, reunião semanal de resultados), "Entregas da semana", "Urgentes em
  aberto" e "Novas do mês". O preset preenche nome/ícone/filtros de uma vez; qualquer
  ajuste manual "solta" o destaque do preset (a configuração vira própria). O antigo
  botão-atalho no cabeçalho foi substituído por essa grade de modelos.
- Filtros da visualização (todos opcionais, combinados por **E**): status — incluindo o
  pseudo-status **`'open'`** ("Em aberto" = tudo que não está Concluído) —, prioridade
  (`filterPriority`), responsável (`filterAssignee`, nome exato) e tags (`filterTags`,
  a tarefa entra se tiver **qualquer** uma das selecionadas). Fontes das opções:
  `STATUS_OPTIONS`/`PRIORITY_OPTIONS` (`Select.tsx`), `getAllAssignees()`/`getAllTags()`
  (store, já isolados por workspace).
- Cada visualização personalizada guarda `dateField` (`dueDate`/`completedAt`/`createdAt`)
  + `datePeriod` (ver 4.3), aplicados via `lib/customViews.ts` (`applyCustomViewFilter` —
  coberto por `lib/__tests__/customViews.test.ts`; filtro novo entra lá com teste).
- O modal mostra uma **prévia ao vivo**: quantas tarefas do escopo correspondem à
  configuração atual. Para isso ele resolve as tarefas do `scopeKey` espelhando o que
  cada tela passa ao `TaskPanel` (`project:`/`space:`/`folder:`/`mytasks`/`alltasks`) —
  se uma tela nova ganhar "+ Visualização" com outra regra de escopo, atualizar também o
  `scopeTasks` do `NewViewModal`.

### 4.3. Filtro de período (estilo ClickUp)

- Componente reutilizável `components/ui/DatePeriodPicker.tsx`: escolhe o **campo de
  data** (Prazo/Data de conclusão/Data de criação) e o **período**, com presets
  relativos (Hoje, Ontem, Esta semana, Este mês, Trimestre, etc.) e período
  específico (data exata, antes de, depois de, entre — com atalhos de data rápidos
  e mini-calendário).
- Lógica de resolução de datas em `lib/dateFilter.ts` (`resolvePeriodRange`,
  `matchesDateFilter`, `taskDateValue`). `completedAt` é sintetizado a partir de
  `status === 'done' ? updatedAt : null`.
- Usado tanto no painel de **Filtros** (`FilterPanel.tsx`) quanto no **"+ Visualização"**
  (`NewViewModal.tsx`) — é o único componente de filtro de data do app; não recriar
  inputs de data soltos em telas novas.

### 4.4. GUT por tarefa (popover na lista)

- Além do GUT de **projeto** (`GUTModal.tsx`, modal cheio), tarefas individuais podem ter
  sua própria matriz GUT opcional (`Task.gut?: GUT`, mesmo tipo `{g,u,t,score}`). Acesso
  rápido: badge/popover `components/tasks/TaskGutBadge.tsx`, ancorado via `FloatingPanel`
  (nunca `position:absolute` solto, mesma regra da seção 9). Mesmos limiares/cores de
  `gutTier()` (fonte única — não recriar uma segunda escala de cores para tarefa).
- Interação é por **segmentos coloridos** (5 barras por dimensão G/U/T, clique define o
  nível, `title` mostra a dica), diferente do slider do `GUTModal` — popover compacto tem
  espaço menor, então não duplica o `GUTSlider`, só reaproveita `calcGUT`/`gutTier`.
- Coluna de lista `gut` (`lib/taskColumns.ts` → `EXTRA_SYSTEM`), mesma família de
  `createdAt`/`taskType` (oculta por padrão, liga em "Adicionar Campo" → Propriedades),
  **exceto** no escopo `alltasks` ("Todas as tarefas"), onde nasce **visível por padrão**
  (`loadExtra` tem esse caso especial) — reflexo do redesign, que mostra GUT como coluna
  de primeira classe só nessa tela.

### 4.5. Progresso de subtarefas (coluna + painel)

- Nova coluna de sistema `progress` (`EXTRA_SYSTEM`, mesmo tratamento oculto/visível do
  `gut` acima): mini barra + rótulo `feitas/total` a partir dos filhos diretos da tarefa;
  tarefas sem subtarefa mostram só um traço. Renderizada em `TaskRow.tsx` (`case
  'progress'`).
- O `TaskDetail` também ganhou um `SideProp` "Progresso" (mesma mini-barra) na coluna de
  propriedades, visível só quando a tarefa tem subtarefas — não duplica lógica, calcula
  em cima do array já carregado por `getSubtasks`.

### 4.6. Navegação entre subtarefas no painel (breadcrumb)

- Quando o `TaskDetail` abre uma **subtarefa**, aparece uma barra de breadcrumb no topo
  (acima do cabeçalho existente) com: bolinha de status do pai, nome do pai (clique abre
  o pai) e, se houver mais de uma irmã, um badge "N ⌄" que abre um dropdown listando todas
  as subtarefas do mesmo pai (bolinha de status + nome + check na atual). Não usa
  `FloatingPanel` porque a barra não fica dentro de um container com scroll — dropdown é
  `position:absolute` simples ancorado nela mesma.

### 4.7. Expandir/recolher todas as subtarefas

- Botão no cabeçalho de colunas da lista (`ColumnHeaders.tsx`, novo slot `rightExtra`)
  alterna **todas** as subtarefas da lista de uma vez (`TaskList.tsx`,
  `subtasksCollapsed`/`toggleAllSubtasks`). Implementado via **remount controlado**: o
  toggle incrementa `expandVersion`, que entra na `key` de cada `TaskRow` raiz — isso
  reseta o estado local (`expanded`, não controlado) de cada linha para o novo padrão
  (`defaultExpanded`), sem precisar tornar o expand/collapse de cada linha um estado
  controlado. `defaultExpanded` é repassado recursivamente para subtarefas de
  subtarefas.

### 4.8. Cabeçalho de grupo colorido para todo agrupamento

- O cabeçalho de grupo em pílula sólida colorida (antes só em "Status", via
  `STATUS_PILL`) agora também aparece em **Prioridade** (cores de `PRIORITY_OPTIONS`,
  `Select.tsx` — fonte única) e **Projeto** (cor do próprio projeto). "Responsável" segue
  com pontinho + texto (não é pílula) — o protótipo original também não cobria esse
  agrupamento (segmento "Responsável" inerte na referência).
- **Clicar na pílula/rótulo do grupo expande/colapsa** (`TaskList.tsx`) — não existe mais
  um botão de seta separado ao lado; o título inteiro é o alvo de clique (confirmado
  explicitamente pelo autor do protótipo: "ao clicar no título do item que está
  agrupando deve expandir ou colapsar").

### 4.9. Progresso: subtarefas, com fallback para checklist

- `lib/taskProgress.ts` (`taskProgress(task, subtasks)`) é a **fonte única** do cálculo
  de progresso de uma tarefa: usa subtarefas quando existem; se não houver subtarefa mas
  houver checklist(s), usa a conclusão dos itens de checklist (soma de todas as
  checklists da tarefa); sem nenhum dos dois, retorna `null` (célula/prop mostram "—").
  Usado tanto na coluna "Progresso" da lista (`TaskRow`) quanto no `SideProp` do
  `TaskDetail` — não duplicar essa lógica em nenhum lugar novo.

### 4.10. Ícone da tarefa segue o agrupamento ativo

- Na lista, a cor do ícone de tipo da tarefa (`TaskRow`) normalmente segue o **status**
  (cinza/azul/verde, seção 5) — mas quando a lista está **agrupada por Prioridade**, o
  ícone passa a seguir a **cor da prioridade** da tarefa (inclusive em tarefas
  concluídas, sem tratamento especial). `groupBy` é passado de `TaskList` para `TaskRow`
  (e propagado recursivamente às subtarefas) especificamente para essa decisão.

### 4.11. Expandir/recolher todas as subtarefas — localização

- O botão "Expandir/Recolher subtarefas" vive na barra **"Agrupar por"** do `TaskPanel`
  (`toggleAllSubtasks`/`subtasksCollapsed`/`expandVersion`, alinhado à direita com
  `ml-auto`), **não** no cabeçalho de colunas — o protótipo original coloca esse botão
  ali, com a mesma moldura do filtro "Todos os projetos" (borda, fundo branco, cantos
  arredondados). O estado é dono do `TaskPanel` (não do `TaskList`) e é passado como
  prop para o(s) `TaskList` que ele renderiza (view padrão e visualização
  personalizada), já que o botão precisa ficar fora do componente de lista em si.

---

## 5. Ícone de tarefa (regra fechada)

- O **ícone do tipo de tarefa substitui o círculo de status** — nunca um símbolo dentro
  de um círculo com borda.
- Ícones no estilo ClickUp, **coloridos pela cor do status** (não mais cinza fixo):
  A fazer = `#888780` (cinza) · Em progresso = `#378ADD` (azul) · Concluído = `#1D9E75`
  (verde). Vale para `TaskRow` (ícone que conclui) e para o ícone no cabeçalho do
  `TaskDetail`. Formas por tipo: Tarefa = círculo; Marco = losango; Anotação = bloco
  de notas; Erro = inseto; Meta = troféu; Objetivo = alvo; Resposta de formulário =
  prancheta; Solicitação = balão. **A forma nunca muda ao concluir** — só a cor vira
  verde; concluir uma tarefa **não** substitui o ícone por um círculo genérico com
  check (isso já foi um bug: tarefas perdiam a identidade do tipo ao ir para
  Concluído). O check só aparece como indicador **hover** em tarefas não concluídas
  (convite para concluir); em tarefas concluídas o próprio ícone do tipo, colorido de
  verde, já comunica o status. (`TYPE_ICON_COLOR` fica só como fallback neutro para a
  coluna "Tipo de tarefa".)
- Clicar no ícone **conclui/reabre**; ao passar o mouse mostra ✓ verde; concluída =
  círculo verde com check; nome com `line-through`.
- A setinha discreta ao lado (hover) abre o **seletor de tipo**, que segue o ClickUp:
  campo "Pesquisar...", cabeçalho "Tipos de tarefa", ícones cinza (sem chip colorido),
  "(padrão)" no Tarefa e ✓ no selecionado.
- Mapa de ícones: **fonte única** em `lib/taskTypeIcons.ts` (`TYPE_ICON` + `TYPE_ICON_COLOR`).
  `TaskRow` **e** `TaskDetail` usam o mesmo mapa — os ícones da lista e do painel são idênticos.
  Novos tipos entram lá.

---

## 6. Modelo de dados

Em `src/types/index.ts`:

- `Space { id, name, color, icon?, collapsed, ... }`
- `Folder { id, name, spaceId, icon?, collapsed, ... }`
- `Project { id, name, color, description, icon?, spaceId|null, folderId|null, gut, ... }`
- `Task { id, projectId, parentId|null, title, status, priority, taskType, completedAt?, ... }`
  - **`completedAt`** é gravado **uma única vez**, na transição para "Concluído"
    (`updateTask`), e zerado ao reabrir. Antes o app usava `updatedAt` como proxy, o que
    fazia uma tarefa concluída em março voltar para o relatório de hoje ao ser editada.
    `migrateTask` preenche dados antigos com o `updatedAt` da tarefa já concluída, e o
    `init()` **grava** essa migração (`needsCompletionBackfill`) — migrar só em memória
    recriaria o valor a cada abertura, mantendo o bug. Todo número histórico do relatório
    depende desse campo.

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
- **Metas/Objetivos** (`View 'goals'`, `views/GoalsView.tsx`): item "Metas" no nav primário
  da sidebar (entre Calendário e Projetos, ícone `Target`). Entidade `Goal` (`types/index.ts`)
  com alvos mensuráveis (`GoalTarget`: number/currency/percent/boolean); progresso da meta =
  média do progresso dos alvos (`goalProgress`/`goalTargetProgress`). Isolada por workspace
  (`workspaceId`, ações `addGoal`/`updateGoal`/`deleteGoal`, persistência `tf_goals`). Cards
  com anel de progresso + status (`GOAL_STATUS_META`) + prazo + barras dos alvos; criação/edição
  no `GoalEditor` (modal). Não é uma tela com `TaskPanel` — é uma seção própria de OKRs.

---

## 8. Tokens visuais (design sofisticado/minimalista — estilo Linear/Notion)

> A partir do redesign premium (07/2026) o app segue uma linguagem **minimalista
> e sofisticada**: cinzas frios, cor de destaque índigo, elevação suave em camadas
> e tipografia com hierarquia mais forte. **Sempre use os tokens**, nunca cravar
> cores/sombras soltas.

- **Marca / destaque**: paleta `brand-*` = **índigo** (`brand-500 #6366F1`,
  `brand-600 #4F46E5`). Substituiu o antigo roxo ClickUp `#7B68EE`. Todo accent
  padrão de código usa `#6366F1`.
- **Cinzas** (`gray-*`): paleta **sobrescrita** no `tailwind.config.js` para tons
  frios/neutros (ex.: `gray-50 #FAFAFA`, `gray-200 #EAEAEC`, `gray-900 #17181C`).
  Como é override do Tailwind, todo `gray-*` do app herda o acabamento — não trocar
  por `slate`/`zinc` avulsos.
- **Sidebar (tema escuro grafite)**: `cu-bg #111114`, `cu-hover`, `cu-active`,
  `cu-border`, `cu-input`, `cu-text`, `cu-muted` (ver `tailwind.config.js`).
- **Elevação**: sistema de sombras suaves e em camadas — `shadow-xs`/`sm`/`md`/`lg`/
  `xl`/`2xl` (redefinidas no config, mais discretas) + `shadow-focus`. Menus,
  popovers e modais usam `shadow-lg`/`shadow-2xl`.
- **Raios**: `rounded-lg` = 10px, `rounded-xl` = 14px (levemente mais suaves).
- **Conteúdo (claro)**: branco com bordas finas `gray-200/70`, cantos arredondados
  e sombras suaves. Utilitários prontos em `index.css`: `.card`, `.card-hover`,
  `.elevate`, `.hairline`.
- **Tipografia**: Inter (400–700) com `font-feature-settings` e `letter-spacing`
  negativo; títulos com `tracking-tight`. Números/datas em `.tabnum`
  (tabular-nums) para não "pular".
- **Foco**: anel índigo global via `:focus-visible` (em `index.css`) — não recriar
  outlines por componente.
- **Menus suspensos**: usar **sempre** o componente `components/ui/Select.tsx`
  (dropdown premium com portal, opções coloridas, ícone opcional, seleção com
  check, teclado e clique-fora). **Proibido** `<select>` nativo em tela nova.
  Conjuntos prontos: `PRIORITY_OPTIONS` e `STATUS_OPTIONS` (exportados do próprio
  `Select.tsx`). Variantes: `default` (com borda, para formulários) e `inline`
  (sem borda, para células densas como prioridade/status na lista); use `stop`
  em linhas clicáveis e `colorText` para colorir o texto do gatilho.
- **Animações**: `.animate-scale-in` (menus/popovers/modais) e `.animate-overlay-in`
  (fundo do modal), além de `.animate-fade-in`/`.animate-slide-in`.
- **Ícones**: usar **ícones de linha do lucide-react**, nunca emojis/glifos soltos em
  UI de sistema. Fontes únicas da verdade:
  - `lib/taskTypeIcons.ts` (`TYPE_ICON`) — tipos de tarefa.
  - `lib/fieldTypeIcons.ts` (`FIELD_TYPE_ICON`) — tipos de campo personalizado
    (usado no `ColumnsModal`). Substituiu os emojis 📅🔗👤✉️▾☑★.
  - `lib/viewIcons.ts` (`VIEW_ICON`) — ícones de visualização personalizada
    (`NewViewModal` + abas do `TaskPanel`). O `icon` da visão virou uma **chave**
    (ex.: `list`, `check`), com fallback para emojis antigos já salvos.
  - `lib/sidebarIcons.ts` (`ICON_CATEGORIES`, `getIconComponent`) — ícone de **projeto**
    na sidebar (desde o redesign 07/2026, substituiu o `EmojiPicker`/`ICON_OPTIONS`
    de emoji). Espaço e pasta não têm ícone escolhível, só cor (ver seção 3).
  - Emojis de sistema não são mais usados em nenhum lugar do app depois desse redesign
    — o `EmojiPicker` foi removido. Se uma tela nova precisar de "ícone escolhido pelo
    usuário", usar `IconColorPicker` (`components/ui/IconColorPicker.tsx`), não recriar
    um seletor de emoji.
- Cores de status: A fazer `#888780` · Em progresso `#378ADD` · Concluído `#1D9E75`.
- **Cabeçalho de grupo**: pílula colorida sólida branco-em-maiúsculas, estilo ClickUp —
  Status (`STATUS_PILL`, com ícone: `Circle`/`Clock`/`CheckCircle2`), **Prioridade**
  (cores de `PRIORITY_OPTIONS`) e **Projeto** (cor do próprio projeto) usam essa pílula
  (seção 4.8). Só **Responsável** segue com ponto colorido + rótulo (sem pílula — o
  protótipo original também não cobria esse agrupamento).
- Use sempre os tokens; não cravar cores novas fora dessa paleta sem necessidade.

### 8.2. Sistema visual consolidado (auditoria de 29/07/2026)

> A auditoria mediu a interface e encontrou o sistema **contornado**: 256 classes de cor
> cruas do Tailwind em 30 arquivos, 107 hex escritos à mão, 14 tamanhos de ícone, 16
> tamanhos de fonte e 22 de 33 textos pequenos abaixo do mínimo de leitura. O que segue é
> o resultado da consolidação — **as regras abaixo valem para tela nova e tela antiga**.

- **Cores semânticas de feedback** (`tailwind.config.js`): `success` (verde do status
  Concluído), `warning` (âmbar de meta em risco), `danger` (vermelho de Urgente) e `info`
  (azul de Em progresso), cada uma com 50/100/500/600/700. **Não usar `red-*`, `green-*`,
  `emerald-*`, `amber-*`, `blue-*`, `indigo-*` do Tailwind** — `indigo` em especial é um
  segundo índigo quase igual ao `brand`, o pior tipo de inconsistência.
- **Prioridade tem fonte única**: `PRIORITY_COLOR` + `PRIORITY_TEXT_COLOR` +
  `priorityTint()` em `types/index.ts`; `PRIORITY_OPTIONS` (`Select.tsx`) deriva dali.
  Existiam **quatro** definições paralelas (opções do Select, círculo da linha, badge do
  mobile e cor do ícone por agrupamento) — a mesma prioridade tinha uma cor no computador
  e outra no celular, onde ainda aparecia em inglês ("HIGH"). Idem `STATUS_COLOR`.
- **Texto sobre tinta usa o tom escuro** (`PRIORITY_TEXT_COLOR`): a cor cheia sobre o
  próprio fundo em tinta rende ~3:1. Vale para qualquer badge novo com fundo colorido.
- **Contraste mínimo 4.5:1 para texto**. `gray-300`/`gray-400` foram escurecidos porque
  eram usados como cor de texto (a contagem dos grupos chegava a 1.42:1, invisível).
  `gray-200/300` servem a **bordas e ícones decorativos**, não a texto.
- **Escala de ícones** (`lib/iconScale.ts`): **12 · 14 · 16 · 18**. Nada abaixo de 12 —
  o lucide desenha numa grade de 24px com traço 2, e a 9–10px o traço renderizado fica
  abaixo de 1px e o ícone esfarela. Ícones são sempre **de contorno**; nada de `fill`.
- **Escala tipográfica**: 10 · 11 · 12 · 13 · 14 · 16 · 20. **Sem meios-pixels**
  (`text-[10.5px]`, `text-[12.5px]` e afins foram eliminados).
- **Ritmo das três faixas da lista de tarefas** — a hierarquia estava invertida (as abas,
  nível mais alto, não tinham separação; abaixo vinham duas faixas cinza quase idênticas,
  slate-50 a 60% e a 85%):
  1. **Abas** (tipos de visualização): **régua contínua** de 1px encerrando o cabeçalho —
     é ela que dá base ao indicador da aba ativa.
  2. **Agrupar por**: **transparente, sem borda**. É barra de ferramentas, não dado;
     separa-se por espaço.
  3. **Cabeçalho de colunas**: **única faixa tonal** (`bg-gray-50` + borda), e só ele
     mantém tratamento de destaque por ser `sticky`.
  Nunca empilhar duas superfícies tonais seguidas nessa região.
- **Barra de progresso** é contida (160px) ao lado do número, não uma faixa de ponta a
  ponta — cheia, parecia barra de carregamento da página.
- **Ação destrutiva não fica na barra principal**: "Excluir projeto" vive no menu `⋯`.
  Um separador divide ferramentas de tela (filtro, campos, IA) das ações sobre o projeto.
- **Cabeçalho de colunas não usa ícones** em nenhum dos dois modos (o dinâmico nunca teve,
  e a caixa de entrada tinha — a mesma coluna "Prazo" mudava de cara entre telas).

### 8.3. Padrão único de modal (redesign 30/07/2026)

> Depois do redesign do "Nova visualização", o mesmo acabamento comercial foi aplicado a
> **todos** os modais do app. A fonte única do shell é `components/ui/Modal.tsx`.

- **Todo modal novo usa o `Modal`** (`open/onClose/title` + `icon` lucide, `accent`,
  `subtitle`, `footer`): cabeçalho com **caixa de ícone em degradê** gerado da cor
  `accent` (padrão índigo), subtítulo de apoio, corpo rolável (`max-h-[90vh]`) e
  **rodapé fixo** para os botões de ação (prop `footer`, fora da área de scroll).
  Esc e clique-fora fecham (o shell cuida disso). Modais de IA passam
  `iconClassName="ai-gradient-bg"` no lugar do degradê da cor.
- **Overlay padronizado**: `bg-gray-900/30 backdrop-blur-[3px] animate-overlay-in` +
  container `rounded-2xl border border-gray-200/80 shadow-2xl animate-scale-in`.
  Os poucos overlays fora do shell (`NewViewModal`, `QuickCapture`,
  `AutomationEditor`, `TaskListModal`) replicam exatamente esses tokens — e fecham
  com Esc. Exceção consciente: os overlays de tela cheia do `TaskDetail`
  (escurecimento mais forte, proposital).
- O `accent` pode ser **vivo**: `NewProjectModal` passa a cor/ícone escolhidos do
  projeto; `GUTModal` passa a cor do tier atual; `GoalEditor` a cor da meta.
- **QuickCapture** usa `PRIORITY_OPTIONS` (fonte única) — a paleta própria que existia
  ali mostrava cores erradas, e a prioridade escolhida **não era aplicada** à tarefa
  (bug corrigido em 30/07/2026: prioridade e prazo rápido agora entram via
  `updateTask` após o `quickAddTask`).
- `NewTaskModal.tsx` (morto desde o `QuickAddRow`) foi removido.
- **Captura inteligente** (30/07/2026): o QuickCapture entende prazo e prioridade em
  português natural no próprio texto — "amanhã", "sexta", "15/08", "urgente",
  "importante", "sem pressa" — via `lib/smartCapture.ts` (`parseSmartCapture`,
  determinístico, sem chamada externa, testado em `lib/__tests__/smartCapture.test.ts`).
  A prévia "Entendi: …" aparece sob o campo; o trecho reconhecido **sai do título** ao
  salvar; escolha manual (chips/prioridade) sempre vence a detecção. Atenção de regex:
  `\b` não funciona após letra acentuada ("amanhã") — a borda final é lookahead
  `(?=[\s,.;:!?]|$)`.

### 8.4. Modo escuro global (consolidado 30/07/2026)

> O toggle da sidebar aplica `.dark` no `<html>`. A tematização é por **camadas no
> `index.css`**, não por `dark:` espalhado nos componentes.

- **O que flipa sozinho**: `gray-*` e `slate-*` (variáveis CSS no `tailwind.config.js`),
  `bg-white` e as bordas/sombras (overrides `.dark .bg-white` etc. no `index.css`).
- **Tintas semânticas** (`bg/border` de `brand/success/warning/danger/info` em 50/100 e
  os textos 600/700): flipam pelo bloco **"Tintas semânticas no modo escuro"** do
  `index.css` — fundo vira tinta escura da mesma cor, texto vira tom claro legível.
  Ficam de fora de propósito: `bg-*-200`, `text-*-800` e os gradientes de avatar
  (`from-brand-200 to-brand-400`), que pareiam com texto escuro nos dois temas.
- **Card de destaque usa `.hero-card`** (utilitário com variante `.dark` própria) — o
  gradiente `from-[#F7F8FF] to-white` cravado na mão foi o que deixou o briefing do dia
  com **título branco sobre fundo branco** no escuro (bug de 30/07). Nunca recriar.
- **Regra para tela nova**: cor clara cravada (`#F7F8FF`, `to-white`, tinta hex) só com
  contrapartida `.dark` no `index.css`; alfa de branco/cinza (`bg-white/70` etc.) precisa
  constar na lista de overrides de alfa. Na dúvida, teste com a classe `.dark` aplicada.

### 8.1. Densidade e escala da lista de tarefas (redesign 15/07/2026)

> A partir do redesign de "Todas as tarefas" (importado de protótipo Claude Design), a
> lista de tarefas (`TaskPanel`/`TaskList`/`TaskRow`/`ColumnHeaders` — compartilhados por
> Espaço, Pasta, Minhas tarefas e Todas as tarefas) ganhou uma escala mais espaçosa e
> "premium", substituindo a densidade mais compacta anterior. **Sempre usar essa escala em
> telas novas de lista** — não voltar ao padrão compacto antigo.

- **Cabeçalho do painel** (`TaskPanel.tsx`): título `20px/font-extrabold` (era 15px/semibold),
  padding horizontal **24px** (`px-6`, era `px-4`) em todo o cabeçalho — título, barra de
  progresso, abas e controle "Agrupar por". Abas em `12.5px/font-semibold` (era `text-xs
  font-medium`). Segmento "Agrupar por": `rounded-lg`/`p-[3px]`, botões `px-3 py-1.5
  font-semibold`.
- **Cabeçalho de colunas** (`ColumnHeaders.tsx`): **maiúsculo + letter-spacing** (`uppercase
  tracking-wide`), `font-bold text-gray-400`, bordas finas (`border-t border-gray-100` +
  `border-b border-gray-200`) em vez de `border-b-2` grossa.
- **Linha de tarefa** (`TaskRow.tsx`): `min-height:46px` (era 36px), padding horizontal
  **24px** dos dois lados (era 16px só à esquerda). Nome da tarefa `13.5px/font-medium`
  (era `text-sm`/normal).
- **Cabeçalho de grupo** (`TaskList.tsx`): padding `px-6 pt-3.5 pb-2` (era `px-4 py-1.5`),
  sem borda inferior própria (a borda vem da linha de tarefa abaixo).
- **Badge de prioridade na lista**: `Select` ganhou a prop **`pill`** (opt-in, só com
  `variant="inline"`) — vira badge sólido tinta-da-cor (`color+'18'` de fundo), maiúsculo,
  `min-width:84px`, sem chevron. Usado em `TaskRow` (coluna Prioridade). Não usar `pill` em
  Status/Prioridade fora de listas densas — nos `SideProp` do `TaskDetail` o `Select` inline
  sem `pill` já é o padrão certo (mais parecido com o `prop-trigger` do protótipo, que tem
  moldura, não fundo sólido).
- **Tag de projeto na lista**: usa `ProjectIcon` (`EntityBadges.tsx`, fonte única do ícone de
  projeto) dentro da pílula tinta-da-cor, em vez de um pontinho — mesma fonte de ícone da
  sidebar, não recriar.
- **Avatar de responsável**: gradiente `from-brand-200 to-brand-400`, texto `text-brand-800`,
  anel branco+tinta (`shadow-[0_0_0_2px_#fff,0_0_0_4px_#EEF0FF]`) na versão grande (célula da
  lista, `AssigneePicker` `variant="row"`); versão do menu (20px) usa o mesmo gradiente sem
  anel. Mesmo tratamento usado nos avatares de comentário do `TaskDetail`.
- **Larguras de coluna** (`lib/taskColumns.ts`) alinhadas ao protótipo: Tags 88px,
  Responsável 72px (só avatar, sem nome — a coluna é estreita), Prazo 116px, Prioridade
  104px, Projeto 168px, GUT 100px, Progresso 120px.

---

## 9. Componentes-chave (onde mexer)

| Componente | Arquivo | Responsabilidade |
|---|---|---|
| Sidebar | `components/layout/Sidebar.tsx` | Hierarquia, workspaces, ícones, menus, navegação |
| Badges de entidade | `components/ui/EntityBadges.tsx` | `SpaceBadge`/`FolderBadgeIcon`/`ProjectIcon` — fonte única do "avatar" de espaço/pasta/projeto, usada na Sidebar, Inbox e Espaço/Pasta |
| Seletor de ícone/cor | `components/ui/IconColorPicker.tsx` + `lib/sidebarIcons.ts` | Popover de ícone lucide + cor (projeto) ou só cor (espaço/pasta); usado também no `NewProjectModal` |
| Popover flutuante | `components/ui/FloatingPanel.tsx` | Portal (`document.body`) + `position:fixed` a partir de um `anchor: HTMLElement`; evita corte por `overflow-y-auto` (mesmo problema que o `Select.tsx` resolve para dropdowns). Usado por `IconColorPicker` e pelos popovers de menu (`...`, `+`) da Sidebar — **nunca** usar `position:absolute` para popover dentro de uma lista rolável, sempre `FloatingPanel`. |
| Painel de tarefas | `components/tasks/TaskPanel.tsx` | Abas/agrupamento/visões — reutilizável |
| Quadro branco | `components/tasks/WhiteboardView.tsx` | Desenho livre + formas BPMN, por escopo |
| Nova visualização | `components/tasks/NewViewModal.tsx` | Modal único de "+ Visualização", qualquer escopo |
| Filtro de período | `components/ui/DatePeriodPicker.tsx` | Seletor de campo de data + período (relativo/exato); exporta `MiniCalendar`/`quickDateOptions`/`fmtShort`, reusados pelo `DueDatePicker` |
| Prazo de tarefa | `components/ui/DueDatePicker.tsx` | Único seletor de **data única** de tarefa (atalhos + `MiniCalendar` + "Remover prazo"); usado na célula da lista (`TaskRow`, `variant="row"`) e na propriedade "Prazo" (`TaskDetail`, `variant="side"`) — não confundir com o `DatePeriodPicker` (esse é para filtros de período, não para o campo `Task.dueDate`) |
| Responsável de tarefa | `components/ui/AssigneePicker.tsx` | Único seletor de responsável; lista nomes já usados em outras tarefas do workspace (`getAllAssignees()`) + campo para digitar um novo — não há cadastro de pessoas/membros no app (single-user local). Usado na célula da lista e na propriedade "Responsável" |
| Resolução de datas | `lib/dateFilter.ts` | `resolvePeriodRange`, `matchesDateFilter`, `isoDate`, `parseISO` |
| Visualizações personalizadas | `lib/customViews.ts` | `applyCustomViewFilter` sobre `CustomProjectView` |
| Linha de tarefa | `components/tasks/TaskRow.tsx` | Ícone de tipo, status, seletor de tipo |
| Lista | `components/tasks/TaskList.tsx` | Agrupamento da lista |
| Seletor de emoji | `components/ui/EmojiPicker.tsx` | Ícones de espaço/pasta/projeto |
| Espaço/Pasta | `views/SpaceFolderView.tsx` | Telas que abrem ao clicar no nome |
| Store | `stores/useAppStore.ts` | Estado, ações, persistência |

---

## 9.1. Regras que saíram da auditoria de 29/07/2026

> Auditoria do projeto inteiro (88 arquivos). O que segue são **defeitos corrigidos** cuja
> causa era estrutural — cada linha aqui existe para não voltar.

- **Nada sobe para a nuvem antes do primeiro snapshot** (`cloudReady`, `useAppStore`). Em
  navegador novo o `init()` cria os projetos de exemplo, e o push levava esse **seed** por
  cima dos dados reais da conta. Semear grupo vazio é explícito (`pushToCloud({force:true})`).
- **Snapshot remoto vazio não apaga o local.** `tasks` ganhou a mesma guarda que `projects`
  já tinha; sem ela um campo ausente zerava o trabalho todo.
- **Excluir tarefa ou projeto apaga os anexos na nuvem** (`deleteAttachmentsOf`). Antes o
  app só subia blobs, nunca apagava — cada foto excluída ficava consumindo cota para sempre.
- **Ação nunca pode existir só no hover.** Celular não tem hover: a variante correta é
  `md:opacity-0 md:group-hover:opacity-100` (visível no toque, discreta no mouse). A ação
  principal da caixa de entrada estava inacessível no telefone por causa disso.
- **A navegação mostra todos os destinos.** Caixa de entrada, Minhas tarefas e Todas as
  tarefas ficam no topo nos dois modos da sidebar; antes cada modo esconde metade dos
  destinos e trocar de tela exigia trocar o modo.
- **Preferência de trabalho sincroniza; preferência de dispositivo, não.** Visualização e
  agrupamento por escopo vivem em `viewPrefs` (sincronizado); largura de painel, tema e
  recolhimento da sidebar continuam locais. **Chaves de IA nunca vão para a nuvem** — e por
  isso existe o `AiKeyNotice`, que explica o modo simplificado em vez de falhar em silêncio.
- **`ErrorBoundary` no `main.tsx`**: exceção de render dava tela branca. A tela de erro diz
  que os dados estão salvos, mostra a mensagem e permite copiar os detalhes.
- **`SyncIndicator`**: falha de sincronização é visível fora das Configurações; sucesso
  aparece por segundos e sai.
- **Cálculo derivado precisa resistir a dado velho.** `goalHealth` quebrava a tela com
  `targets: null` (registro antigo ou escrita parcial). Toda função que lê lista vinda do
  armazenamento deve tolerar ausência.
- **Container de tela é `flex-col`.** O Calendário era `flex` sem direção, então o cabeçalho
  ficava *ao lado* da grade e comprimia o mês a 14px de célula no telefone.
- **Grade não sobrevive a tela estreita**: abaixo de `md` o Calendário vira agenda (só os
  dias com tarefa, com o título legível).
- **Índice não é chave** quando o item tem identidade e a lista muda; em grade de calendário
  e barras de gráfico, onde a posição é fixa, o índice é correto.
- **Testes e CI**: `lib/__tests__` cobre as regras derivadas (metas, projetos, automações,
  relatórios) e o workflow roda tipos + testes + build em cada push. Regra nova em `lib/`
  entra com teste.

---

## 9.2. Prazo: sempre por `lib/dueDate.ts`

Nunca usar `new Date(t.dueDate)` direto. Prazo é gravado como `'YYYY-MM-DD'`, e o construtor
do `Date` lê data pura como meia-noite **UTC** — em UTC−3 isso produzia dois defeitos
visíveis em toda a interface (corrigidos em 01/08/2026):

1. **A data aparecia um dia antes.** Prazo 20/08 saía como "19 de ago." na lista, no board,
   na tabela e nas notificações.
2. **Tarefa que vencia hoje já nascia atrasada.** O prazo de hoje virava "ontem 21h", menor
   que "agora", então a tarefa aparecia em vermelho no dia em que ainda havia o dia inteiro
   para fazê-la.

O segundo **não** se resolve só trocando o parser: mesmo lendo como meia-noite local, o prazo
de hoje continua menor que "agora" às 11h. Atraso é medido contra o **começo de hoje**.

- `estaAtrasada(dueDate, status, agora?)` — a única forma de decidir atraso. Concluída nunca
  é atraso; vencer hoje não é atraso.
- `venceHoje(dueDate, agora?)`, `formatarPrazo(dueDate, opcoes?)`, `inicioDeHoje(agora?)`.
- Comparação só para **ordenar** pode usar timestamp (o deslocamento é igual para todos e não
  muda a ordem), mas prefira `parseISO` para o valor não divergir do que a tela mostra.

---

## 9.3. Filtros da lista de tarefas

- **"Ocultar concluídas" vem ligado** (`TaskPanel`, chave `<escopo>_hideDone` em `viewPrefs`).
  Agrupado por prioridade, prazo ou responsável, a lista enchia de tarefas riscadas ocupando
  o espaço do que falta.
- **Visões organizadas por status ignoram o filtro**: a lista agrupada por Status tem o grupo
  "Concluído" e o Board tem a coluna "Concluído" — esconder ali esvazia justamente o que se
  foi ver. Nessas duas o botão aparece **desativado com a explicação no título**; sumir com
  ele faria a barra pular de lugar a cada troca de aba.
- **Concluída com pendência abaixo continua aparecendo** (`lib/taskFilters.ts`,
  `somentePendentes`). Descartar um pai fechado cedo levaria junto a subtarefa que falta. É a
  mesma regra da exportação em Markdown — mora em lib compartilhada porque divergir seria pior
  que duplicar.
- **O botão "Filtros" é do `TaskPanel`**, não da tela de projeto: espaço, pasta e projeto têm
  o mesmo painel. Dois gatilhos para o mesmo painel seria duplicidade.
- **O painel de filtros sobrepõe, não empurra** — mesma decisão do bloco de notas (seção
  13.5): era `w-64 flex-shrink-0` e estreitava as colunas justamente quando se queria olhar os
  dados. Sem scrim, fecha no X ou no Esc.

---

## 9.4. Captura por voz e captura inteligente

- **`lib/smartCapture.ts` entende, numa frase só**: prazo, prioridade, **projeto** (pelo nome
  cadastrado), **#etiquetas**, **@responsável** e **tipo de tarefa**. Determinístico e
  testável — sem chave de IA e sem custo.
- **Sem projeto dito, vai para a Caixa de entrada** (pedido explícito). Escolha manual na
  interface vence o que foi detectado.
- **Ordem das regras importa**: etiquetas e responsável são extraídos **antes** de prazo e
  prioridade. Rodando depois, a etiqueta `#urgente-cliente` era comida pela regra de
  "urgente" e chegava pela metade.
- **A palavra do tipo continua no título**, ao contrário dos outros campos: "amanhã" e
  "urgente" são metadado disfarçado de texto e saem, mas "reunião com fornecedor" viraria
  "com fornecedor".
- **Projeto casa sem acento**, dos dois lados (`semAcento`, mapa 1-para-1 e não `NFD`, para
  os índices continuarem valendo): transcrição de fala vem sem acento, e "migracao de rede"
  precisa achar "Migração de rede". Nome com menos de 3 letras é ignorado — casaria em
  qualquer frase.
- **Voz** (`lib/speech.ts`): Web Speech API em pt-BR, rodando no dispositivo, sem chave e
  sem custo. O microfone só aparece quando `suportaFala()` — Firefox não tem, Safari é
  irregular; oferecer um botão que falha ao toque é pior que não oferecer.
- **Widget de tela inicial não existe para PWA.** O pedido original pedia isso; nenhuma API
  da web cria widget — exige app nativo. O mais próximo é o **atalho no ícone**
  (`shortcuts` no manifesto → `/?acao=voz`), que abre a captura já ouvindo. O parâmetro é
  apagado da URL logo em seguida, senão recarregar a página reabriria o microfone sozinha.

---

## 10. Fluxo de trabalho

- **Publicar é nos dois lugares** (29/07/2026 — substitui a regra anterior de push manual):
  entrega aprovada vira commit + `git push origin main`, e a Vercel faz o deploy de produção
  sozinha a partir daí (integração Git, projeto `gerenciador-de-projetos`, domínio
  `gerenciador-de-projetos-silk.vercel.app`). Não existe mais "subir só no GitHub" nem
  "subir só na Vercel": deixar commit parado no local significa produção desatualizada.
  Depois do push, **conferir o deploy** — build verde e a página no ar.
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
- A caixa de entrada usa o `ColumnHeaders` em **modo legado** (sem reordenar/ordenar), mas
  **com colunas personalizadas e botão de adicionar** (as colunas da inbox ficam em
  `inboxColumns` no store, persistidas em `tf_inbox_columns`).
- **Clicar numa célula edita o campo inline** (prioridade, prazo, responsável, campos
  personalizados) — nunca abrir a tarefa. As células têm `stopPropagation`; só o nome abre a tarefa.
- O alinhamento é sagrado: cada valor fica **exatamente sob o cabeçalho da sua coluna**.
  O ícone de arrastar (grip) é flutuante (absoluto) para não deslocar o rótulo.

### 11.1. Modal "Adicionar Campo" (duas abas, estilo ClickUp)

- `components/ColumnsModal.tsx` tem duas abas: **"Criar novo"** (cria um campo
  personalizado do zero) e **"Adicionar um existente"** (liga/desliga a visibilidade
  de colunas do sistema e personalizadas já existentes, sem duplicar).
- Tipos de campo em "Criar novo": texto, texto longo, número, dinheiro, data, lista
  suspensa, rótulos (multi-seleção), caixa de marcação, link, site, e-mail, telefone,
  pessoas e avaliação (estrelas) — conjunto ampliado e prático, não uma réplica 1:1
  do ClickUp. Novo tipo entra em `COLUMN_TYPES` (`ColumnsModal.tsx`) + render/edição
  em `CustomFieldCell.tsx` + render de leitura em `TaskRow.tsx` + `cmpValue`
  (`lib/taskColumns.ts`) se for ordenável.
- "Adicionar um existente" lista: colunas base sempre disponíveis (Tags, Responsável,
  Prazo, Prioridade), colunas personalizadas já criadas (com renomear/excluir) e a
  seção **"Propriedades"** com colunas do sistema ocultas por padrão (Data de criação,
  Data de atualização, Tipo de tarefa) — ligadas por toggle.
- Visibilidade é **por escopo** (`scopeKey`), guardada em `localStorage`
  (`tf_colhidden_${scope}` para ocultas, `tf_colextra_${scope}` para propriedades
  extras ligadas), via `lib/taskColumns.ts` (`toggleColumnHidden`,
  `toggleExtraColumn`). Como esse estado não vive no React state, toda alteração
  chama `bumpColumnsVersion()` no store para forçar a lista a recalcular as colunas.
- `openColumnsModal(id, scope)` recebe o `scopeKey` como segundo parâmetro — sempre
  passar o `scopeKey` da tela (não só o id do projeto), senão a visibilidade vaza
  entre escopos diferentes.

### 11.2. Campos de IA (gradiente estilo Gemini)

- Colunas/campos **gerados por IA** são um tipo à parte dentro do mesmo sistema de
  `ColumnType` (`types/index.ts`), nunca uma UI paralela. Fonte única: adicionar o
  tipo em `ColumnType` + `AI_COLUMN_TYPES`/`isAIColumnType` (`types/index.ts`) para
  ele herdar automaticamente o tratamento visual de IA em qualquer lugar que exiba
  campos (cabeçalho de coluna, modal "Adicionar Campo", célula).
- **Identidade visual**: gradiente azul → roxo → rosa (estilo Gemini), classes
  utilitárias únicas em `index.css` (`.ai-gradient-bg`, `.ai-gradient-text`,
  `.ai-gradient-ring`, `.ai-generating` para o estado "gerando"). Nunca cravar o
  gradiente solto — sempre essas classes. No `ColumnsModal.tsx` os campos de IA
  ficam numa seção própria ("Campos com IA") acima da grade normal, com selo "IA".
- **Primeiro campo**: `ai_summary` ("Resumo de conclusão") — ao a tarefa ir para
  Concluído, `useAppStore.updateTask` dispara `generateAISummaries` (mesmo padrão de
  `runAutomations` no `status_changed`), que gera o resumo a partir de subtarefas
  (`getSubtasks`) e checklists da tarefa e grava em `customFields[colId]`.
- **Geração híbrida** (`lib/aiSummary.ts`): sem chave configurada, monta um resumo
  local determinístico (sem chamada externa); com `geminiApiKey` configurada
  (`useSettingsStore`, mesmo padrão do `openAIKey` do `AIPanel`), chama a API do
  Gemini de verdade e cai para o resumo local se a chamada falhar. Botão de
  regenerar manual e configuração da chave ficam no próprio popover da célula
  (`CustomFieldCell.tsx` → `AISummaryCell`) — não duplicar em outra tela.
- Estado de "gerando" é global no store (`aiGeneratingKeys`), não local ao
  componente, para sobreviver a navegação/fechar e reabrir a tarefa.

## 12. Criação contínua

- Em tarefa, subtarefa, checklist e item de checklist: **Enter cria e já abre o próximo
  vazio** (fluxo contínuo). Esc fecha. Vale para `QuickAddRow` e para os inputs do `TaskDetail`.
- A **primeira** checklist de uma tarefa abre com o nome "Checklist" pré-preenchido.

## 13. Caixa de entrada (Inbox)

- O menu "Mover para" mostra **apenas projetos ativos** (não arquivados / que ainda existem).
- Ao mover, a tarefa recebe o projeto e volta para "A fazer".
- Tarefas da caixa de entrada **não aparecem** em "Todas as tarefas" nem "Minhas tarefas"
  (só entram nas listas depois de receberem um projeto).
- **Captura rápida** (`components/QuickCapture.tsx`): estado global no store
  (`quickCaptureOpen`/`openQuickCapture`/`closeQuickCapture`/`toggleQuickCapture` em
  `useAppStore.ts`, mesmo padrão de `filterPanelOpen`/`aiPanelOpen`) em vez de estado local
  do `App.tsx` — assim qualquer tela pode abrir o modal (não só o atalho de teclado). Botão
  **"Nova tarefa"** no cabeçalho de "Todas as tarefas" (`AllTasksView.tsx`) chama
  `openQuickCapture()`; sem projeto escolhido no modal, a tarefa cai na Caixa de entrada.

## 13.1. Arrastar projetos (sidebar)

- Projetos podem ser **arrastados** para: reordenar (soltar sobre outro projeto), mover para
  uma **pasta** (soltar no cabeçalho da pasta), mover para a **raiz de um espaço** (soltar no
  cabeçalho do espaço) ou tirar do espaço (soltar em "Sem espaço").
- Reordenar usa `reorderProject(draggedId, targetId)`; mover usa `moveProject`. O alvo válido
  fica destacado com um anel (`ring-brand-400`) durante o arraste.

## 13.2. Fluidez (arrastar, teclado, desfazer, animações)

- **Arrastar tarefas** na lista: soltar sobre outra reordena (`reorderTask`). Além disso, o
  arraste **transfere o campo do agrupamento ativo** — soltar num item (ou na área) de outro
  grupo muda esse campo via `updateTask`: agrupado por Status muda o status, por Prioridade
  muda a prioridade, por Projeto muda `projectId` (move a tarefa para o projeto), por
  Responsável muda o `assignee`. Agrupado por Prazo não transfere nada (é só ordenação).
  Lógica central em `TaskList.tsx` (`groupField`/`applyGroupTransfer`). Só tarefas-raiz
  (depth 0) arrastam.
- Também é possível soltar **na área vazia do grupo** (não só em cima de outra tarefa) —
  útil para grupos com poucas tarefas; `onDrop` no container do grupo chama
  `handleDropOnGroup`. Os grupos de **Status** e **Prioridade** são sempre renderizados
  (mesmo vazios) para servirem de alvo; **Projeto** e **Responsável** só aparecem quando
  já têm alguma tarefa no escopo (evita listar todos os projetos do sistema numa tela
  de Espaço/Pasta).
- **Arrastar pastas e espaços** na sidebar para reordenar (`reorderFolder`/`reorderSpace`),
  além de projetos (item 13.1).
- **Atalhos de teclado** na lista: `j`/`k` (ou ↓/↑) navegam, `e` abre a tarefa em foco,
  `espaço` conclui/reabre. Ignorados quando o foco está num campo de texto.
- **Nome da tarefa na lista é renomeável por duplo-clique** (`TaskRow.tsx`), mesmo gesto
  de renomear já usado na sidebar (seção 3) — clique único continua abrindo o painel da
  tarefa. Substitui a ideia original do protótipo (1/2/3 cliques para
  expandir/abrir/renomear) por um gesto já estabelecido no app, mais previsível.
- **Desfazer**: `Ctrl/Cmd+Z` reverte mover/excluir/reordenar/arquivar via pilha de
  snapshots no store (`pushUndo`/`undo`). Toda ação destrutiva/de movimentação chama
  `pushUndo()` antes de alterar.
- **Animações**: `.animate-fade-in` (em `index.css`) ao expandir grupos da lista e
  espaços/pastas. Preferir CSS a dependências externas.
- **Alvo de drop** sempre destacado com `ring-brand-400` durante o arraste.
- A **largura do painel da tarefa** é salva por usuário (`tf_taskpanel_width`).

## 13.3. Relatórios (painel analítico)

> Reconstruído em 29/07/2026. Estrutura: **cabeçalho** (filtros) → **resumo executivo** →
> **KPIs** → **abas** (Fluxo · Progresso · Distribuição · Riscos). Resumo e KPIs ficam
> sempre visíveis; o detalhe vive nas abas, senão a tela vira uma parede de doze blocos.
> Mesmo padrão de abas do `TaskPanel`, com a escolha lembrada (`tf_reports_tab`).

- **Cálculos ficam em `lib/reportMetrics.ts`**, não na view: intervalos (`effectiveRange`,
  `previousRange`), KPIs (`computeKpis` — inclui lead time, idade do backlog e paradas),
  variação (`delta`), série do gráfico (`buildSeries`) e agrupamentos (`bySpace`, `byTag`,
  `byAssignee`, `topByGut`, `averageProgress`). Métrica nova entra ali, com teste mental de
  "isso é calculável com os dados que existem?".
- **Comparação com o período anterior** (`previousRange`) só aparece onde é medível:
  concluídas e criadas. **"Em atraso" e "urgentes" não têm variação** — seriam a foto de
  hoje contra uma foto de ontem que o app não guarda (não há histórico de status). Não
  inventar esse número depois.
- **Gráfico de fluxo** (`components/reports/ActivityChart.tsx`): duas séries — criadas ×
  concluídas — com grade e escala "bonita" (1/2/5/10). É o que responde "entra mais do que
  sai?". Granularidade acompanha o recorte (dia ≤14, semana ≤92, senão mês; teto de 24
  barras).
- **Todo indicador leva a uma lista**: `components/reports/TaskListModal.tsx` é o único
  drill-down do painel (KPIs, prioridade, etiquetas, pessoas, paradas), com exportação
  própria e clique que abre a tarefa no projeto. Não criar um segundo modal de lista.
- **Peças visuais** em `components/reports/ReportPrimitives.tsx` (`Section`, `KpiCard`,
  `DeltaBadge`, `MiniBar`, `EmptyState`) — reusar, não recriar molduras por seção.
- **Cores de prioridade vêm de `PRIORITY_OPTIONS`** (`Select.tsx`), nunca redigitadas: o
  painel antigo tinha a paleta duplicada e não acompanhava mudanças do design system.
- **Exportação**: `lib/exportCsv.ts` (`downloadCsv`) é a fonte única — separador `;` e BOM
  UTF-8 porque o destino é o Excel em português. Usado no botão CSV do cabeçalho e dentro
  do modal de lista.
- **Impressão**: bloco `@media print` no `index.css` com `print-color-adjust: exact`
  (sem ele as barras e selos saem brancos), sidebar oculta, scroll liberado e
  `print:break-inside-avoid` nos cartões. **As abas inativas usam `hidden print:block`** —
  na tela aparece uma, no papel sai o relatório completo.

### 13.3.2. Resumo para a reunião (IA híbrida, 30/07/2026)

- Card **"Resumo para a reunião"** logo abaixo do resumo executivo
  (`components/reports/MeetingReviewCard.tsx`): um clique transforma o recorte atual do
  painel no **texto de abertura da reunião de resultados**, com Copiar e Regenerar.
- A lógica vive em `lib/aiMeetingReview.ts`, no **padrão híbrido do app** (o mesmo do
  resumo de conclusão em `aiSummary.ts`): `buildLocalMeetingReview` é a narrativa local
  determinística — sempre disponível, testada em `lib/__tests__/aiMeetingReview.test.ts`
  — e `generateMeetingReview` usa o Gemini quando há chave (via `callGemini`, exportado
  de `aiSummary.ts` como fonte única da chamada). **Todo recurso de IA novo segue esse
  padrão**: funciona sem chave (modo local honesto), melhora com chave, nunca lança.
- Estrutura do texto: abertura (entregas × período anterior × entrada de trabalho),
  "Principais entregas" agrupadas por projeto, "Pontos de atenção" (atrasadas/urgentes)
  e "Próximos 7 dias" (`dueSoonTasks` na `ReportsView`).

### 13.3.1. Recorte e filtros

- O card **"Concluídas esta semana" é clicável** → abre um modal com a lista das tarefas
  concluídas naquela semana, com **seletor de data** (Anterior/Próxima + campo de data)
  para navegar para outras semanas (inclusive a anterior).
- **Recorte de datas no cabeçalho** (29/07/2026): usa o `DatePeriodPicker` (seção 4.3, o
  único seletor de data de período do app — não criar input de data novo aqui), com os três
  campos (`completedAt`/`dueDate`/`createdAt`), presets relativos e **entre datas**. A
  escolha é lembrada em `tf_reports_datefield`/`tf_reports_period`.
- **Filtros de escopo** ao lado do recorte: espaço, projeto, responsável e etiqueta, via
  `Select` (proibido `<select>` nativo, seção 8), cada um lembrado em `tf_reports_*`. O
  escopo é aplicado **antes** do recorte de datas; "Limpar" zera tudo de uma vez.
- **Duas naturezas de métrica, e o recorte não vale para as duas** — regra que não pode ser
  "simplificada" depois:
  - **Retrospectivas** (concluídas no período, gráfico, lista do modal) usam o recorte.
  - **Estado atual** (em atraso, urgentes ativas, taxa de conclusão, saúde dos projetos,
    distribuição por prioridade, carga da equipe) usam `currentTasks`, que **ignora o
    recorte quando o campo é `completedAt`**: tarefa não concluída não tem data de
    conclusão, então cairia fora do recorte e o painel inteiro zeraria — um relatório de
    "o que fizemos em julho" não pode afirmar que hoje não há nada atrasado. Com
    `dueDate`/`createdAt` o recorte vale para tudo, porque toda tarefa tem esses campos.
- **O gráfico troca de granularidade** conforme o tamanho do recorte (≤14 dias → por dia,
  ≤92 → por semana, acima → por mês, no máximo 24 barras) e as barras contam as tarefas do
  recorte posicionadas pelo **campo de data escolhido** — por isso o título muda entre
  "Concluídas", "Vencimentos" e "Criadas". Sem recorte, mantém os últimos 7 dias.
- Períodos abertos ("antes de", "depois de") não têm um dos lados: o eixo cai para a
  menor/maior data das tarefas do recorte.

## 13.4. Automações (reconstruídas em 29/07/2026)

> A versão anterior tinha três problemas que não eram de design: **"Prazo chegou" nunca
> disparava** (não havia executor), **"Notificar" e "IA: enriquecer" não faziam nada**
> (`runAutomations` só tratava três ações) e **não havia condição** — "status alterado"
> disparava em qualquer mudança, então "concluído → notificar" notificava ao mover para
> "em progresso". Nada disso pode voltar.

- **Regras do motor em `lib/automationEngine.ts`**: `matchesTrigger` (escopo + condições),
  `describeTrigger`/`describeAction`/`describeAutomation` (a frase em português usada no
  card **e** na pré-visualização do editor — uma fonte só) e `RECIPES`. Gatilho ou ação
  nova entra ali junto com o rótulo e a descrição.
- **Condições no gatilho** (`AutomationTrigger`): `to`/`from` (`ANY` = qualquer),
  `tag`, `priority` e `daysBefore` (prazo). `migrateAutomation` preenche regras antigas
  com `ANY`, preservando o comportamento que elas tinham.
- **Ações**: status, prioridade, responsável, **etiqueta, prazo relativo, mover de projeto,
  comentar**, notificar e resumo por IA. Todas executam de verdade em `applyAutomation`
  (`useAppStore`), que também decide entre `ok`/`skipped`/`error`.
- **Gatilho de prazo**: `runDueDateAutomations()` roda no carregamento e a cada minuto,
  junto com a geração de notificações (`App.tsx`). É **idempotente por dia** (consulta o
  histórico antes de repetir) — sem isso o ciclo de 1 minuto dispararia a mesma regra
  sessenta vezes por hora.
- **Guarda de cadeia** (`MAX_AUTOMATION_DEPTH = 5`): automação que altera a tarefa dispara
  o gatilho de novo, e duas regras cruzadas (A: a fazer→em progresso, B: em progresso→a
  fazer) travariam o app num laço infinito. Acima do limite a execução vira `skipped` com
  o motivo no histórico, em vez de silêncio. **Não remover essa guarda.** A tela ainda
  marca com um selo as regras que alteram o mesmo campo que as dispara.
- **Histórico** (`AutomationRun`, `tf_automation_runs`, últimas 200): aba própria na tela,
  com resultado e o que mudou em cada tarefa; alimenta também o "N× · última ..." de cada
  card. É como se responde "essa automação chegou a rodar?".
- **Criar com IA** (30/07/2026): barra no topo da aba Regras — a frase em português
  ("quando faltar 2 dias para o prazo, me avise") vira gatilho + ação via
  `lib/aiAutomationBuilder.ts` (`parseAutomationLocal` determinístico primeiro; Gemini
  JSON estrito para frases mais soltas, validado contra os tipos existentes). O
  resultado **sempre abre no editor para revisão** — nunca salva direto. Frase não
  entendida orienta o formato "quando X, então Y". Gatilho/ação novos no motor devem
  entrar também no parser e no prompt.
- **Notificação de automação**: `useNotificationStore.push` cria uma notificação do tipo
  `automation`, e `generate` **preserva** as desse tipo — ele roda a cada minuto e, se
  substituísse a lista inteira, o aviso sumiria antes de ser lido.
- **Tela** (`AutomationsView`): abas Regras/Histórico, receitas com o **porquê** de cada
  uma, busca, filtro por projeto, e cada regra com editar (`AutomationEditor`, criar **e**
  editar — antes só dava para apagar e refazer), duplicar (nasce desligada), pausar e
  excluir.

- **Pasta sempre mostra o chevron de recolher**, com ou sem projeto dentro — igual ao
  espaço. Condicionar a "ter projeto" produzia uma barra em que algumas pastas tinham o
  controle e outras não, sem regra visível; e pasta vazia **tem** o que recolher, porque
  renderiza o rótulo "Vazia".
- **Criar ou mover item revela o contêiner** (`revelarContainer`, Sidebar). Item novo nasce
  em modo de renomear; se o espaço ou a pasta estiver recolhido, a linha nem é renderizada —
  o campo de nome nunca aparece e o projeto fica preso como "Novo Projeto". Vale para criar
  projeto, criar pasta, mover pelo menu e soltar arrastando: em todos, o contêiner de destino
  abre antes.
---

## 13.7. Lista de projetos (reformulada em 29/07/2026)

> Dois furos, os dois de produto: a tela **ignorava a hierarquia** (grade plana, apesar de
> Espaço → Pasta → Projeto ser o princípio "inquebrável" da seção 2) e **não dizia se o
> projeto ia bem** — mostrava GUT, porcentagem e contagens soltas, então 3 atrasadas em 5
> tarefas parecia igual a 3 em 50.

- **Agrupa por Espaço › Pasta** (`groupBySpace` em `lib/projectMetrics.ts`), com alternância
  para lista corrida. O cabeçalho de grupo mostra o caminho e a contagem. Tela nova que
  liste projetos deve respeitar essa hierarquia.
- **Saúde derivada** (`projectHealth`): `critical` quando um terço ou mais do trabalho aberto
  está atrasado (ou GUT ≥ 80 com qualquer atraso), `idle` a partir de
  `PROJECT_IDLE_DAYS` (21) sem movimento, `attention` com atraso/urgência pontual,
  `healthy`, `done` e `empty`. **Fração, não contagem** — é o que diferencia 3 em 5 de 3 em
  50. O motivo vai escrito no card, como nas metas (seção 13.6).
- **Progresso real** vem de `averageProgress` (subtarefas e checklists), não da contagem de
  status da raiz.
- **Prazo do projeto é derivado** (`nextDue`/`lastDue` das tarefas abertas): o modelo
  `Project` não tem campo de prazo, e inventar um exigiria manutenção manual.
- **Busca, filtro por estado e ordenação** (risco por padrão, GUT, prazo, progresso, nome).
  A ordem era fixa por GUT, sem busca — impossível achar algo com 30 projetos.
- **Excluir vive no menu `⋯`, em dois passos**, e o segundo diz o que será perdido
  ("Excluir e apagar 4 tarefas"). Antes era duplo-clique na lixeira do cartão com um
  "Confirmar?" genérico — a ação mais destrutiva do app na affordance mais frágil.
- **`CardProjeto` mora fora do componente de tela.** Estava declarado dentro do
  `ProjectsListView`, então o React recriava o tipo a cada render e remontava os cartões.
- A **legenda GUT** fixa no topo saiu (quatro pílulas com cores cravadas, duplicando
  `gutTier`); o rótulo do tier agora vive no `title` do badge.

---

## 13.6. Metas (reformuladas em 29/07/2026)

> O problema não era visual: **o status era um campo escolhido à mão que nunca se
> atualizava**. Meta com prazo vencido e 20% de progresso seguia exibindo "No caminho" até
> alguém lembrar de editar — pior que não ter status, porque parecia medido. Não voltar a
> tratar `status` como entrada do usuário.

- **Status é derivado** (`lib/goalMetrics.ts` → `goalHealth`): compara progresso com o
  percentual do prazo já decorrido (folga de 10 pontos para "no caminho", 25 para "em
  risco"; prazo vencido = atrasada). Só `status === 'done'` é respeitado como decisão do
  usuário — o editor não tem mais seletor de status, tem "Marcar como concluída" no menu.
- **O card mostra o motivo**, não só a cor: "75% feito, mas 88% do prazo já passou". Cor
  sem explicação obriga o usuário a confiar sem entender.
- **Alvo do tipo `tasks`** conta as **tarefas concluídas** de um projeto/etiqueta
  (`targetCurrent`): progresso que se atualiza sozinho, fechando o ciclo trabalho → meta —
  o mesmo princípio da nota que vira tarefa (seção 13.5). Alvo automático não é editável no
  card, e o ícone `ListChecks` sinaliza isso.
- **Atualizar valor acontece no card** (`updateGoalTarget`), clicando no número. Era o
  gesto mais frequente e o mais caro: abrir modal, achar o alvo, salvar.
- **Meta parada** é sinalizada a partir de `GOAL_IDLE_DAYS` (21) sem alteração na meta nem
  nos alvos — `GoalTarget.updatedAt` existe para isso.
- **Resumo no topo** com progresso médio, quantas precisam de atenção e quantas estão
  paradas; **ordenação** por risco (padrão), prazo, progresso ou nome.
- **O relatório usa o mesmo `goalHealth`** — as duas telas não podem divergir. A função
  `goalProgress` de `types` está **deprecada** (não resolve alvos `tasks`).
- **Cores vêm de `PROJECT_COLORS`**; a lista antiga tinha paleta própria (`#22C55E`,
  `#F59E0B`, `#06B6D4`) fora do sistema. Prazo usa o `DueDatePicker`, não `input[type=date]`
  (seção 4.3). Ações no menu `⋯`, como no resto do app.

---

## 13.5. Bloco de notas (reformulado em 29/07/2026)

> A versão anterior era um Notepad embutido: as notas ficavam soltas no `localStorage`
> (gravadas com `localStorage.setItem` direto, **fora** do `saveJSON` — então **não
> sincronizavam**: escrever no computador e não achar no celular), viviam em **abas** (que
> não escalam numa coluna de 320px), nasciam chamadas "Nota 1" e não tinham como virar
> nada. Nenhuma dessas três coisas pode voltar.

- **Nota é dado do app** (`Note` em `types/index.ts`, ações no `useAppStore`): entra no
  documento de sincronização junto com tarefas e metas. `migrateNote` converte as notas
  antigas (só `id/title/body/updatedAt`) na primeira carga.
- **Toda nota tem destino**: `noteToTask(id, projectId)` cria a tarefa (primeira linha =
  título, resto = descrição), abre a tarefa nova e apaga a nota. É a ponte entre anotar e
  fazer — sem ela, o bloco de notas é um app à parte dentro do app.
- **Lista com busca, não abas**: a busca aparece a partir de 5 notas; fixadas primeiro,
  depois as mais recentes. Uma aba por nota não sobrevive a 10 notas em 360px.
- **Título derivado da primeira linha** (`noteDisplayTitle`) — nomear é opcional. Nomes
  automáticos ("Nota 1", "Nota 2") obrigavam a renomear tudo para achar depois.
- **Mestre-detalhe, nunca os dois juntos**: em painel estreito a lista ocupa a área toda e
  o editor a substitui, com volta explícita. Cada ação tem **um** caminho (o painel antigo
  tinha dois para renomear e dois para excluir, na mesma coluna).
- **Grava numa pausa da digitação** (500ms). Antes cada tecla escrevia no armazenamento;
  agora que a nota sincroniza, isso viraria uma rajada de escritas na nuvem.
- **Cor**: neutro com brand nos destaques. A versão anterior usava âmbar (`warning-*`)
  como identidade — depois da consolidação (seção 8.2), `warning` significa **aviso** e não
  pode ser cor decorativa de um recurso.
- **Painel redimensionável** (300–560px, lembrado em `tf_notes_width`) e **tela cheia no
  celular** (`fixed inset-0` até `md`). Era fixo em 320px, ao contrário do resto do app.
- **Estado vazio de verdade**, explicando para que serve o recurso: antes existia sempre
  uma "Nota 1" vazia, então nunca havia primeiro contato.

### Janela flutuante (30/07/2026)

- **O painel não ocupa espaço no layout.** Era `md:relative`, participava do flex e
  *empurrava* a lista de tarefas: abrir uma nota reorganizava a tela e mudava a largura das
  colunas. Agora é `fixed` ancorado no canto inferior direito (`md:right-5 md:bottom-5`,
  altura `min(680px, 100vh - 7rem)`), por cima do conteúdo. **Medido**: a área de conteúdo
  fica em 1008px com a janela aberta e fechada.
- **Sem scrim.** Nota se escreve *olhando* para a tarefa; um fundo que capturasse o clique
  impediria exatamente o uso principal. Em troca, **Esc fecha** (primeiro um menu de
  contexto aberto, depois a janela) — sem isso a janela não teria saída pelo teclado.
- **`z-[55]`**, explicitamente entre o painel da tarefa (`z-50`) e o modo tela cheia
  (`z-[60]`): a janela recém-invocada fica por cima, e a ordem não depende de quem aparece
  antes no DOM.
- **Animação própria** (`animate-window-in`, em `index.css`): `scale-in` cresce a partir do
  topo, o que numa janela ancorada embaixo parece que ela desceu.
- **Ícone `NotebookPen`**, no botão da barra, no cabeçalho e no estado vazio. O anterior era
  `StickyNote` num quadrado cinza com hover **âmbar** — âmbar é `warning` (seção 8.2) e nota
  não é aviso. O botão agora tem **estado ativo** (`aria-pressed` + fundo brand) e um
  **ponto** quando existe nota e a janela está fechada. Ponto, não contador: um número
  viraria "9+" e deixaria de informar — a contagem exata já está no cabeçalho da janela.
- O botão vive em `NotesPanel.tsx` (exportado como `NotesButton`), não solto no `TaskPanel`:
  botão e painel mudam pelo mesmo motivo.

---

## 14. Painel da tarefa (TaskDetail) — layout estilo Todoist

- **Duas colunas** (`components/tasks/TaskDetail.tsx`): à **esquerda** a área de escrita
  (título → descrição → subtarefas → checklists → comentários); à **direita** uma coluna de
  **propriedades discreta** (`w-60`, fundo `bg-gray-50/50`, borda `border-l`), com uma
  propriedade por linha via o helper `SideProp` (rótulo pequeno em cima, controle embaixo):
  Projeto (pílula tinta-da-cor com `ProjectIcon`, primeiro item), Status, Prioridade
  (`Select` variante `default` + `colorText` — moldura com borda, igual ao `prop-trigger`
  do protótipo; **não** usar `pill`/`inline` aqui, isso é só para a lista densa, seção
  8.1), Prazo (`DueDatePicker` `variant="side"`), Responsável (`AssigneePicker`
  `variant="side"`), Progresso (só quando há subtarefas ou checklist, seção 4.9),
  Etiquetas.
- A **descrição** é o `BlockEditor` **sempre visível** logo abaixo do título (não é mais
  colapsável e não há botão "+ Conteúdo") — o cursor já cai numa área pronta para escrever.
- **Subtarefas, Checklists e Comentários são colapsáveis** (clique no título/chevron) e têm
  **modo de edição via lápis** (`Pencil`) que revela o **X** de remover em cada item — só
  aparece com o modo ativo, para evitar apagar sem querer (pedido explícito e repetido
  várias vezes ao longo do redesign; não trocar de volta para hover-reveal). Mesma regra
  na seção "Anexos" do `BlockEditor` (14.1). Estados `subtaskEditMode`/
  `checklistEditMode` (por checklist, `Record<string,boolean>`)/`commentEditMode` +
  `subtasksSectionCollapsed`/`checklistCollapsed`/`commentsSectionCollapsed` no
  `TaskDetail`.
- **Subtarefas** têm o botão inline "**+ Adicionar subtarefa**" (nasce com prioridade
  **Baixa** por padrão — `quickAddTask` na store) e mostram, na lista dentro do modal, a
  **cor de status real** (não mais indigo genérico) e um **badge de prioridade** igual ao
  da lista principal. Checklists mantêm o `+` (sempre cria uma nova, permite múltiplas).
  Título do checklist é **renomeável por duplo-clique** (`renameChecklist` na store, mesmo
  gesto de renomear da sidebar — seção 3).
- Em modo lateral, o painel abre **grande (≈55% da janela)** e é redimensionável até ~85%.
  Modo centralizado usa ~860px para caber as duas colunas.
- Quando a tarefa aberta é uma **subtarefa**, uma barra de breadcrumb aparece no topo (nome
  do pai clicável + navegador de irmãs) — ver seção 4.6.

### 14.1. BlockEditor — editor unificado estilo TickTick/Notion

O corpo é **um único documento `contentEditable`** (`.rich-text`), onde texto e **mídia
convivem inline no mesmo fluxo** (a imagem interage com o texto — não vira bloco separado
abaixo). O HTML fica no **primeiro bloco de texto** (`blocks[0].text`, `region: 'body'`).
Como o editor injeta o HTML ao montar, **o conteúdo completo sempre aparece** ao reabrir a
tarefa (corrige o bug do "trecho até dar Enter"). Não recriar um textarea/tiptap paralelo.

- **Formatação inline**: **negrito/itálico** por barra flutuante ao selecionar (botões B/I)
  e atalhos nativos **Ctrl+B / Ctrl+I** (`document.execCommand`).
- **Atalhos estilo Markdown/Notion, automáticos ao digitar** (`autoformat()` em
  `BlockEditor.tsx`, chamado a cada `onInput` antes do `flush`): `- ` ou `* ` → lista com
  marcadores, `1. ` → lista numerada, `# `/`## `/`### ` → Título 1/2/3, `> ` → citação,
  `---` → linha horizontal. Detecta o texto do bloco da linha atual, apaga o
  texto-gatilho e aplica `execCommand` (mesmo mecanismo do menu "+"). Não é a única
  forma de inserir esses blocos — o menu "+" abaixo continua existindo em paralelo.
- **Botão "+" na linha atual** (gutter à esquerda, estilo TickTick): abre um menu com
  **Título 1/2/3, Lista com marcadores, Lista numerada, Item de verificação, Citação,
  Linha horizontal, Imagem e Anexo**. A posição do "+" acompanha o cursor (linha atual),
  calculada por `getBoundingClientRect`. As inserções usam `execCommand`
  (`formatBlock`, `insert*List`, `insertHorizontalRule`, `insertHTML`) sobre o `Range` salvo.
- **Item de verificação (checkbox)**: `div.todo-item[data-checked]` com `span.todo-box`
  (`contenteditable=false`); o clique alterna `data-checked` (delegação em `onEditorClick`)
  e salva. Estilo em `.rich-text .todo-*` no `index.css`.
- **Mídia inline** vive como elemento nativo no HTML (`<img>`, `<audio controls>`,
  `<a class="file-chip">`), tudo `contenteditable=false`, e faz round-trip pelo `innerHTML`.
  Inserir imagem (menu "+"/"Imagem"/**colar**/**arrastar** imagem) coloca `<img>` no cursor;
  **áudio** grava e insere `<audio>` inline (para comentar um trecho específico).
- **Clicar na imagem** abre o **lightbox** (`Lightbox`): sobrepõe tudo, **zoom in/out** por
  botões, roda e teclas `+`/`-`, `1:1` e `Esc`/clique-fora. **Clicar no chip de arquivo/PDF**
  abre **em nova aba** via blob (`openData`) — limitação web: sem invocar o app do SO direto.
- **Seção "Anexos" separada e autossuficiente** (`region: 'attachment'`, `AttachmentRow`),
  **colapsável** (chevron no cabeçalho, `anexosCollapsed`, aberta por padrão) e com
  **modo de edição via lápis** (`attachEditMode`, mesma regra da seção 14 — remover só
  aparece com o modo ativo): itens com **título editável à vista**, imagem com `display`
  `full`/`title` (Evernote; padrão imagem=`full`, PDF/arquivo=`title`), abrir/baixar,
  **"Inserir no texto"** (dobra o anexo no corpo) e remover. Arrastar arquivo
  **não-imagem** cai aqui; imagem cai inline no texto.
- **Migração automática**: mídia solta do modelo antigo (blocos `body` não-texto) é dobrada
  para dentro do HTML do corpo na montagem (efeito em `BlockEditor`). `ContentBlock` tem
  `region?` e `display?` (além de `size?`).
- `openData` (abre anexo em nova aba via blob) é **exportado** do `BlockEditor.tsx` — reusado
  pelos anexos de comentário (14.2) em vez de duplicar a lógica de blob.

### 14.2. Comentários

- Seção "Comentários" (`Task.comments: TaskComment[]`, `types/index.ts`), abaixo de
  Checklists no `TaskDetail`. Cada comentário: autor + hora relativa + texto opcional +
  **anexo** opcional (chip, abre via `openData`) + **áudio** opcional (`<audio controls>`
  inline, gravado com `MediaRecorder`, mesmo padrão de gravação já usado no `BlockEditor`
  para áudio inline na descrição — não recriar essa lógica de captura de microfone de novo,
  só reaproveitar o padrão).
- Linha de adicionar: avatar "DJ" (autor único do app — desde 29/07/2026 existe **login com
  Google** (seção 15), mas o app continua **single-user**: uma conta, um dono, sem membros,
  permissões ou cadastro de pessoas)
  + input (**Enter posta**) + botão de anexar (seletor de arquivo) + botão de gravar áudio
  (alterna gravação, ícone `Mic`/`MicOff`).
- Ações na store: `addComment(taskId, patch)` / `removeComment(taskId, commentId)`
  (`useAppStore.ts`), mesmo padrão de `addChecklist`/`removeChecklist` (mapeia `tasks`,
  persiste via `pProjects`, atualiza `updatedAt`). `addComment` aceita texto e/ou anexo e/ou
  áudio (usado tanto pelo texto simples quanto pelas gravações/anexos).

---

## 15. Login com Google e sincronização entre dispositivos

> **Mudança de modelo (29/07/2026)**: o app passou a ter **tela de login com Google** e os
> dados agora pertencem à **conta**, não a um código compartilhado. O modelo anterior
> (login anônimo + código `TF-XXXXXX`) foi aposentado — não reintroduzir.

- **Tela de login** (`components/auth/LoginView.tsx`, exporta também o `AuthSplash`): é o
  portão de entrada renderizado por `App.tsx` **depois de todos os hooks** (regra dos Hooks
  — colocar o `return` antes deles trava o app com tela branca; já foi bug real). Fluxo:
  `authLoading` → `AuthSplash`; sem usuário → `LoginView`; com usuário → o app.
- **Visual da tela de login** (única tela do app com fundo escuro por padrão — o resto
  continua claro, seção 8): fundo grafite `#08090C` com **halos de cor desfocados**
  (índigo/violeta/azul), **malha fina** com máscara radial e vinheta; no centro, um cartão
  de vidro (`bg-white/[.045]` + `backdrop-blur-xl` + borda `white/10`) com fio de luz na
  borda superior, logo em degradê com glow, nome do produto em maiúsculas espaçadas,
  botão branco do Google e três recursos no rodapé do cartão. `Backdrop` é compartilhado
  pelo `LoginView` e pelo `AuthSplash` — **não** duplicar o fundo. Os efeitos vivem em
  `index.css` (`.login-grid`, `.login-orb`, `.login-orb-a/b`, `.login-rise`,
  `.login-hairline`, com `prefers-reduced-motion` respeitado), não soltos no JSX: são
  camadas de blur/máscara/keyframes que viram sopa de utilitários se ficarem inline.
- **Login com Google** (`src/lib/firebase.ts`): `signInWithGoogle()` tenta **popup** e cai
  para **redirecionamento** quando o navegador bloqueia o popup (comum no celular); o
  retorno do redirect é lido por `consumeRedirectResult()` no `init()` do
  `useAuthStore.ts`. Persistência `browserLocalPersistence` (o celular reabre o app o
  tempo todo — a sessão tem que sobreviver).
- **Erros de login são traduzidos** (`friendlyAuthError`, classe `AuthError`) e aparecem na
  própria tela de login, não no console: provedor não habilitado, domínio não autorizado,
  popup fechado, rede, chave inválida. Ao adicionar um caso novo, traduzir ali — a tela não
  deve mostrar código cru do Firebase.
- **Um documento por conta**: `syncGroups/{uid}`, onde `uid` é o do usuário Google.
  `startCloudSync(uid)` é chamado no `App.tsx` quando o usuário entra; `syncUid` no store
  substituiu o antigo `syncCode`. Entrar com a mesma conta em outro dispositivo já
  sincroniza — **não existe mais código para digitar**, nem `linkToCode`/`generateNewCode`.
- **Migração do modelo antigo** (`migrateLegacySyncCode` em `useAppStore.ts`): no primeiro
  login, se o navegador ainda tiver `tf_sync_code` e aquele grupo existir na nuvem, o
  conteúdo é baixado (com os anexos reidratados do grupo antigo) e reenviado sob o uid;
  `tf_sync_code_migrated` marca que já rodou. Os caches de `cloudAttachments.ts` são
  chaveados por **grupo + id** justamente por causa dessa cópia entre dois grupos.
- **Regras de segurança** (`firestore.rules`): `syncGroups/{uid}` só é lido/escrito pelo
  dono (`group == request.auth.uid`). Grupos legados `TF-*` continuam **apenas legíveis**
  por usuário autenticado, exclusivamente para a migração acima — esse bloco pode (e deve)
  sair quando todos os dispositivos já tiverem migrado.
- **Sem Firebase configurado** (build sem `.env`, ex.: sessão do Claude Code na nuvem) o
  app **pula o login** e roda só com `localStorage` (`USE_FIREBASE`/`localOnly` no
  `App.tsx`). Não é modo de produção — é o que permite abrir o projeto sem segredos.
- **Configuração no Firebase Console** (fora do código, feita uma vez): Authentication →
  Sign-in method → **Google** habilitado; Authentication → Settings → **Authorized domains**
  com `localhost` e o domínio da Vercel. Erro de login em produção quase sempre é um desses
  dois.
- **Armazenamento**: Firestore, documento único `syncGroups/{uid}` com todo o
  estado do app (projetos, tarefas, espaços, pastas, automações, metas, colunas do inbox e
  visualizações personalizadas). `localStorage` continua como cache local instantâneo
  (`localStore.ts`, `saveJSON`/`loadJSON` em `useAppStore.ts`) — a nuvem é a camada de
  sincronização por cima, não substitui o cache local.
- **Conta na UI**: rodapé da sidebar mostra foto/nome da conta Google (não mais "DJ /
  Djemeson" fixo); `SettingsModal.tsx` tem a seção **"Conta e sincronização"** com a conta,
  botão **Sair**, status da nuvem e "Sincronizar agora".
- **Tempo real**: `onSnapshot` no documento do grupo (não é polling). Toda alteração local
  já passava por `saveJSON`/`pProjects`, que dispara `triggerSyncPush` (debounce de 1.5s)
  → `pushToCloud()`. Ao aplicar um snapshot vindo da nuvem, `snap.metadata.hasPendingWrites`
  é checado para ignorar o eco da própria escrita (evita loop push→pull→push).
- **Anexos e áudio** (`Task.comments[].attachment/audio`, `Task.blocks[].data`) são base64
  grandes demais para o documento único do Firestore (limite de 1 MiB). Ficam de fora dele:
  sobem como documentos próprios em `syncGroups/{uid}/attachments/{id}`
  (`src/lib/cloudAttachments.ts`, `stripAndUploadAttachments`/`hydrateAttachments`).
  **Anexos acima de ~900KB não sincronizam** (ficam só no dispositivo onde foram criados) —
  é uma limitação conhecida do plano gratuito do Firestore, não um bug.
- **IA (`/api/insights`)**: lógica compartilhada em `api/_lib/insights.ts`, usada tanto pelo
  `server.ts` (dev local, Express) quanto por `api/insights.ts` (função serverless da Vercel
  em produção) — não duplicar essa lógica entre os dois.
  > ⚠️ **Auditoria de 30/07/2026**: nenhum arquivo em `src/` chama esse endpoint — os
  > recursos de IA usam as chaves do navegador. Ele está público (sem checagem de
  > autenticação) e sem uso. Enquanto não for removido ou protegido, **não** colocar
  > `GEMINI_API_KEY` nas variáveis de ambiente da Vercel: qualquer pessoa na internet pode
  > invocá-lo e a conta é sua.

---

## 15.1. Configuração sincronizada (chaves de IA e atalho)

**Mudança de decisão em 30/07/2026.** Antes, as chaves de API ficavam propositalmente só no
navegador e não subiam para a nuvem. Na prática isso significava configurar de novo em cada
aparelho, e o celular caía no modo simplificado sem motivo aparente. A decisão foi revista:
o documento é lido apenas pelo dono do `uid` (regra do Firestore, seção 15), então guardar a
chave ali não amplia o acesso de forma relevante.

- `tf_settings` (chave OpenAI, chave Gemini, atalho da captura rápida) entra no payload do
  `pushToCloud` sob a chave `settings` e é aplicado no `applyRemoteSnapshot`.
- `useSettingsStore` **não importa** `useAppStore` — este é que injeta o gatilho via
  `registrarObservadorDeSettings`. O import direto fecharia um ciclo de módulos.
- **Valor vazio vindo da nuvem não apaga o valor local** (`lib/settingsMerge.ts`, com teste).
  Sem essa regra, um aparelho ainda sem chave que sincronizasse antes de receber zerava a
  chave do outro. O preço aceito: limpar uma chave de propósito precisa ser feito em cada
  aparelho.
- Continuam **locais** (são preferências do dispositivo, não do trabalho): tema, largura de
  painéis e recolhimento da sidebar.
- Qualquer texto da interface que afirme "fica só neste navegador" está desatualizado —
  `SettingsModal` e `AiKeyNotice` foram reescritos junto com a mudança.

---

## 15.2. App instalável (PWA)

- **Arquivos**: `public/manifest.webmanifest`, `public/sw.js`, ícones `icon-192`,
  `icon-512`, `icon-maskable-512`, `apple-touch-icon` e `favicon.svg` (este último era
  referenciado pelo `index.html` e **não existia**). Os PNGs são gerados por código, sem
  dependência nova — se precisar refazê-los, o script está no histórico desta entrega.
- **Três regras do service worker**, cada uma evitando um desastre conhecido:
  1. **Navegação é rede primeiro.** HTML servido do cache prende uma versão velha no
     telefone para sempre, e ela aponta para `/assets/<hash>.js` que já não existe — tela
     branca. O cache do HTML só entra quando a rede falha.
  2. **Só GET do mesmo domínio.** Firestore, login do Google e as APIs de IA passam sem
     interceptação; cachear POST ou streaming quebra a sincronização de formas difíceis de
     diagnosticar.
  3. **`/assets/*` é cache primeiro** — o Vite põe hash no nome, o conteúdo nunca muda.
- **Registro só em produção** (`import.meta.env.PROD`): em desenvolvimento o service worker
  briga com o recarregamento a quente do Vite e serve módulo velho, o que parece bug do
  código.
- **`theme-color` acompanha o tema** via `MutationObserver` na classe do `<html>`
  (`lib/pwa.ts`). Instalado, o app não tem barra do navegador — sem isso fica uma faixa
  clara em cima do app escuro.
- **iOS não lê o manifesto**: nome, ícone e barra de status vêm das metas `apple-*` no
  `index.html`, e a instalação é manual (Compartilhar → Adicionar à Tela de Início). O
  `InstallAppCard` detecta e ensina o caminho, em vez de mostrar um botão que não funciona.
- **Sem atalhos (`shortcuts`) no manifesto**: eles exigem URLs próprias, e o app não tem
  rotas — todos cairiam na mesma tela. Isso volta à mesa quando houver roteamento.

---

## 15.3. Mapa da IA no app (30/07/2026)

> Toda superfície de IA segue o **padrão híbrido** (regra em 13.3.2): funciona sem chave
> (modo local determinístico e honesto), melhora com chave Gemini, nunca lança exceção.
> `callGemini` (`lib/aiSummary.ts`) é a fonte única da chamada. Recurso novo em `lib/`
> entra com teste. Superfícies atuais:

| Superfície | Onde | Lib |
|---|---|---|
| Pergunte à IA (function-calling real) | `AIPanel` | `lib/aiTools.ts` |
| Criar/enriquecer projeto | `AIProjectModal`/`EnrichProjectModal` | `lib/aiProjectGen.ts` |
| Sugerir subtarefas/checklist da tarefa | `TaskDetail` (menu Wand2) | `lib/aiProjectGen.ts` |
| Resumo de conclusão (coluna `ai_summary`) | lista/painel | `lib/aiSummary.ts` |
| Resumo para a reunião | Relatórios (`MeetingReviewCard`) | `lib/aiMeetingReview.ts` |
| Captura inteligente (prazo/prioridade em PT) | `QuickCapture` | `lib/smartCapture.ts` (100% local) |
| Briefing "Começar o dia" (dispensável por dia, `tf_briefing_hidden`) | Minhas tarefas (`DailyBriefingCard`) | `lib/aiDailyBriefing.ts` |
| GUT sugerido (heurística prazos/prioridades/paradas) | `GUTModal` | `lib/aiGut.ts` |
| Triagem da inbox (afinidade local sempre; lote Gemini no botão "Triar com IA") | `InboxView` | `lib/aiInboxTriage.ts` |
| Criar automação por frase ("quando X, então Y" → editor preenchido) | `AutomationsView` | `lib/aiAutomationBuilder.ts` |
| Agentes de IA (instruções próprias + execução sob demanda) | `AgentsView` (nav "Agentes de IA") | `lib/agentEngine.ts` |

### 15.3.1. Agentes de IA (30/07/2026, inspirados nos "superagentes")

- Entidade `Agent` (`types/index.ts`): nome, ícone (`VIEW_ICON`), descrição e
  **instruções** ("papel e objetivo") — o agente segue as instruções a cada execução
  sobre um **retrato do workspace** montado localmente (`buildWorkspaceDigest` em
  `lib/agentEngine.ts`: panorama, tarefas abertas por projeto com prazos/atrasos,
  concluídas em 7 dias, metas com saúde derivada). Execução híbrida (`runAgent`):
  Gemini segue as instruções; sem chave, devolve o retrato organizado (`source:
  'ai'|'local'` fica gravado no `AgentRun`, mostrado na interface).
- **Galeria de modelos** (`AGENT_TEMPLATES`, por categoria): ativar cria um agente SEU
  com instruções editáveis (`templateId` marca a origem; card vira "Ativado"). Modelo
  novo entra na galeria com teste (`agentEngine.test.ts` valida ícone/categoria/id).
- Persistência **local ao dispositivo** nesta versão (`tf_agents`/`tf_agent_runs`,
  máx. 50 execuções) — agentes **não** sincronizam com a nuvem ainda; se isso mudar,
  seguir o padrão de `viewPrefs`. Tela: `views/AgentsView.tsx` (View `'agents'`).

- Botões de IA usam `ai-gradient-bg` (mesmo selo visual em todo o app).
- A triagem local usa afinidade de texto (nome do projeto ×3, descrição ×2, títulos de
  tarefas ×1, limiar 2, sem acento e com singular/plural leve) — sugestão aparece como
  chip "✨ projeto" na linha "Mover para"; aceitar = mover.

## 15.3. Exportar para IA (Markdown + anexos)

Menu de 3 pontinhos de **espaço, pasta e projeto** (`Sidebar`) e rodapé da coluna de
propriedades da **tarefa** (`TaskDetail`) → **Exportar Markdown** (`lib/exportMarkdown.ts`).

- **Para que serve**: entregar o conteúdo ao Claude Code para ele executar as tarefas. Não é
  relatório de gestão. Cada tarefa vira **título**; descrição, imagens, anexos, checklists,
  subtarefas (com as descrições e checklists delas, recursivamente) e comentários descem
  como corpo daquele título.
- **Markdown e não PDF** — o pedido original era PDF. Trocado com o autor: o destino é uma
  IA, e a extração de texto de PDF perde exatamente o que importa (nível de subtarefa, estado
  de checkbox, limites de descrição).
- **Anexo nunca vai embutido.** Base64 dentro do `.md` são megabytes de texto que nem uma IA
  interpreta como imagem — só queima contexto. Com anexo, a exportação vira **`.zip`** com o
  `.md` + pasta `anexos/`, referenciada por caminho relativo; assim o Claude Code lê o texto
  **e** abre as imagens. Sem anexo, baixa `.md` puro.
- **ZIP próprio** (`lib/zip.ts`), sem dependência, método "stored": o conteúdo real é PNG e
  JPEG, já comprimidos — deflate não economizaria nada e custaria uma biblioteca.
- **A descrição é HTML, não texto.** O `BlockEditor` é um `contentEditable`, então
  `block.text` guarda `<ul>`, `<h1>`, `<b>` e `<img src="data:...">` — o editor **funde** a
  imagem dentro do bloco de texto. Por isso existe `lib/htmlToMarkdown.ts`, que converte o
  subconjunto de tags do editor e extrai cada `<img>` para a pasta de anexos. Sem ele, o
  base64 saía cru no meio da frase. Título dentro da descrição vira **negrito**, não `#`,
  para não quebrar a hierarquia do documento (a tarefa é `##`).
- **Data usa `parseISO`** (`lib/dateFilter.ts`), nunca `new Date(iso)`: prazo é `YYYY-MM-DD`
  e o construtor lê como meia-noite UTC — em UTC−3 o documento saía com o dia anterior.
- Só tarefas **raiz** entram na lista de cada projeto (subtarefa aparece dentro do pai, não
  repetida solta) e **projeto arquivado fica de fora**.
- **Tarefa concluída não entra**, em nenhum nível: o documento é a lista do que *falta*
  fazer, e tarefa pronta só gasta contexto de quem vai executar. Duas exceções, ambas com
  teste:
  1. **Concluída com pendência abaixo é mantida** (`criarFiltroDePendentes`). Descartar um
     pai fechado cedo levaria junto a subtarefa que falta — o trabalho sumiria do documento
     sem aviso. Ela aparece com `Status: Concluído`, então a inconsistência fica visível.
  2. **Escolha direta manda** (`escolhaDireta`): exportar uma tarefa específica pelo painel
     dela funciona mesmo se estiver concluída — foi aquela que o usuário pediu. O filtro
     continua valendo para as subtarefas.

---

## 16. Trabalhar no projeto pelo Claude Code do celular (sessões na nuvem)

O repositório está preparado para ser aberto em **claude.ai/code** (navegador ou app do
Claude no celular), onde a sessão roda numa VM da Anthropic com o repo clonado do GitHub.

- **A VM clona do GitHub, não do PC**: o que não estiver **commitado e enviado** não existe
  na sessão. Com a regra de publicar sempre nos dois (seção 10) isso costuma se resolver
  sozinho, mas vale conferir antes de continuar o trabalho pelo celular.
- **Instalação de dependências**: hook `SessionStart` em `.claude/settings.json` (versionado)
  chama `scripts/install_pkgs.sh`. O script **sai imediatamente fora da nuvem**
  (`CLAUDE_CODE_REMOTE != true`) e pula a instalação se `node_modules/vite` já existir —
  não atrasar a abertura de sessão local é parte do contrato desse script.
- **`.env` não vai para o repositório** (e nem deve): sem as variáveis do Firebase, a sessão
  na nuvem builda e roda o app em **modo local sem login** (seção 15). Dá para editar código,
  rodar `npm run lint` e `npm run build`; não dá para testar login/sincronização de verdade —
  isso se valida no PC ou no deploy da Vercel.
- **Nunca colocar `GEMINI_API_KEY`/`OPENAI_API_KEY` nas variáveis do ambiente de nuvem**: elas
  ficam legíveis para quem usa o ambiente e não têm cofre de segredos.
- **O que vale a pena rodar na sessão da nuvem**: `npm run lint` (typecheck) e `npm run build`.

---

_Última atualização: 29/07/2026 (Login com Google substituiu o login anônimo + código de
sincronização `TF-XXXXXX`: tela de login, dados por conta em `syncGroups/{uid}`, migração
única do grupo antigo, regras do Firestore por dono, seção "Conta e sincronização" nas
Configurações e conta real no rodapé da sidebar — seção 15. Repositório preparado para
sessões do Claude Code na nuvem/celular (hook `SessionStart` + `scripts/install_pkgs.sh`) —
seção 16.)_

_Atualização anterior: 15/07/2026 (Redesign de "Todas as tarefas" importado de protótipo
Claude Design — feito em várias rodadas ao longo do dia, a última cruzando o **histórico
completo da conversa com o Claude Design** (não só o `.dc.html` final) para pegar pedidos
que não sobreviveram no HTML exportado mas foram decisões explícitas do autor. Resumo do
que mudou, por área — detalhes em cada seção referenciada:

- **GUT por tarefa** (popover de segmentos, `TaskGutBadge`, seção 4.4) e **Progresso**
  (coluna + `SideProp`, com fallback pra checklist quando não há subtarefa — seção 4.9).
- **Interação da lista**: pílula do grupo inteira é o alvo de clique para
  expandir/colapsar (seção 4.8), ícone da tarefa muda de cor conforme o agrupamento ativo
  (seção 4.10), botão de expandir/recolher subtarefas mora na barra "Agrupar por" (seção
  4.11), cabeçalho "Tarefa" (era "Nome") com colunas de dado centralizadas (seção 8.1),
  nome da tarefa renomeável por duplo-clique (seção 13.2).
- **`TaskDetail`**: breadcrumb entre subtarefas-irmãs (seção 4.6), seção Comentários
  nova (seção 14.2), **modo de edição via lápis** em Subtarefas/Checklist/
  Comentários/Anexos (substitui hover-reveal — pedido repetido várias vezes, não
  reverter), seções colapsáveis, subtarefas com cor de status real + badge de
  prioridade, `DueDatePicker`/`AssigneePicker` novos (popover em vez de input nativo/
  texto livre), propriedades com moldura (`prop-trigger`) — seção 14.
- **`BlockEditor`**: atalhos estilo Markdown automáticos ao digitar (seção 14.1).
- **Sidebar**: nav primário e Espaços mutuamente exclusivos, itens do nav com ícone em
  quadradinho colorido (seção 3).
- **Shell do app**: conteúdo principal virou cartão flutuante (fundo cinza, cartão
  branco arredondado com sombra) — `App.tsx`.
- Botão **"Nova tarefa"** no cabeçalho (Captura Rápida, estado global via
  `quickCaptureOpen`) — seção 13.

Dados de exemplo do protótipo (tarefas/projetos fictícios) não foram importados — só o
padrão visual/interação. Mudanças em `TaskPanel`/`TaskList`/`TaskRow`/`ColumnHeaders`
refletem em toda tela que os usa (Espaço, Pasta, Minhas tarefas, Todas as tarefas), não
só "Todas as tarefas". Ver seções 3, 4.4 a 4.11, 8.1, 9, 13, 13.2 e 14._

_Atualização anterior: 14/07/2026 (Redesign da sidebar importado de protótipo Claude Design:
nav em pílulas, badges em degradê, cabeçalho de espaço com tinta de cor permanente,
renomear por duplo-clique, menu `...` reduzido a Mover/Duplicar/Arquivar/Excluir com
submenu de mover navegável, tema claro/escuro só da sidebar. Ícone de projeto trocou de
emoji para lucide + cor via `IconColorPicker` — `EmojiPicker` removido. Novo nível
Workspace com seletor no cabeçalho (`workspaces[]`/`activeWorkspaceId` no store),
escopando Espaços/Projetos/`ProjectsListView`/`NewProjectModal`, mas não as telas de
tarefas (ver seção 3.1). Ver seções 3 e 8)._

_Atualização anterior: 07/07/2026 (BlockEditor virou editor unificado estilo TickTick: um
único `contentEditable` com mídia inline no fluxo do texto, botão "+" na linha atual com
menu de inserção — títulos, listas, checkbox, citação, linha, imagem, anexo —, negrito/
itálico, lightbox com zoom, chip de arquivo abrindo em nova aba e seção Anexos separada
com "Inserir no texto". Migração dobra mídia antiga para o corpo. Ver seção 14.1)._
