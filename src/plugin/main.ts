/// <reference types="@figma/plugin-typings" />

figma.showUI(__html__, { width: 480, height: 640, title: 'UX Text Editor' })

function getParentFrameName(node: BaseNode): string {
  let current: BaseNode | null = node.parent
  while (current) {
    if (current.type === 'FRAME' || current.type === 'COMPONENT' || current.type === 'COMPONENT_SET') {
      return current.name
    }
    current = current.parent
  }
  return 'Root'
}

function collectTextNodes(node: SceneNode, results: { id: string; text: string; parentName: string; pageName: string }[]) {
  if (node.type === 'TEXT') {
    results.push({
      id: node.id,
      text: node.characters,
      parentName: getParentFrameName(node),
      pageName: figma.currentPage.name,
    })
  }
  if ('children' in node) {
    for (const child of node.children) {
      collectTextNodes(child, results)
    }
  }
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'start-scan') {
    const nodes: { id: string; text: string; parentName: string; pageName: string }[] = []
    for (const node of figma.currentPage.children) {
      collectTextNodes(node, nodes)
    }
    figma.ui.postMessage({ type: 'scan-complete', nodes })
  }

  if (msg.type === 'navigate-to-node') {
    const node = figma.getNodeById(msg.nodeId)
    if (node && node.type !== 'DOCUMENT' && node.type !== 'PAGE') {
      figma.viewport.scrollAndZoomIntoView([node as SceneNode])
      figma.currentPage.selection = [node as SceneNode]
    }
  }

  if (msg.type === 'apply-change') {
    const node = figma.getNodeById(msg.nodeId)
    if (node && node.type === 'TEXT') {
      await figma.loadFontAsync(node.fontName as FontName)
      node.characters = msg.newText
    }
  }

  if (msg.type === 'apply-all') {
    for (const change of msg.changes) {
      const node = figma.getNodeById(change.nodeId)
      if (node && node.type === 'TEXT') {
        await figma.loadFontAsync(node.fontName as FontName)
        node.characters = change.newText
      }
    }
    figma.notify('Все изменения применены ✓')
  }

  if (msg.type === 'get-file-key') {
    figma.ui.postMessage({ type: 'file-key', key: figma.fileKey ?? null })
  }
}
