import type { Settings } from '../stores/useSettingsStore'

/**
 * Junta a configuração que veio da nuvem com a que já existe neste dispositivo.
 *
 * A regra que não é óbvia: **valor vazio vindo da nuvem não apaga o valor local.**
 *
 * O caso real que motiva isso — o computador tem a chave de IA, o celular não. Ao abrir o
 * celular ele recebe o documento, aplica, e em seguida faz o seu próprio push. Se a
 * mesclagem fosse "o remoto manda", bastava o celular sincronizar uma vez antes de receber
 * para zerar a chave nos dois lados. Preferir o valor preenchido torna a operação
 * convergente: qualquer ordem de chegada termina com a chave presente.
 *
 * O preço é que limpar uma chave de propósito não se propaga — precisa ser feito em cada
 * aparelho. Para um app pessoal isso é muito melhor do que perder a chave sem perceber.
 */
export function mesclarSettingsRemotas(local: Settings, remoto: Partial<Settings> | undefined | null): Settings {
  if (!remoto) return local
  const preferirPreenchido = (novo: unknown, velho: string): string =>
    typeof novo === 'string' && novo.trim() ? novo : velho
  return {
    quickCaptureHotkey: preferirPreenchido(remoto.quickCaptureHotkey, local.quickCaptureHotkey),
    openAIKey:          preferirPreenchido(remoto.openAIKey,          local.openAIKey),
    geminiApiKey:       preferirPreenchido(remoto.geminiApiKey,       local.geminiApiKey),
  }
}
