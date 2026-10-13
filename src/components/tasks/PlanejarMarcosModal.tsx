import React, { useEffect, useMemo, useState } from 'react'
import { Sparkles, Loader2, Diamond, Plus, Check, Info, ArrowLeft } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui'
import { AiKeyNotice } from '../ui/AiKeyNotice'
import { DueDatePicker } from '../ui/DueDatePicker'
import { IdCurto } from '../ui/IdCurto'
import { useAppStore } from '../../stores/useAppStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { planejarMarcos, tarefasElegiveis, type PlanoMarco } from '../../lib/aiMarcos'
import { isoDate } from '../../lib/dateFilter'
import { nanoid } from '../../lib/nanoid'
import type { Task } from '../../types'

/**
 * "Planejar marcos com IA" — aba Marcos (DIRETRIZES 4.12).
 *
 * O usuário escreve do jeito dele como quer conduzir o projeto; a IA devolve marcos com
 * tarefas novas **e** as que já existem no projeto e pertencem àquela etapa. Nada é gravado
 * antes do "Criar": cada marco e cada tarefa da proposta pode ser desmarcado, e o prazo
 * de cada marco pode ser ajustado ali mesmo (é ele que ordena a jornada).
 */

type Passo = 'pedido' | 'gerando' | 'proposta'
interface MarcoEditavel extends PlanoMarco { usar: boolean; usarNovas: boolean[]; usarExistentes: boolean[] }

const EXEMPLO = `Ex.: primeiro deixar o ambiente no ar até dia 20; depois integrar com o OPA e testar com 5 clientes; em novembro treinar a equipe e virar para produção.

Também dá para escrever em tópicos:
Ambiente no ar até 20/10
- Contratar VPS
- Configurar SSL`

export function PlanejarMarcosModal({ open, onClose, projectId, tasks: tarefas }: {
  open: boolean; onClose: () => void; projectId: string; tasks: Task[]
}) {
  const { projects, quickAddTask, updateTask } = useAppStore()
  const { openAIKey, geminiApiKey } = useSettingsStore()
  const projeto = projects.find(p => p.id === projectId)

  const [passo, setPasso] = useState<Passo>('pedido')
  const [pedido, setPedido] = useState('')
  const [aproveitar, setAproveitar] = useState(true)
  const [proposta, setProposta] = useState<MarcoEditavel[]>([])
  const [usouIA, setUsouIA] = useState(false)
  const [erro, setErro] = useState('')

  // Reabrir começa do pedido, mas guarda o texto: quem fecha para conferir algo e volta
  // não perde o que escreveu.
  useEffect(() => { if (open) { setPasso('pedido'); setErro('') } }, [open])

  const porId = useMemo(() => new Map(tarefas.map(t => [t.id, t])), [tarefas])
  const soltas = useMemo(() => tarefasElegiveis(tarefas).length, [tarefas])

  if (!projeto) return null

  const gerar = async () => {
    if (!pedido.trim()) { setErro('Escreva como você quer conduzir o projeto.'); return }
    setErro(''); setPasso('gerando')
    const { marcos, usedAI } = await planejarMarcos(
      { nome: projeto.name, descricao: projeto.description },
      tarefas, pedido, { aproveitar, hoje: isoDate(new Date()) }, { openAIKey, geminiApiKey },
    )
    if (!marcos.length) {
      setErro('Não consegui montar marcos a partir desse texto. Tente separar as etapas em linhas.')
      setPasso('pedido'); return
    }
    setProposta(marcos.map(m => ({ ...m, usar: true, usarNovas: m.novas.map(() => true), usarExistentes: m.existentes.map(() => true) })))
    setUsouIA(usedAI); setPasso('proposta')
  }

  const mudar = (i: number, patch: Partial<MarcoEditavel>) =>
    setProposta(p => p.map((m, j) => (j === i ? { ...m, ...patch } : m)))
  const alternarItem = (i: number, campo: 'usarNovas' | 'usarExistentes', k: number) =>
    setProposta(p => p.map((m, j) => (j === i ? { ...m, [campo]: m[campo].map((v, x) => (x === k ? !v : v)) } : m)))

  const escolhidos = proposta.filter(m => m.usar)

  const criar = () => {
    for (const m of escolhidos) {
      const marco = quickAddTask(m.titulo, projectId, 'todo')
      const descricao = m.descricao.trim()
      updateTask(marco.id, {
        taskType: 'milestone', dueDate: m.prazo,
        ...(descricao ? { blocks: [{ id: nanoid(), type: 'text' as const, text: descricao.replace(/&/g, '&amp;').replace(/</g, '&lt;'), region: 'body' as const }] } : {}),
      })
      const novas = m.novas.filter((_, k) => m.usarNovas[k])
      const existentes = m.existentes.filter((id, k) => m.usarExistentes[k] && porId.has(id))
      novas.forEach(titulo => quickAddTask(titulo, projectId, 'todo', marco.id))
      existentes.forEach(id => updateTask(id, { parentId: marco.id }))
      // Marco montado só com trabalho já entregue nasce concluído — senão a jornada o
      // mostraria como "onde estamos" (mesma regra do conector, criar_marco).
      if (!novas.length && existentes.length && existentes.every(id => porId.get(id)!.status === 'done'))
        updateTask(marco.id, { status: 'done' })
    }
    setPedido(''); setProposta([]); onClose()
  }

  const rodape = passo === 'proposta' ? (
    <div className="flex gap-2">
      <Button variant="default" onClick={() => setPasso('pedido')} icon={<ArrowLeft size={14}/>}>Ajustar pedido</Button>
      <Button variant="primary" className="flex-1" onClick={criar} disabled={!escolhidos.length} icon={<Check size={14}/>}>
        Criar {escolhidos.length} marco{escolhidos.length === 1 ? '' : 's'}
      </Button>
    </div>
  ) : (
    <div className="flex gap-2">
      <Button variant="default" className="flex-1" onClick={onClose}>Cancelar</Button>
      <Button variant="primary" className="flex-1" onClick={gerar} disabled={passo === 'gerando'}
        icon={passo === 'gerando' ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}>
        {passo === 'gerando' ? 'Montando a proposta…' : 'Montar proposta'}
      </Button>
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} width="max-w-2xl" icon={Sparkles} iconClassName="ai-gradient-bg"
      title="Planejar marcos com IA"
      subtitle={passo === 'proposta' ? 'Desmarque o que não quiser e ajuste os prazos — nada foi criado ainda.' : `Descreva as etapas de "${projeto.name}" do seu jeito.`}
      footer={rodape}>
      {passo !== 'proposta' ? (
        <div className="space-y-3">
          <AiKeyNotice compact/>
          <textarea autoFocus value={pedido} onChange={e => setPedido(e.target.value)} placeholder={EXEMPLO} rows={8}
            disabled={passo === 'gerando'}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) gerar() }}
            className="w-full text-[13px] leading-relaxed px-3 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300 resize-y"/>
          <label className="flex items-start gap-2 text-[12px] text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={aproveitar} onChange={e => setAproveitar(e.target.checked)} className="mt-0.5 accent-brand-600"/>
            <span>
              Aproveitar as tarefas que já existem neste projeto
              <span className="text-gray-400"> — {soltas ? `${soltas} ainda fora de marco` : 'nenhuma fora de marco'}; as que já estão num marco não mudam de lugar.</span>
            </span>
          </label>
          {erro && <p className="text-[12px] text-danger-600">{erro}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {!usouIA && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-warning-50 border border-warning-100 text-[12px] text-warning-700">
              <Info size={14} className="flex-shrink-0 mt-0.5"/>
              <span>Sem IA disponível agora: li a <strong>forma</strong> do texto — cada linha virou um marco e os tópicos abaixo dela, tarefas. Tópico com o mesmo nome de uma tarefa que já existe reaproveita a existente.</span>
            </div>
          )}
          {proposta.map((m, i) => (
            <div key={i} className={`rounded-xl border transition-colors ${m.usar ? 'border-gray-200 bg-white' : 'border-gray-200/60 bg-gray-50 opacity-60'}`}>
              <div className="flex items-center gap-2 px-3 py-2.5">
                <input type="checkbox" checked={m.usar} onChange={() => mudar(i, { usar: !m.usar })} className="accent-brand-600" aria-label={`Usar o marco ${m.titulo}`}/>
                <Diamond size={14} className="text-brand-600 flex-shrink-0"/>
                <input value={m.titulo} onChange={e => mudar(i, { titulo: e.target.value })}
                  className="flex-1 min-w-0 text-[14px] font-bold text-gray-900 bg-transparent outline-none focus:bg-gray-50 rounded px-1"/>
                <DueDatePicker value={m.prazo} onChange={d => mudar(i, { prazo: d })}/>
              </div>
              {m.descricao && <p className="px-3 -mt-1 pb-2 pl-[52px] text-[12px] text-gray-500">{m.descricao}</p>}
              {(m.novas.length > 0 || m.existentes.length > 0) && (
                <div className="border-t border-gray-100 px-3 py-1.5 pl-[44px] space-y-0.5">
                  {m.existentes.map((id, k) => {
                    const t = porId.get(id)
                    if (!t) return null
                    return (
                      <label key={id} className="flex items-center gap-2 py-1 text-[13px] cursor-pointer">
                        <input type="checkbox" checked={m.usarExistentes[k]} disabled={!m.usar} onChange={() => alternarItem(i, 'usarExistentes', k)} className="accent-brand-600"/>
                        <span className={`min-w-0 truncate ${t.status === 'done' ? 'line-through text-gray-400' : 'text-gray-700'}`}>{t.title}</span>
                        <IdCurto tipo="task" seq={t.seq}/>
                        <span className="flex-shrink-0 text-[11px] text-gray-400">já existe</span>
                      </label>
                    )
                  })}
                  {m.novas.map((titulo, k) => (
                    <label key={'n' + k} className="flex items-center gap-2 py-1 text-[13px] cursor-pointer">
                      <input type="checkbox" checked={m.usarNovas[k]} disabled={!m.usar} onChange={() => alternarItem(i, 'usarNovas', k)} className="accent-brand-600"/>
                      <span className="min-w-0 truncate text-gray-800">{titulo}</span>
                      <span className="flex-shrink-0 flex items-center gap-0.5 text-[11px] font-semibold text-brand-600"><Plus size={12}/>nova</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
