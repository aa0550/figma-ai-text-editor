/// <reference types="@figma/plugin-typings" />

import type { SummaryItem } from '../shared/types'

figma.showUI(__html__, { width: 480, height: 640, title: 'AI Text Editor' })

function getParentFrame(node: BaseNode): FrameNode | ComponentNode | ComponentSetNode | null {
  let current: BaseNode | null = node.parent
  while (current) {
    if (current.type === 'FRAME' || current.type === 'COMPONENT' || current.type === 'COMPONENT_SET') {
      return current
    }
    current = current.parent
  }
  return null
}

function collectTextNodes(node: SceneNode, results: { id: string; text: string; parentName: string; parentId: string; parentX: number; parentY: number; pageName: string }[], onlyVisible: boolean) {
  if (onlyVisible && !node.visible) return

  if (node.type === 'TEXT') {
    const parentFrame = getParentFrame(node)
    const box = parentFrame?.absoluteBoundingBox
    results.push({
      id: node.id,
      text: node.characters,
      parentName: parentFrame ? parentFrame.name : 'Root',
      parentId: parentFrame ? parentFrame.id : node.id,
      parentX: box ? Math.round(box.x) : 0,
      parentY: box ? Math.round(box.y) : 0,
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
    const nodes: { id: string; text: string; parentName: string; parentId: string; parentX: number; parentY: number; pageName: string }[] = []
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

  if (msg.type === 'insert-summary') {
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
    const node = figma.createText()
    node.fontName = { family: 'Inter', style: 'Regular' }
    node.fontSize = 14

    let text = ''
    const links: { start: number; end: number; nodeId: string }[] = []

    msg.items.forEach((item: SummaryItem, i: number) => {
      const prefix = `${i + 1}. Экран `
      const label = `«${item.parentName}»`
      const suffix = ` (страница «${item.pageName}», x=${item.parentX}, y=${item.parentY})`
      const start = text.length + prefix.length
      links.push({ start, end: start + label.length, nodeId: item.parentId })
      text += `${prefix}${label}${suffix}\nБыло: ${item.original}\nСтало: ${item.suggested}\n${item.reason}`
      if (i < msg.items.length - 1) text += '\n\n'
    })

    node.characters = text
    for (const link of links) {
      node.setRangeHyperlink(link.start, link.end, { type: 'NODE', value: link.nodeId })
    }

    node.textAutoResize = 'HEIGHT'
    node.resize(420, node.height)
    node.x = figma.viewport.center.x - 210
    node.y = figma.viewport.center.y

    figma.currentPage.selection = [node]
    figma.viewport.scrollAndZoomIntoView([node])
    figma.notify('Саммари вставлено на страницу ✓')
  }
}
