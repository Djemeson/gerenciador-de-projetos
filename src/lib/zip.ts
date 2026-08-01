/**
 * Escritor de ZIP mínimo, sem dependência e sem compressão ("stored").
 *
 * Existe para a exportação em Markdown poder levar as imagens junto: o `.md` sozinho não
 * carrega anexo, e embutir a foto em base64 dentro dele geraria megabytes de texto que
 * ninguém — nem uma IA — consegue usar como imagem. Com o ZIP, o Markdown referencia
 * `anexos/foto.png` por caminho relativo e o arquivo está lá do lado.
 *
 * **Por que sem compressão:** o conteúdo real são PNG, JPEG e WEBP, que já estão
 * comprimidos — passar por deflate economizaria quase nada e exigiria uma biblioteca. O
 * texto do Markdown é uma fração desprezível do total. "Stored" é o formato mais simples do
 * ZIP e qualquer descompactador abre.
 */

// ── CRC32 (exigido pelo formato, um por arquivo) ─────────────────────────────

const TABELA = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(dados: Uint8Array): number {
  let c = 0xFFFFFFFF
  for (let i = 0; i < dados.length; i++) c = TABELA[(c ^ dados[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

// ── Montagem ─────────────────────────────────────────────────────────────────

/**
 * `Uint8Array<ArrayBuffer>` e não `Uint8Array`: desde o TypeScript 5.7 o tipo aceita também
 * `SharedArrayBuffer`, que o construtor do `Blob` recusa. Sem o parâmetro explícito, a
 * montagem do pacote não compila.
 */
export interface ArquivoZip { nome: string; dados: Uint8Array<ArrayBuffer> }

/** Converte data/hora para o formato MS-DOS que o ZIP usa nos cabeçalhos. */
function dataDos(d: Date): { hora: number; data: number } {
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2)),
    data: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  }
}

export function montarZip(arquivos: ArquivoZip[], agora: Date = new Date()): Blob {
  const cod = new TextEncoder()
  const { hora, data } = dataDos(agora)
  const locais: Uint8Array<ArrayBuffer>[] = []
  const central: Uint8Array<ArrayBuffer>[] = []
  let deslocamento = 0

  for (const arq of arquivos) {
    const nome = cod.encode(arq.nome)
    const crc  = crc32(arq.dados)
    const tam  = arq.dados.length

    const local = new Uint8Array(30 + nome.length)
    const vl = new DataView(local.buffer)
    vl.setUint32(0, 0x04034b50, true)
    vl.setUint16(4, 20, true)        // versão necessária
    vl.setUint16(6, 0x0800, true)    // nome em UTF-8 — sem isto, acento vira lixo
    vl.setUint16(8, 0, true)         // método 0 = stored
    vl.setUint16(10, hora, true)
    vl.setUint16(12, data, true)
    vl.setUint32(14, crc, true)
    vl.setUint32(18, tam, true)      // tamanho comprimido
    vl.setUint32(22, tam, true)      // tamanho original (igual, sem compressão)
    vl.setUint16(26, nome.length, true)
    vl.setUint16(28, 0, true)
    local.set(nome, 30)

    const cab = new Uint8Array(46 + nome.length)
    const vc = new DataView(cab.buffer)
    vc.setUint32(0, 0x02014b50, true)
    vc.setUint16(4, 20, true)        // versão de criação
    vc.setUint16(6, 20, true)
    vc.setUint16(8, 0x0800, true)
    vc.setUint16(10, 0, true)
    vc.setUint16(12, hora, true)
    vc.setUint16(14, data, true)
    vc.setUint32(16, crc, true)
    vc.setUint32(20, tam, true)
    vc.setUint32(24, tam, true)
    vc.setUint16(28, nome.length, true)
    vc.setUint32(42, deslocamento, true)   // onde começa o cabeçalho local deste arquivo
    cab.set(nome, 46)

    locais.push(local, arq.dados)
    central.push(cab)
    deslocamento += local.length + tam
  }

  const tamCentral = central.reduce((n, c) => n + c.length, 0)
  const fim = new Uint8Array(22)
  const vf = new DataView(fim.buffer)
  vf.setUint32(0, 0x06054b50, true)
  vf.setUint16(8,  arquivos.length, true)
  vf.setUint16(10, arquivos.length, true)
  vf.setUint32(12, tamCentral, true)
  vf.setUint32(16, deslocamento, true)

  return new Blob([...locais, ...central, fim], { type: 'application/zip' })
}

/**
 * Converte um data URI (`data:image/png;base64,...`) nos bytes correspondentes.
 * Devolve `null` quando o dado não é um data URI válido — anexo corrompido não pode
 * derrubar a exportação inteira.
 */
export function bytesDeDataUri(dataUri: string): { bytes: Uint8Array<ArrayBuffer>; mime: string } | null {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUri)
  if (!m) return null
  const mime = m[1] || 'application/octet-stream'
  try {
    if (m[2]) {
      const bin = atob(m[3])
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      return { bytes, mime }
    }
    return { bytes: new TextEncoder().encode(decodeURIComponent(m[3])), mime }
  } catch {
    return null
  }
}

/** Extensão a partir do MIME, para o arquivo abrir com dois cliques fora do app. */
export function extensaoDe(mime: string, nomeOriginal?: string): string {
  const doNome = nomeOriginal?.match(/\.([a-z0-9]{1,5})$/i)?.[1]
  if (doNome) return doNome.toLowerCase()
  const mapa: Record<string, string> = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif',
    'image/webp': 'webp', 'image/svg+xml': 'svg', 'application/pdf': 'pdf',
    'audio/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'text/plain': 'txt',
  }
  return mapa[mime.toLowerCase()] ?? 'bin'
}
