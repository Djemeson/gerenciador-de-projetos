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
  Pasta"; projeto = "Novo Projeto", ícone `list`, cor da pasta quando criado dentro de
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
- Hierarquia dentro do espaço tem linha-guia vertical à esquerda. Pasta vazia mostra "Vazia".
- **Redimensionável e retrátil**: a sidebar tem largura ajustável arrastando a borda
  direita (alça `col-resize`, 184–420px, salva em `tf_sidebar_width`, padrão 240) e
  um botão de **recolher** no cabeçalho (`PanelLeftClose`). Recolhida, vira um trilho
  fino (48px) com logo + botão de **expandir** (`PanelLeftOpen`); estado salvo em
  `tf_sidebar_collapsed`. A `<aside>` usa `width` inline + `flex-shrink-0` (nunca
  cravar `w-52`).
- **Tema claro/escuro só da sidebar**: botão sol/lua no rodapé alterna `tf_sidebar_theme`
  (`dark`/`light`, padrão `dark`). É **cosmético e local à sidebar** — o resto do app
  não tem dark mode; não propagar esse estado para outras telas.

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
- O botão "+ Visualização" tem um atalho de um clique **"✅ Concluídas no período"**
  que já pré-configura status = Concluída + campo de data = Data de conclusão — é o
  caso de uso mais importante (reunião semanal de resultados).
- Cada visualização personalizada guarda `dateField` (`dueDate`/`completedAt`/`createdAt`)
  + `datePeriod` (ver 4.3), aplicados via `lib/customViews.ts` (`applyCustomViewFilter`).

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

## 13.3. Relatório semanal

- O card **"Concluídas esta semana" é clicável** → abre um modal com a lista das tarefas
  concluídas naquela semana, com **seletor de data** (Anterior/Próxima + campo de data)
  para navegar para outras semanas (inclusive a anterior).

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
- Linha de adicionar: avatar "DJ" (autor único do app, mesmo texto fixo do rodapé da
  sidebar — não existe conta multiusuário) + input (**Enter posta**) + botão de anexar
  (seletor de arquivo) + botão de gravar áudio (alterna gravação, ícone `Mic`/`MicOff`).
- Ações na store: `addComment(taskId, patch)` / `removeComment(taskId, commentId)`
  (`useAppStore.ts`), mesmo padrão de `addChecklist`/`removeChecklist` (mapeia `tasks`,
  persiste via `pProjects`, atualiza `updatedAt`). `addComment` aceita texto e/ou anexo e/ou
  áudio (usado tanto pelo texto simples quanto pelas gravações/anexos).

---

_Última atualização: 15/07/2026 (Redesign de "Todas as tarefas" importado de protótipo
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
