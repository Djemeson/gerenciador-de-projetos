import { ICON_CATEGORIES, normalizeSearch } from './sidebarIcons'
import { iconLabel } from './iconLabelsPt'

/**
 * Busca de ícones por **contexto**, não só por nome.
 *
 * Antes a busca casava substring em três lugares — nome kebab-case, rótulo em português e
 * nome da categoria. Isso reprova no uso real: digitar "dinheiro" não encontrava `banknote`
 * (rótulo "cédula"), `coins`, `wallet` nem `credit-card`, porque nenhum desses textos contém
 * a palavra "dinheiro". O usuário procura pelo **assunto**, não pelo nome do desenho.
 *
 * A solução é um mapa de conceitos: um punhado de entradas em que vários termos apontam para
 * vários ícones. Compacto de manter (uma entrada cobre dezenas de ícones) e explícito —
 * nada de adivinhação por similaridade de string, que traria resultado errado com confiança.
 */

export interface Conceito { termos: string[]; icones: string[] }

/**
 * Cada entrada responde "quando alguém procura por X, o que faz sentido mostrar".
 * Os termos são comparados sem acento e em caixa baixa (ver `normalizeSearch`).
 */
export const CONCEITOS: Conceito[] = [
  { termos: ['dinheiro', 'financeiro', 'financas', 'pagamento', 'grana', 'custo', 'preco', 'faturamento', 'receita', 'caixa'],
    icones: ['banknote', 'coins', 'wallet', 'credit-card', 'piggy-bank', 'landmark', 'bitcoin', 'calculator', 'percent', 'scale'] },
  { termos: ['venda', 'vendas', 'comercial', 'loja', 'compra', 'ecommerce', 'pedido'],
    icones: ['shopping-cart', 'shopping-bag', 'store', 'cart', 'tag', 'credit-card', 'package', 'handshake', 'trending-up'] },
  { termos: ['cliente', 'clientes', 'pessoa', 'pessoas', 'usuario', 'equipe', 'time', 'contato'],
    icones: ['user', 'users', 'contact', 'user-check', 'user-plus', 'smile', 'handshake', 'heart-handshake'] },
  { termos: ['internet', 'rede', 'conexao', 'provedor', 'link', 'banda', 'sinal', 'fibra'],
    icones: ['wifi', 'signal', 'network', 'globe', 'router', 'radio', 'satellite', 'antenna', 'cable', 'server', 'plug'] },
  { termos: ['suporte', 'chamado', 'atendimento', 'ajuda', 'ticket'],
    icones: ['headphones', 'help-circle', 'life-buoy', 'phone', 'messages-square', 'wrench', 'hard-hat'] },
  { termos: ['prazo', 'tempo', 'data', 'agenda', 'hora', 'atraso', 'cronograma'],
    icones: ['calendar', 'clock', 'clock-3', 'alarm-clock', 'timer', 'hourglass', 'milestone'] },
  { termos: ['meta', 'objetivo', 'alvo', 'resultado', 'okr', 'indicador'],
    icones: ['target', 'trophy', 'award', 'medal', 'flag', 'trending-up', 'gauge', 'crown', 'star'] },
  { termos: ['relatorio', 'grafico', 'dados', 'analise', 'metrica', 'numero', 'estatistica'],
    icones: ['bar-chart-2', 'pie-chart', 'trending-up', 'activity', 'gauge', 'table', 'database', 'presentation'] },
  { termos: ['documento', 'arquivo', 'contrato', 'papel', 'nota', 'anotacao'],
    icones: ['file', 'file-text', 'clipboard', 'clipboard-list', 'notebook', 'book', 'archive', 'paperclip', 'stamp'] },
  { termos: ['tarefa', 'checklist', 'lista', 'pendencia', 'afazer', 'todo'],
    icones: ['square-check', 'list-checks', 'checklist', 'todo', 'list', 'clipboard-list', 'check-circle'] },
  { termos: ['alerta', 'urgente', 'risco', 'problema', 'erro', 'critico', 'perigo'],
    icones: ['siren', 'shield-alert', 'flame', 'bomb', 'x-circle', 'triangle', 'bug', 'skull'] },
  { termos: ['seguranca', 'senha', 'acesso', 'protecao', 'privacidade'],
    icones: ['shield', 'lock', 'unlock', 'key', 'fingerprint', 'eye'] },
  { termos: ['ideia', 'criacao', 'inovacao', 'projeto novo', 'inspiracao'],
    icones: ['lightbulb', 'sparkles', 'wand-2', 'rocket', 'puzzle', 'shapes', 'palette'] },
  { termos: ['comunicacao', 'aviso', 'mensagem', 'email', 'recado', 'divulgacao'],
    icones: ['mail', 'send', 'megaphone', 'bell', 'messages-square', 'phone', 'rss', 'radio'] },
  { termos: ['reuniao', 'apresentacao', 'treinamento', 'aula'],
    icones: ['presentation', 'users', 'video', 'mic', 'graduation-cap', 'school', 'clapperboard'] },
  { termos: ['casa', 'escritorio', 'predio', 'empresa', 'local', 'endereco'],
    icones: ['home', 'building', 'building-2', 'store', 'factory', 'map-pin', 'landmark', 'door-open'] },
  { termos: ['transporte', 'entrega', 'logistica', 'viagem', 'frota', 'veiculo'],
    icones: ['truck', 'car', 'bus', 'bike', 'plane', 'ship', 'package', 'route', 'map', 'navigation', 'fuel'] },
  { termos: ['manutencao', 'obra', 'instalacao', 'tecnico', 'ferramenta', 'reparo', 'campo'],
    icones: ['wrench', 'hammer', 'drill', 'hard-hat', 'construction', 'tool', 'tools', 'shovel', 'axe', 'cog'] },
  { termos: ['tecnologia', 'sistema', 'servidor', 'programacao', 'codigo', 'ti', 'infra'],
    icones: ['code', 'code-2', 'terminal', 'server', 'database', 'cpu', 'laptop', 'monitor', 'git-branch', 'cloud'] },
  { termos: ['energia', 'eletrica', 'automacao', 'gatilho'],
    icones: ['zap', 'zap-off', 'plug', 'power', 'battery', 'lightbulb', 'flashlight'] },
  { termos: ['saude', 'bem estar', 'medico', 'hospital'],
    icones: ['heart', 'activity', 'pill', 'syringe', 'first-aid', 'thermometer', 'stethoscope', 'square-activity'] },
  { termos: ['comida', 'alimentacao', 'restaurante', 'bebida', 'cafe'],
    icones: ['utensils', 'coffee', 'pizza', 'sandwich', 'apple', 'cup', 'chef-hat', 'wine', 'beer'] },
  { termos: ['natureza', 'sustentabilidade', 'meio ambiente', 'clima', 'tempo do dia'],
    icones: ['leaf', 'tree', 'sprout', 'flower', 'sun', 'cloud', 'cloud-rain', 'droplet', 'wind', 'snowflake'] },
  { termos: ['marketing', 'campanha', 'midia', 'conteudo', 'social'],
    icones: ['megaphone', 'newspaper', 'image', 'camera', 'video', 'rss', 'star', 'heart', 'share-2'] },
  { termos: ['juridico', 'legal', 'processo', 'regra', 'norma', 'auditoria'],
    icones: ['scale', 'landmark', 'gavel', 'shield', 'stamp', 'file-text', 'badge-check', 'copyright'] },
  { termos: ['favorito', 'importante', 'destaque', 'prioridade'],
    icones: ['star', 'flag', 'bookmark', 'pin', 'crown', 'gem', 'diamond', 'heart'] },
  { termos: ['pasta', 'organizacao', 'categoria', 'estrutura'],
    icones: ['folder', 'folder-open', 'archive', 'box', 'layers', 'grid-3x3', 'shapes', 'tag'] },
  { termos: ['jogo', 'lazer', 'diversao', 'entretenimento'],
    icones: ['gamepad-2', 'music', 'film', 'play', 'party-popper', 'ticket', 'drama', 'popcorn'] },

  // ── Ampliação de 01/08/2026 ────────────────────────────────────────────────
  // Cobre os assuntos das categorias novas e as palavras do dia a dia de um provedor de
  // internet, que era o uso real que motivou o recurso.

  { termos: ['instalacao', 'ativacao', 'visita tecnica', 'os', 'ordem de servico'],
    icones: ['hard-hat', 'wrench', 'truck', 'clipboard-check', 'router', 'cable', 'traffic-cone', 'forklift'] },
  { termos: ['cancelamento', 'churn', 'perda', 'cancelar', 'desistencia'],
    icones: ['user-x', 'ban', 'circle-slash', 'trending-down', 'heart-crack', 'x', 'circle-x', 'file-x'] },
  { termos: ['contrato', 'assinatura', 'plano', 'renovacao', 'fidelidade'],
    icones: ['file-text', 'scroll-text', 'stamp', 'badge-check', 'calendar-range', 'handshake', 'pen'] },
  { termos: ['cobranca', 'fatura', 'boleto', 'inadimplencia', 'vencimento'],
    icones: ['receipt', 'banknote', 'credit-card', 'calendar-x', 'circle-dollar-sign', 'hand-coins', 'file-text'] },
  { termos: ['estoque', 'almoxarifado', 'inventario', 'material', 'equipamento'],
    icones: ['package', 'box', 'boxes', 'warehouse', 'container', 'barcode', 'qr-code', 'blocks', 'archive'] },
  { termos: ['entrega', 'expedicao', 'envio', 'rastreamento'],
    icones: ['truck', 'package', 'map-pin', 'route', 'navigation-2', 'signpost', 'forklift'] },
  { termos: ['aprovacao', 'validacao', 'revisao', 'conferencia', 'aceite'],
    icones: ['badge-check', 'circle-check-big', 'square-check-big', 'clipboard-check', 'file-check', 'thumbs-up', 'stamp', 'scan'] },
  { termos: ['recusa', 'rejeicao', 'reprovado', 'negado'],
    icones: ['circle-x', 'file-x', 'thumbs-down', 'ban', 'x', 'octagon-alert'] },
  { termos: ['pesquisa', 'busca', 'investigacao', 'descoberta', 'diagnostico'],
    icones: ['search', 'radar', 'telescope', 'microscope', 'scan', 'eye', 'binoculars', 'filter'] },
  { termos: ['aprendizado', 'estudo', 'curso', 'capacitacao', 'conhecimento', 'faculdade', 'escola'],
    icones: ['graduation-cap', 'school', 'book-open', 'library', 'notebook-pen', 'brain', 'lightbulb', 'scroll-text'] },
  { termos: ['ciencia', 'laboratorio', 'experimento', 'quimica', 'biologia'],
    icones: ['flask-conical', 'beaker', 'test-tube', 'microscope', 'atom', 'dna', 'telescope'] },
  { termos: ['matematica', 'calculo', 'formula', 'estatistica'],
    icones: ['calculator', 'sigma', 'pi', 'radical', 'percent', 'infinity', 'line-chart'] },
  { termos: ['navegacao', 'direcao', 'seta', 'caminho', 'rota', 'voltar', 'avancar'],
    icones: ['arrow-right', 'arrow-left', 'chevron-right', 'chevron-left', 'navigation-2', 'route', 'signpost', 'compass', 'corner-up-right'] },
  { termos: ['desfazer', 'refazer', 'historico', 'versao', 'reverter'],
    icones: ['undo', 'redo', 'history', 'rotate-ccw', 'refresh-ccw', 'git-branch', 'archive'] },
  { termos: ['duplicar', 'copiar', 'colar', 'clonar'],
    icones: ['copy', 'files', 'clipboard', 'layers', 'file-plus'] },
  { termos: ['planilha', 'tabela', 'coluna', 'linha', 'celula', 'excel'],
    icones: ['table', 'file-spreadsheet', 'columns-3', 'rows-3', 'grid-3x3', 'calculator'] },
  { termos: ['kanban', 'quadro', 'board', 'fluxo de trabalho', 'esteira'],
    icones: ['kanban', 'columns-3', 'workflow', 'waypoints', 'git-branch', 'split', 'merge'] },
  { termos: ['emocao', 'humor', 'sentimento', 'satisfacao', 'nps', 'feedback'],
    icones: ['smile', 'frown', 'meh', 'laugh', 'angry', 'thumbs-up', 'thumbs-down', 'heart', 'annoyed', 'star'] },
  { termos: ['esporte', 'academia', 'treino', 'exercicio', 'atividade fisica'],
    icones: ['dumbbell', 'bike', 'trophy', 'medal', 'goal', 'activity', 'heart-pulse', 'footprints', 'timer'] },
  { termos: ['animal', 'pet', 'bicho', 'veterinario'],
    icones: ['dog', 'cat', 'bird', 'fish', 'rabbit', 'turtle', 'squirrel', 'paw-print', 'bone'] },
  { termos: ['bebida', 'cafe', 'bar', 'happy hour'],
    icones: ['coffee', 'beer', 'wine', 'martini', 'cup-soda', 'milk', 'citrus'] },
  { termos: ['limpeza', 'higiene', 'banheiro', 'lavanderia'],
    icones: ['shower-head', 'bath', 'washing-machine', 'trash', 'droplet', 'brush', 'paint-roller'] },
  { termos: ['movel', 'mobilia', 'decoracao', 'ambiente'],
    icones: ['sofa', 'armchair', 'bed', 'bed-double', 'lamp', 'lamp-desk', 'blinds', 'frame', 'door-closed'] },
  { termos: ['eletrodomestico', 'cozinha', 'utensilio'],
    icones: ['refrigerator', 'microwave', 'cooking-pot', 'utensils', 'utensils-crossed', 'chef-hat', 'washing-machine'] },
  { termos: ['clima', 'previsao', 'chuva', 'sol', 'frio', 'calor', 'neve'],
    icones: ['cloud-rain', 'cloud-snow', 'cloud-lightning', 'cloud-drizzle', 'cloud-fog', 'sun', 'snowflake', 'rainbow', 'thermometer-sun', 'thermometer-snowflake', 'haze', 'wind'] },
  { termos: ['audio', 'som', 'musica', 'gravacao', 'podcast'],
    icones: ['music', 'audio-lines', 'mic-vocal', 'headphones', 'speaker', 'volume-2', 'podcast', 'list-music', 'guitar', 'piano'] },
  { termos: ['video', 'filmagem', 'gravar tela', 'transmissao', 'live'],
    icones: ['video', 'camera', 'clapperboard', 'film', 'projector', 'screen-share', 'radio-tower', 'antenna'] },
  { termos: ['imagem', 'foto', 'galeria', 'design', 'arte'],
    icones: ['image', 'camera', 'palette', 'brush', 'frame', 'shapes', 'paint-bucket', 'file-image'] },
  { termos: ['acesso', 'permissao', 'login', 'autenticacao', 'biometria'],
    icones: ['key-round', 'lock-keyhole', 'fingerprint', 'scan-face', 'shield-check', 'user-check', 'vault', 'unlock'] },
  { termos: ['backup', 'nuvem', 'armazenamento', 'sincronizar'],
    icones: ['cloud', 'cloud-upload', 'cloud-download', 'hard-drive', 'database', 'save', 'refresh-cw', 'server'] },
  { termos: ['integracao', 'api', 'webhook', 'conector'],
    icones: ['webhook', 'plug', 'link', 'share-2', 'git-merge', 'network', 'circuit-board', 'waypoints'] },
  { termos: ['robo', 'ia', 'inteligencia artificial', 'automatico', 'assistente'],
    icones: ['bot', 'sparkles', 'wand-2', 'brain', 'cpu', 'zap', 'circuit-board'] },
  { termos: ['notificacao', 'lembrete', 'alarme', 'aviso sonoro'],
    icones: ['bell', 'bell-ring', 'bell-plus', 'bell-off', 'alarm-clock', 'alarm-clock-check', 'megaphone'] },
  { termos: ['acessibilidade', 'inclusao', 'diversidade'],
    icones: ['accessibility', 'person-standing', 'hand-heart', 'users-round', 'heart-handshake', 'languages'] },
  { termos: ['idioma', 'traducao', 'legenda', 'internacional'],
    icones: ['languages', 'captions', 'globe', 'book-open', 'message-circle'] },
  { termos: ['medicao', 'peso', 'tamanho', 'dimensao', 'unidade'],
    icones: ['ruler', 'weight', 'scale', 'gauge', 'move-horizontal', 'move-vertical', 'percent'] },
  { termos: ['bloqueio', 'proibido', 'restricao', 'suspenso'],
    icones: ['ban', 'circle-slash', 'lock', 'shield-off', 'user-x', 'bell-off', 'eye-off'] },
  { termos: ['crescimento', 'expansao', 'escala', 'progresso'],
    icones: ['trending-up', 'line-chart', 'rocket', 'sprout', 'chevrons-up', 'expand', 'gauge'] },
  { termos: ['presente', 'brinde', 'promocao', 'desconto', 'cupom'],
    icones: ['gift', 'ticket-percent', 'badge-percent', 'percent', 'tag', 'tags', 'party-popper'] },
  { termos: ['festa', 'evento', 'comemoracao', 'aniversario'],
    icones: ['party-popper', 'cake', 'gift', 'music', 'ticket', 'calendar-days', 'sparkles'] },
]

/** Índice termo normalizado → ícones, montado uma vez. */
const PORTERMO: { termo: string; icones: string[] }[] = CONCEITOS.flatMap(c =>
  c.termos.map(t => ({ termo: normalizeSearch(t), icones: c.icones })),
)

/** Todos os ícones que existem no seletor — o conceito pode citar um que não está na grade. */
const DISPONIVEIS = new Set(ICON_CATEGORIES.flatMap(c => c.icons))

/**
 * Ícones que respondem a uma busca, em ordem de relevância:
 * 1. rótulo em português começando pelo termo ("cad" → "cadeado");
 * 2. rótulo ou nome contendo o termo;
 * 3. conceito relacionado ("dinheiro" → cédula, moeda, carteira);
 * 4. categoria inteira, quando o nome dela casa ("negócios").
 *
 * A ordem importa: quem digita "casa" quer a casinha primeiro, não a lista inteira de
 * "Casa & Objetos".
 */
/**
 * Casa a consulta com um termo de conceito.
 *
 * O `q.includes(termo)` ingênuo produz absurdo com termo curto: o conceito de IA tem o termo
 * `"ia"`, e `"academia".includes("ia")` é verdadeiro — buscar "academia" trazia robô e
 * processador. Por isso o sentido "a frase contém o termo" exige **palavra inteira**.
 */
function casaConceito(q: string, termo: string): 'exato' | 'parcial' | null {
  if (q === termo) return 'exato'
  if (termo.startsWith(q) && q.length >= 3) return 'parcial'      // "dinheir" → "dinheiro"
  if (q.split(/\s+/).includes(termo)) return 'exato'              // "controle de estoque" → "estoque"
  return null
}

export function buscarIcones(consulta: string): string[] {
  const q = normalizeSearch(consulta.trim())
  if (!q) return []

  const nivel = new Map<string, number>()
  const registrar = (nome: string, n: number) => {
    if (!DISPONIVEIS.has(nome)) return
    const atual = nivel.get(nome)
    if (atual === undefined || n < atual) nivel.set(nome, n)
  }

  // Conceito exato antes de tudo: quem busca "pet" quer o cachorro, não "repetir" — que
  // casa por substring (re-**pet**-ir) e vinha na frente por ser correspondência de rótulo.
  for (const { termo, icones } of PORTERMO) {
    const casou = casaConceito(q, termo)
    if (casou) for (const nome of icones) registrar(nome, casou === 'exato' ? 1 : 3)
  }

  for (const cat of ICON_CATEGORIES) {
    const catCasa = normalizeSearch(cat.label).includes(q)
    for (const nome of cat.icons) {
      const rotulo = normalizeSearch(iconLabel(nome))
      const cru    = normalizeSearch(nome)
      if (rotulo === q || cru === q) registrar(nome, 0)                 // acerto em cheio
      else if (rotulo.startsWith(q) || cru.startsWith(q)) registrar(nome, 2)
      else if (rotulo.includes(q) || cru.includes(q)) registrar(nome, 4)
      else if (catCasa) registrar(nome, 5)
    }
  }

  return [...nivel.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([nome]) => nome)
}
