import { describe, it, expect } from 'vitest'
import { mesclarSettingsRemotas } from '../settingsMerge'
import type { Settings } from '../../stores/useSettingsStore'

const local: Settings = { quickCaptureHotkey: 'ctrl+space', openAIKey: 'sk-local', geminiApiKey: '' }

describe('mesclarSettingsRemotas', () => {
  it('traz a chave que só existe na nuvem', () => {
    const r = mesclarSettingsRemotas(local, { geminiApiKey: 'AIza-nuvem' })
    expect(r.geminiApiKey).toBe('AIza-nuvem')
  })

  it('a nuvem sobrescreve quando os dois lados têm valor', () => {
    const r = mesclarSettingsRemotas(local, { openAIKey: 'sk-nuvem' })
    expect(r.openAIKey).toBe('sk-nuvem')
  })

  // Esta é a regressão que a regra existe para impedir: um aparelho ainda sem chave
  // sincroniza antes de receber, e sua configuração vazia zeraria a chave do outro.
  it('configuração vazia da nuvem NÃO apaga a chave local', () => {
    const r = mesclarSettingsRemotas(local, { openAIKey: '', geminiApiKey: '' })
    expect(r.openAIKey).toBe('sk-local')
  })

  it('espaço em branco conta como vazio', () => {
    const r = mesclarSettingsRemotas(local, { openAIKey: '   ' })
    expect(r.openAIKey).toBe('sk-local')
  })

  it('converge em qualquer ordem de chegada entre dois aparelhos', () => {
    const comChave: Settings = { ...local, geminiApiKey: 'AIza-1' }
    const semChave: Settings = { quickCaptureHotkey: 'ctrl+space', openAIKey: '', geminiApiKey: '' }
    // aparelho sem chave recebe do que tem, e depois devolve o seu estado
    const depoisDeReceber = mesclarSettingsRemotas(semChave, comChave)
    const devolta = mesclarSettingsRemotas(comChave, depoisDeReceber)
    expect(depoisDeReceber.geminiApiKey).toBe('AIza-1')
    expect(devolta.geminiApiKey).toBe('AIza-1')
  })

  // Documento antigo, gravado antes de a configuração sincronizar.
  it('documento sem settings mantém tudo como está', () => {
    expect(mesclarSettingsRemotas(local, undefined)).toEqual(local)
    expect(mesclarSettingsRemotas(local, null)).toEqual(local)
  })

  it('atalho ausente não vira string vazia', () => {
    const r = mesclarSettingsRemotas(local, { openAIKey: 'sk-nuvem' })
    expect(r.quickCaptureHotkey).toBe('ctrl+space')
  })
})
