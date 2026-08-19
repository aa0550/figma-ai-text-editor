import type { ScanScope } from '../shared/types'
import type { Lang } from '../shared/i18n'
import { sendMessage } from './usePluginBridge'

export function requestStorage() {
  sendMessage({ type: 'load-storage' })
}

export function saveRules(rules: string) {
  sendMessage({ type: 'save-storage', key: 'rules', value: rules })
}

export function saveApiKey(key: string) {
  sendMessage({ type: 'save-storage', key: 'apiKey', value: key })
}

export function saveFileUrl(url: string) {
  sendMessage({ type: 'save-storage', key: 'fileUrl', value: url })
}

export function saveLang(lang: Lang) {
  sendMessage({ type: 'save-storage', key: 'lang', value: lang })
}

export function saveScanOptions(scope: ScanScope, onlyVisible: boolean) {
  sendMessage({ type: 'save-scan-options', scope, onlyVisible })
}
