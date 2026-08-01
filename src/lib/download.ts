/**
 * Download de arquivo gerado no navegador — fonte única.
 *
 * Existia uma âncora montada à mão dentro de `exportCsv`; quando a exportação em Markdown
 * apareceu, seriam duas. O `revokeObjectURL` é o detalhe que costuma faltar em cópias
 * dessas: sem ele o blob fica preso na memória da aba até recarregar, e um export de
 * projeto com fotos são vários MB.
 */
export function baixarArquivo(nomeArquivo: string, conteudo: Blob | string, mime?: string): void {
  const blob = typeof conteudo === 'string'
    ? new Blob([conteudo], { type: mime ?? 'text/plain;charset=utf-8' })
    : conteudo
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Nome de arquivo seguro no Windows, sem acento e sem caractere proibido. */
export function nomeSeguro(base: string, extensao: string): string {
  const limpo = base.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '-')
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${limpo || 'export'}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.${extensao}`
}
