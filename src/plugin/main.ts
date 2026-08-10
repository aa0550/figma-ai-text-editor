/// <reference types="@figma/plugin-typings" />

figma.showUI(__html__, { width: 480, height: 640, title: 'AI Tone Editor' })

function getParentFrame(node: BaseNode): BaseNode | null {
  let current: BaseNode | null = node.parent
  while (current) {
    if (current.type === 'FRAME' || current.type === 'COMPONENT' || current.type === 'COMPONENT_SET') {
      return current
    }
    current = current.parent
  }
  return null
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

const STORAGE_KEYS = { rules: 'ux-editor-rules', apiKey: 'ux-editor-api-key' } as const

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'load-storage') {
    const [rules, apiKey] = await Promise.all([
      figma.clientStorage.getAsync(STORAGE_KEYS.rules),
      figma.clientStorage.getAsync(STORAGE_KEYS.apiKey),
    ])
    figma.ui.postMessage({ type: 'storage-data', rules: rules ?? '', apiKey: apiKey ?? '' })
  }

  if (msg.type === 'save-storage') {
    const key = msg.key as keyof typeof STORAGE_KEYS
    await figma.clientStorage.setAsync(STORAGE_KEYS[key], msg.value)
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
        figma.notify('Не удалось применить изменение: неподдерживаемый шрифт', { error: true })
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
    figma.notify(failed > 0 ? `Применено с ошибками: ${failed} узлов пропущено` : 'Все изменения применены ✓')
  }

  if (msg.type === 'get-file-key') {
    figma.ui.postMessage({ type: 'file-key', key: figma.fileKey ?? null })
  }
}
