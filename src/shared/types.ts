export interface TextNode {
  id: string
  text: string
  parentName: string
  pageName: string
}

export interface Suggestion {
  nodeId: string
  original: string
  suggested: string
  reason: string
  parentName: string
  pageName: string
  accepted?: boolean
  skipped?: boolean
}

export type PluginMessage =
  | { type: 'scan-complete'; nodes: TextNode[] }
  | { type: 'navigate-to-node'; nodeId: string }
  | { type: 'apply-change'; nodeId: string; newText: string }
  | { type: 'apply-all'; changes: { nodeId: string; newText: string }[] }
  | { type: 'get-file-key' }
  | { type: 'file-key'; key: string | null }
  | { type: 'error'; message: string }

export type UIMessage =
  | { type: 'start-scan' }
  | { type: 'navigate-to-node'; nodeId: string }
  | { type: 'apply-change'; nodeId: string; newText: string }
  | { type: 'apply-all'; changes: { nodeId: string; newText: string }[] }
  | { type: 'get-file-key' }
