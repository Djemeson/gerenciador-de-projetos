// Cofre local de blobs (IndexedDB).
//
// O estado do app mora no localStorage, que tem teto rígido de alguns MB por origem — e
// esse teto é o motivo de "anexei um PDF e não foi": o base64 do arquivo entrava no JSON
// das tarefas, o `setItem` estourava com QuotaExceededError dentro do callback do
// FileReader e ninguém via nada. Sem `set` na store, o anexo nem aparecia na tela.
//
// IndexedDB não tem esse teto (a cota é de gigabytes, compartilhada com o resto do
// navegador), e é onde binário deve morar. O JSON das tarefas passa a guardar só uma
// referência (`lref`), do mesmo jeito que já fazia para os anexos da nuvem.
const DB_NAME = 'tf_blobs'
const STORE = 'blobs'
const DB_VERSION = 1

let conexao: Promise<IDBDatabase | null> | null = null

/** Abre (uma vez) o banco. Devolve `null` quando o navegador não tem IndexedDB — modo
 *  privado antigo, contexto restrito —, e aí o chamador volta ao comportamento anterior. */
function abrir(): Promise<IDBDatabase | null> {
  if (conexao) return conexao
  conexao = new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => { console.warn('Cofre de anexos indisponível:', req.error); resolve(null) }
      req.onblocked = () => resolve(null)
    } catch (e) {
      console.warn('Cofre de anexos indisponível:', e)
      resolve(null)
    }
  })
  return conexao
}

export async function cofreDisponivel(): Promise<boolean> {
  return (await abrir()) !== null
}

function transacao(db: IDBDatabase, modo: IDBTransactionMode) {
  const tx = db.transaction(STORE, modo)
  return { tx, store: tx.objectStore(STORE) }
}

const aoTerminar = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => {
  tx.oncomplete = () => resolve()
  tx.onerror = () => reject(tx.error)
  tx.onabort = () => reject(tx.error)
})

/** Grava os blobs informados. Uma transação só para todos — gravar um por um em arquivos
 *  grandes deixava a interface engasgada. */
export async function guardarBlobs(entradas: { id: string; data: string }[]): Promise<boolean> {
  if (!entradas.length) return true
  const db = await abrir()
  if (!db) return false
  try {
    const { tx, store } = transacao(db, 'readwrite')
    entradas.forEach(e => store.put(e))
    await aoTerminar(tx)
    return true
  } catch (e) {
    console.warn('Não foi possível guardar anexos no cofre local:', e)
    return false
  }
}

export async function lerBlobs(ids: string[]): Promise<Map<string, string>> {
  const encontrados = new Map<string, string>()
  if (!ids.length) return encontrados
  const db = await abrir()
  if (!db) return encontrados
  try {
    const { tx, store } = transacao(db, 'readonly')
    ids.forEach(id => {
      const req = store.get(id)
      req.onsuccess = () => { const v = req.result; if (v?.data) encontrados.set(id, v.data as string) }
    })
    await aoTerminar(tx)
  } catch (e) {
    console.warn('Não foi possível ler anexos do cofre local:', e)
  }
  return encontrados
}

/**
 * Apaga tudo que não está mais em uso. Sem isso, cada anexo excluído ficaria para sempre
 * ocupando espaço do navegador — o mesmo vazamento que a nuvem já resolveu em
 * `deleteAttachmentsOf`.
 */
export async function manterApenas(idsVivos: Set<string>): Promise<void> {
  const db = await abrir()
  if (!db) return
  try {
    const { tx, store } = transacao(db, 'readwrite')
    const req = store.getAllKeys()
    req.onsuccess = () => {
      (req.result as IDBValidKey[]).forEach(k => {
        if (typeof k === 'string' && !idsVivos.has(k)) store.delete(k)
      })
    }
    await aoTerminar(tx)
  } catch (e) {
    console.warn('Não foi possível limpar anexos antigos do cofre local:', e)
  }
}
