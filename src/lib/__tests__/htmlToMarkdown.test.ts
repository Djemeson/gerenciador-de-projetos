import { describe, it, expect } from 'vitest'
import { htmlParaMarkdown, pareceHtml } from '../htmlToMarkdown'

describe('htmlParaMarkdown', () => {
  // A regressão que motivou o arquivo: o editor funde a imagem dentro do bloco de texto,
  // e o base64 saía cru no meio da frase exportada.
  it('tira a imagem do meio do texto e devolve a referência de arquivo', () => {
    const html = 'Janela combinada.<img src="data:image/png;base64,AAAA" alt="topologia.png">'
    const vistos: string[] = []
    const md = htmlParaMarkdown(html, (src, alt) => { vistos.push(alt ?? src); return 'anexos/01-topologia.png' })
    expect(md).toContain('![topologia.png](anexos/01-topologia.png)')
    expect(md).not.toContain('base64')
    expect(vistos).toEqual(['topologia.png'])
  })

  it('sem destino para a imagem, registra a ausência em vez de despejar base64', () => {
    const md = htmlParaMarkdown('<img src="data:image/png;base64,AAAA" alt="foto.png">')
    expect(md).toContain('*(imagem não incluída: foto.png)*')
    expect(md).not.toContain('base64')
  })

  it('converte lista não ordenada', () => {
    expect(htmlParaMarkdown('<ul><li>um</li><li>dois</li></ul>')).toBe('- um\n- dois')
  })

  it('converte lista numerada mantendo a ordem', () => {
    expect(htmlParaMarkdown('<ol><li>um</li><li>dois</li></ol>')).toBe('1. um\n2. dois')
  })

  it('negrito, itálico, código e link', () => {
    expect(htmlParaMarkdown('<b>forte</b> e <i>leve</i>')).toBe('**forte** e *leve*')
    expect(htmlParaMarkdown('<strong>x</strong>')).toBe('**x**')
    expect(htmlParaMarkdown('<code>npm run dev</code>')).toBe('`npm run dev`')
    expect(htmlParaMarkdown('<a href="https://ex.com">site</a>')).toBe('[site](https://ex.com)')
  })

  // Um `<h1>` dentro da descrição criaria um título de nível 1 no documento e quebraria a
  // hierarquia, já que a tarefa é `##`.
  it('título dentro da descrição vira negrito, não cabeçalho', () => {
    const md = htmlParaMarkdown('<h1>Contexto</h1><div>texto</div>')
    expect(md).toContain('**Contexto**')
    expect(md).not.toMatch(/^#/m)
  })

  it('citação e linha divisória', () => {
    expect(htmlParaMarkdown('<blockquote>nota</blockquote>')).toBe('> nota')
    expect(htmlParaMarkdown('a<hr>b')).toBe('a\n\n---\n\nb')
  })

  it('quebra de linha e parágrafos', () => {
    expect(htmlParaMarkdown('um<br>dois')).toBe('um\ndois')
    expect(htmlParaMarkdown('<div>um</div><div>dois</div>')).toBe('um\ndois')
  })

  it('devolve as entidades ao texto, na ordem certa', () => {
    expect(htmlParaMarkdown('a &amp; b')).toBe('a & b')
    expect(htmlParaMarkdown('&lt;tag&gt;')).toBe('<tag>')
    expect(htmlParaMarkdown('espaço&nbsp;fino')).toBe('espaço fino')
    // `&amp;lt;` é um `&lt;` escrito pelo usuário: deve virar o texto "&lt;", não "<"
    expect(htmlParaMarkdown('&amp;lt;')).toBe('&lt;')
  })

  it('não deixa mais de uma linha em branco entre blocos', () => {
    expect(htmlParaMarkdown('<div>a</div><br><br><br><div>b</div>')).toBe('a\n\nb')
  })

  it('aceita atributo com aspas simples ou sem aspas', () => {
    expect(htmlParaMarkdown("<a href='/x'>y</a>")).toBe('[y](/x)')
    expect(htmlParaMarkdown('<a href=/x>y</a>')).toBe('[y](/x)')
  })

  it('string vazia não quebra', () => {
    expect(htmlParaMarkdown('')).toBe('')
  })
})

describe('pareceHtml', () => {
  it('reconhece o que veio do editor', () => {
    expect(pareceHtml('<div>oi</div>')).toBe(true)
    expect(pareceHtml('texto<br>outro')).toBe(true)
    expect(pareceHtml('<img src="x">')).toBe(true)
  })
  it('texto puro do usuário não é confundido com HTML', () => {
    expect(pareceHtml('preço < 100 e prazo > 3 dias')).toBe(false)
    expect(pareceHtml('sem tag nenhuma')).toBe(false)
  })
})
