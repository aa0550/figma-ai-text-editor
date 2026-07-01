const RULES_KEY = 'ux-editor-rules'
const API_KEY_KEY = 'ux-editor-api-key'

export function loadRules(): string {
  return localStorage.getItem(RULES_KEY) ?? ''
}

export function saveRules(rules: string) {
  localStorage.setItem(RULES_KEY, rules)
}

export function loadApiKey(): string {
  return localStorage.getItem(API_KEY_KEY) ?? ''
}

export function saveApiKey(key: string) {
  localStorage.setItem(API_KEY_KEY, key)
}
