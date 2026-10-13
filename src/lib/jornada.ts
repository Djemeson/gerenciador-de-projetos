// A jornada mora em shared/ porque o conector do Claude (ver_marcos) conta a mesma história
// que a aba "Marcos". Aqui só se fixa o tipo `Task` e o "hoje" do aparelho.
import type { Task } from '../types'
import { isoDate } from './dateFilter'
import {
  montarJornada as montar, ordenarTarefasDoMarco as ordenarShared,
  type Jornada as JornadaShared, type MarcoDaJornada as MarcoShared,
} from '../../shared/jornada'

export type { FaseMarco } from '../../shared/jornada'
export type Jornada = JornadaShared<Task>
export type MarcoDaJornada = MarcoShared<Task>

export const ordenarTarefasDoMarco = (tarefas: Task[]): Task[] => ordenarShared(tarefas)

export function montarJornada(tarefas: Task[], agora: Date = new Date()): Jornada {
  return montar(tarefas, isoDate(agora))
}
