import { useEffect, useCallback } from 'react'
import type { PluginMessage, UIMessage } from '../shared/types'

type Handler = (msg: PluginMessage) => void

const handlers = new Set<Handler>()

window.onmessage = (event: MessageEvent) => {
  const msg = event.data?.pluginMessage as PluginMessage | undefined
  if (msg) handlers.forEach((h) => h(msg))
}

export function usePluginMessage(handler: Handler) {
  useEffect(() => {
    handlers.add(handler)
    return () => { handlers.delete(handler) }
  }, [handler])
}

export function sendMessage(msg: UIMessage) {
  parent.postMessage({ pluginMessage: msg }, '*')
}

export function useNavigate() {
  return useCallback((nodeId: string) => {
    sendMessage({ type: 'navigate-to-node', nodeId })
  }, [])
}
