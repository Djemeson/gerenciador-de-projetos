import React, { useState } from 'react'
import { Check, Download, Share, SquarePlus } from 'lucide-react'
import { usePwaInstall } from '../lib/pwa'

/**
 * Convite para instalar o app no dispositivo.
 *
 * Cada navegador expõe isso de um jeito, então o cartão tem três estados reais em vez de
 * um botão que às vezes não faz nada:
 *
 * - **Android/Chrome/Edge**: existe o evento `beforeinstallprompt` → botão de um clique.
 * - **iPhone/iPad**: o Safari nunca dispara esse evento; a instalação é manual pelo menu
 *   Compartilhar. Aqui mostramos o caminho exato, porque sem isso o usuário conclui que
 *   "não dá para instalar".
 * - **Já instalado**: confirma e para de pedir.
 */
export function InstallAppCard() {
  const { podeInstalar, instalado, precisaInstrucaoIOS, instalar } = usePwaInstall()
  const [recusado, setRecusado] = useState(false)

  if (instalado) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-success-100 bg-success-50/40 p-3.5">
        <Check size={16} className="text-success-600 flex-shrink-0" />
        <p className="text-[12px] font-bold text-success-700">App instalado neste dispositivo</p>
      </div>
    )
  }

  if (precisaInstrucaoIOS) {
    return (
      <div className="rounded-xl border border-gray-200/60 bg-white p-3.5">
        <p className="text-[12.5px] font-bold text-gray-800">Instalar na tela de início</p>
        <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
          No iPhone e no iPad a instalação é feita pelo Safari, em dois toques:
        </p>
        <ol className="mt-2.5 space-y-1.5">
          <li className="flex items-center gap-2 text-[11.5px] text-gray-700">
            <Share size={14} className="text-brand-500 flex-shrink-0" />
            Toque em <strong className="font-bold">Compartilhar</strong>, na barra de baixo
          </li>
          <li className="flex items-center gap-2 text-[11.5px] text-gray-700">
            <SquarePlus size={14} className="text-brand-500 flex-shrink-0" />
            Escolha <strong className="font-bold">Adicionar à Tela de Início</strong>
          </li>
        </ol>
      </div>
    )
  }

  if (podeInstalar) {
    return (
      <div className="rounded-xl border border-gray-200/60 bg-white p-3.5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-bold text-gray-800">Instalar no dispositivo</p>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
            Abre em janela própria, sem barra do navegador, e com ícone junto dos outros apps.
          </p>
          {recusado && (
            <p className="text-[11px] text-gray-500 mt-1.5">
              Instalação cancelada — dá para tentar de novo quando quiser.
            </p>
          )}
        </div>
        <button
          onClick={async () => { const r = await instalar(); if (r === 'dismissed') setRecusado(true) }}
          className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 text-white rounded-lg text-[11px] font-bold hover:bg-brand-700 transition-colors flex-shrink-0"
        >
          <Download size={13} /> Instalar
        </button>
      </div>
    )
  }

  // Navegador sem suporte, ou o evento ainda não chegou (o Chrome exige uma visita antes
  // de oferecer). Dizer isso é melhor do que mostrar um botão inerte.
  return (
    <div className="rounded-xl border border-gray-200/60 bg-white p-3.5">
      <p className="text-[12.5px] font-bold text-gray-800">Instalar no dispositivo</p>
      <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
        Este navegador ainda não ofereceu a instalação. No computador, procure o ícone de
        instalar na barra de endereço; no Android, use <strong className="font-bold">Instalar
        aplicativo</strong> no menu do Chrome.
      </p>
    </div>
  )
}
