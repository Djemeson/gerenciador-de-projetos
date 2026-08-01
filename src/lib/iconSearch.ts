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
    icones: ['gamepad-2', 'dice', 'music', 'film', 'play', 'party-popper', 'ticket', 'drama'] },
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
export function buscarIcones(consulta: string): string[] {
  const q = normalizeSearch(consulta.trim())
  if (!q) return []

  const nivel = new Map<string, number>()
  const registrar = (nome: string, n: number) => {
    if (!DISPONIVEIS.has(nome)) return
    const atual = nivel.get(nome)
    if (atual === undefined || n < atual) nivel.set(nome, n)
  }

  for (const cat of ICON_CATEGORIES) {
    const catCasa = normalizeSearch(cat.label).includes(q)
    for (const nome of cat.icons) {
      const rotulo = normalizeSearch(iconLabel(nome))
      const cru    = normalizeSearch(nome)
      if (rotulo.startsWith(q) || cru.startsWith(q)) registrar(nome, 1)
      else if (rotulo.includes(q) || cru.includes(q)) registrar(nome, 2)
      else if (catCasa) registrar(nome, 4)
    }
  }

  for (const { termo, icones } of PORTERMO) {
    // Casa nos dois sentidos: "dinheir" acha o conceito "dinheiro", e "financeiro pessoal"
    // também — quem digita frase costuma incluir a palavra-chave.
    if (!termo.includes(q) && !q.includes(termo)) continue
    for (const nome of icones) registrar(nome, 3)
  }

  return [...nivel.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([nome]) => nome)
}
