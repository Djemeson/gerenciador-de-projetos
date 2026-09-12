// Persistência local via localStorage — ativo quando Firebase não está configurado
import type { Project, Task } from '../types'
import { extrairBlobs, reidratarBlobs, sincronizarCofre } from './localAttachments'

const PROJECTS_KEY = 'tf_projects'
const TASKS_KEY    = 'tf_tasks'

function load<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as T[]
  } catch {
    return []
  }
}

/**
 * O espaço do localStorage é pequeno e acaba sem aviso: o `setItem` lança
 * QuotaExceededError, e como toda gravação acontece dentro de uma ação da store (às vezes
 * dentro do callback do FileReader), a exceção subia sem ninguém para pegá-la — a ação
 * morria antes do `set`, e o item que o usuário acabou de criar simplesmente não aparecia.
 * Agora a falha é contada e avisada, nunca engolida.
 */
let jaAvisouCheio = false
export function gravarComAviso(key: string, valor: string): boolean {
  try {
    localStorage.setItem(key, valor)
    return true
  } catch (e) {
    const cheio = e instanceof DOMException &&
      (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    console.error(cheio ? `Espaço do navegador esgotado ao gravar "${key}".` : `Falha ao gravar "${key}".`, e)
    if (cheio && !jaAvisouCheio) {
      jaAvisouCheio = true
      setTimeout(() => {
        alert('O espaço deste navegador para o app acabou e a última alteração não pôde ser salva.\n\n' +
              'Apague alguns anexos antigos ou abra o app em outro navegador para continuar.')
      }, 0)
    }
    return false
  }
}

function save<T>(key: string, data: T[]): void {
  gravarComAviso(key, JSON.stringify(data))
}

export const localProjects = {
  getAll: (): Project[]           => load<Project>(PROJECTS_KEY),
  set:    (data: Project[]) => save(PROJECTS_KEY, data),
}

export const localTasks = {
  /** Devolve as tarefas como estão no localStorage: anexos ainda como referência ao cofre
   *  (ver `reidratar`). O boot usa esta versão para pintar a tela sem esperar o disco. */
  getAll: (): Task[] => load<Task>(TASKS_KEY),
  /** Preenche os anexos a partir do cofre IndexedDB. */
  reidratar: (tasks: Task[]): Promise<Task[]> => reidratarBlobs(tasks),
  set: (data: Task[]) => {
    // Os anexos (PDF, foto, áudio) saem daqui e vão para o cofre IndexedDB: em base64 eles
    // sozinhos estouram o teto do localStorage, e o estouro derrubava a gravação inteira.
    const extracao = extrairBlobs(data)
    save(TASKS_KEY, extracao.enxutas)
    void sincronizarCofre(extracao)
  },
}
