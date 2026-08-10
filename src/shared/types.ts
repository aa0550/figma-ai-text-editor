export interface TextNode {
  id: string
  text: string
  parentName: string
  parentId: string
  pageName: string
}

export interface Suggestion {
  nodeId: string
  original: string
  suggested: string
  reason: string
  parentName: string
  parentId: string
  pageName: string
  accepted?: boolean
  skipped?: boolean
}

export type ScanScope = 'page' | 'selection'

export type PluginMessage =
  | { type: 'scan-complete'; nodes: TextNode[] }
  | { type: 'navigate-to-node'; nodeId: string }
  | { type: 'apply-change'; nodeId: string; newText: string }
  | { type: 'apply-all'; changes: { nodeId: string; newText: string }[] }
  | { type: 'error'; message: string }
  | { type: 'storage-data'; rules: string; apiKey: string }

export type UIMessage =
  | { type: 'start-scan'; scope: ScanScope; onlyVisible: boolean }
  | { type: 'navigate-to-node'; nodeId: string }
  | { type: 'apply-change'; nodeId: string; newText: string }
  | { type: 'apply-all'; changes: { nodeId: string; newText: string }[] }
  | { type: 'load-storage' }
  | { type: 'save-storage'; key: 'rules' | 'apiKey'; value: string }
