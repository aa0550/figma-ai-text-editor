/// <reference types="@figma/plugin-typings" />
import type { Lang } from '../shared/i18n'
import type { UIMessage } from '../shared/types'

figma.showUI(__html__, { width: 480, height: 640, title: 'AI Text Editor' })

interface NotifyStrings {
  unsupportedFont: string
  appliedWithErrors: (failed: number) => string
  appliedAll: string
}

const NOTIFY: Record<Lang, NotifyStrings> = {
  ru: {
    unsupportedFont: 'Не удалось применить изменение: неподдерживаемый шрифт',
    appliedWithErrors: (failed: number) => `Применено с ошибками: ${failed} узлов пропущено`,
    appliedAll: 'Все изменения применены ✓',
  },
  en: {
    unsupportedFont: 'Failed to apply change: unsupported font',
    appliedWithErrors: (failed: number) => `Applied with errors: ${failed} nodes skipped`,
    appliedAll: 'All changes applied ✓',
  },
}

function getParentFrame(node: BaseNode): BaseNode | null {
  let current: BaseNode | null = node.parent
  let topMost: BaseNode | null = null
  while (current) {
    if (current.type === 'FRAME' || current.type === 'COMPONENT' || current.type === 'COMPONENT_SET' || current.type === 'INSTANCE') {
      topMost = current
    }
    current = current.parent
  }
  return topMost
}

function collectTextNodes(node: SceneNode, results: { id: string; text: string; parentName: string; parentId: string; pageName: string }[], onlyVisible: boolean) {
  if (onlyVisible && !node.visible) return

  if (node.type === 'TEXT') {
    const parentFrame = getParentFrame(node)
    results.push({
      id: node.id,
      text: node.characters,
      parentName: parentFrame ? parentFrame.name : 'Root',
      parentId: parentFrame ? parentFrame.id : node.id,
      pageName: figma.currentPage.name,
    })
  }
  if ('children' in node) {
    for (const child of node.children) {
      collectTextNodes(child, results, onlyVisible)
    }
  }
}

const STORAGE_KEYS = { rules: 'ux-editor-rules', apiKey: 'ux-editor-api-key', lang: 'ux-editor-lang' } as const
const SCAN_OPTIONS_KEYS = { scope: 'ux-editor-scope', onlyVisible: 'ux-editor-only-visible' } as const

figma.ui.onmessage = async (msg: UIMessage) => {
  if (msg.type === 'load-storage') {
    const [rules, apiKey, lang, scope, onlyVisible] = await Promise.all([
      figma.clientStorage.getAsync(STORAGE_KEYS.rules),
      figma.clientStorage.getAsync(STORAGE_KEYS.apiKey),
      figma.clientStorage.getAsync(STORAGE_KEYS.lang),
      figma.clientStorage.getAsync(SCAN_OPTIONS_KEYS.scope),
      figma.clientStorage.getAsync(SCAN_OPTIONS_KEYS.onlyVisible),
    ])
    figma.ui.postMessage({
      type: 'storage-data',
      rules: rules ?? '',
      apiKey: apiKey ?? '',
      lang: lang === 'en' ? 'en' : 'ru',
      scope: scope === 'selection' ? 'selection' : 'page',
      onlyVisible: onlyVisible ?? true,
    })
  }

  if (msg.type === 'save-storage') {
    const key = msg.key as keyof typeof STORAGE_KEYS
    await figma.clientStorage.setAsync(STORAGE_KEYS[key], msg.value)
  }

  if (msg.type === 'save-scan-options') {
    await figma.clientStorage.setAsync(SCAN_OPTIONS_KEYS.scope, msg.scope)
    await figma.clientStorage.setAsync(SCAN_OPTIONS_KEYS.onlyVisible, msg.onlyVisible)
  }

  if (msg.type === 'start-scan') {
    const nodes: { id: string; text: string; parentName: string; parentId: string; pageName: string }[] = []
    const roots = msg.scope === 'selection' ? figma.currentPage.selection : figma.currentPage.children
    for (const node of roots) {
      collectTextNodes(node, nodes, msg.onlyVisible)
    }
    figma.ui.postMessage({ type: 'scan-complete', nodes })
  }

  if (msg.type === 'navigate-to-node') {
    const node = await figma.getNodeByIdAsync(msg.nodeId)
    if (node && node.type !== 'DOCUMENT' && node.type !== 'PAGE') {
      figma.viewport.scrollAndZoomIntoView([node as SceneNode])
      figma.currentPage.selection = [node as SceneNode]
    }
  }

  if (msg.type === 'apply-change') {
    const node = await figma.getNodeByIdAsync(msg.nodeId)
    if (node && node.type === 'TEXT') {
      try {
        await figma.loadFontAsync(node.fontName as FontName)
        node.characters = msg.newText
      } catch {
        figma.notify(NOTIFY[msg.lang].unsupportedFont, { error: true })
      }
    }
  }

  if (msg.type === 'apply-all') {
    let failed = 0
    for (const change of msg.changes) {
      const node = await figma.getNodeByIdAsync(change.nodeId)
      if (node && node.type === 'TEXT') {
        try {
          await figma.loadFontAsync(node.fontName as FontName)
          node.characters = change.newText
        } catch {
          failed++
        }
      }
    }
    const t = NOTIFY[msg.lang]
    figma.notify(failed > 0 ? t.appliedWithErrors(failed) : t.appliedAll)
  }

}
