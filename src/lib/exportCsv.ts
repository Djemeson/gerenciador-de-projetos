// Exportação de CSV do app. Fonte única — telas novas que precisarem exportar devem
// chamar `downloadCsv` em vez de montar Blob/anchor por conta própria.
import { baixarArquivo } from './download'

/** Escapa um valor para CSV: aspas duplicadas e campo entre aspas quando necessário. */
function cell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Gera e baixa um CSV. Usa **ponto e vírgula** como separador e BOM UTF-8 porque o
 * destino real desses arquivos é o Excel em português: com vírgula, ele joga a linha
 * inteira numa célula só, e sem BOM os acentos chegam quebrados.
 */
export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const content = [headers, ...rows].map(r => r.map(cell).join(';')).join('\r\n')
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  baixarArquivo(filename.endsWith('.csv') ? filename : `${filename}.csv`, blob)
}

/** Nome de arquivo com data do dia, no formato que o Windows aceita. */
export function csvFilename(prefix: string): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${prefix}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.csv`
}
