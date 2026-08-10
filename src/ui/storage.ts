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
