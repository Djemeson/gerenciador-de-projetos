/**
 * Converte o HTML do editor de blocos em Markdown.
 *
 * **Por que isto existe.** A descrição da tarefa não é texto puro: o `BlockEditor` é um
 * `contentEditable` com `execCommand`, então o que fica gravado em `block.text` é HTML —
 * `<ul>`, `<li>`, `<h1..h3>`, `<blockquote>`, `<b>`, `<a>` e, principalmente, `<img
 * src="data:image/png;base64,...">`. Descobri isso testando a exportação de ponta a ponta:
 * a imagem que eu esperava encontrar como bloco `type:'image'` tinha sido **fundida** dentro
 * do bloco de texto pelo editor, e o Markdown saiu com o base64 cru no meio da frase — que é
 * exatamente o resultado que a exportação existe para evitar.
 *
 * **Sem DOM de propósito:** é um analisador de string. Assim a função roda igual no
 * navegador e no teste (o Vitest aqui usa ambiente node, sem `DOMParser`), e a conversão
 * fica coberta por teste de verdade em vez de só no caminho do navegador.
 *
 * Cobre o subconjunto que o editor realmente produz — não é um conversor de HTML genérico.
 */

/** Chamada para cada `<img>` encontrada. Devolve o caminho a usar, ou `null` se não deu. */
export type AoEncontrarImagem = (src: string, alt?: string) => string | null

function decodificarEntidades(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')   // por último: senão `&amp;lt;` viraria `<`
}

/** Atributo de uma tag, tolerando aspas simples, duplas ou nenhuma. */
function atributo(tag: string, nome: string): string | undefined {
  const m = new RegExp(`${nome}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag)
  return m ? (m[2] ?? m[3] ?? m[4]) : undefined
}

export function htmlParaMarkdown(html: string, aoEncontrarImagem?: AoEncontrarImagem): string {
  if (!html) return ''
  let s = html

  // 1. Imagens primeiro — antes de qualquer limpeza que possa comer o atributo `src`.
  s = s.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = atributo(tag, 'src') ?? ''
    const alt = atributo(tag, 'alt')
    const caminho = aoEncontrarImagem?.(src, alt) ?? null
    if (caminho) return `\n\n![${alt || 'imagem'}](${caminho})\n\n`
    // Sem destino de arquivo, registra a presença — nunca despeja o base64 no texto.
    return `\n\n*(imagem não incluída${alt ? `: ${alt}` : ''})*\n\n`
  })

  // 2. Blocos que viram linha própria.
  s = s.replace(/<\s*br\s*\/?>/gi, '\n')
  s = s.replace(/<\s*hr\s*\/?>/gi, '\n\n---\n\n')

  // Título dentro da descrição vira **negrito**, não `#`. Um `<h1>` no meio de uma tarefa
  // criaria um título de nível 1 no documento e quebraria a hierarquia (a tarefa é `##`).
  s = s.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_m, t) => `\n\n**${t.trim()}**\n\n`)

  s = s.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, t) =>
    '\n\n' + String(t).trim().split('\n').map((l: string) => `> ${l}`).join('\n') + '\n\n')

  // 3. Listas. Numeradas precisam do índice, então são tratadas por bloco.
  s = s.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m, corpo) => {
    let i = 0
    const itens = String(corpo).replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_x, t) => `\n${++i}. ${String(t).trim()}`)
    return `\n${itens}\n`
  })
  s = s.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_m, corpo) => {
    const itens = String(corpo).replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_x, t) => `\n- ${String(t).trim()}`)
    return `\n${itens}\n`
  })
  // Item solto, fora de lista (acontece quando o editor perde o container).
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, t) => `\n- ${String(t).trim()}`)

  // 4. Marcações de texto.
  s = s.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, (tag, t) => {
    const href = atributo(tag, 'href')
    const texto = String(t).trim()
    return href ? `[${texto}](${href})` : texto
  })
  s = s.replace(/<(b|strong)[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, t) => `**${String(t).trim()}**`)
  s = s.replace(/<(i|em)[^>]*>([\s\S]*?)<\/\1>/gi,     (_m, _t, t) => `*${String(t).trim()}*`)
  s = s.replace(/<(code)[^>]*>([\s\S]*?)<\/\1>/gi,     (_m, _t, t) => `\`${String(t).trim()}\``)

  // 5. Parágrafos: `</div>` e `</p>` fecham linha.
  s = s.replace(/<\/(div|p)>/gi, '\n')
  s = s.replace(/<(div|p)[^>]*>/gi, '')

  // 6. O que sobrou de tag some, e as entidades voltam a ser texto.
  s = s.replace(/<[^>]+>/g, '')
  s = decodificarEntidades(s)

  // 7. Espaçamento: no máximo uma linha em branco entre blocos.
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** `true` quando a string parece HTML do editor, e não texto digitado pelo usuário. */
export function pareceHtml(s: string): boolean {
  return /<(br|div|p|img|ul|ol|li|h[1-6]|b|strong|i|em|a|blockquote|hr|code)\b[^>]*>/i.test(s)
}
