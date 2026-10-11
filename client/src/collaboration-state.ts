import * as Y from 'yjs'

export interface CanvasDocumentNode {
  id: string
  type?: string
  position: { x: number; y: number }
  data: { title: string; text: string; tone?: string; width?: number; height?: number; language?: 'typescript' | 'javascript' }
}

function nestedMap(parent: Y.Map<unknown>, key: string): Y.Map<unknown> {
  const value = parent.get(key)
  if (value instanceof Y.Map) return value
  const map = new Y.Map<unknown>()
  parent.set(key, map)
  return map
}

function setIfChanged(map: Y.Map<unknown>, key: string, value: unknown) {
  if (map.get(key) !== value) map.set(key, value)
}

function updateText(text: Y.Text, nextValue: string) {
  const currentValue = text.toString()
  if (currentValue === nextValue) return

  let prefixLength = 0
  while (prefixLength < currentValue.length && prefixLength < nextValue.length && currentValue[prefixLength] === nextValue[prefixLength]) {
    prefixLength += 1
  }

  let suffixLength = 0
  while (
    suffixLength < currentValue.length - prefixLength
    && suffixLength < nextValue.length - prefixLength
    && currentValue[currentValue.length - 1 - suffixLength] === nextValue[nextValue.length - 1 - suffixLength]
  ) {
    suffixLength += 1
  }

  const deleteLength = currentValue.length - prefixLength - suffixLength
  if (deleteLength > 0) text.delete(prefixLength, deleteLength)

  const insertValue = nextValue.slice(prefixLength, nextValue.length - suffixLength)
  if (insertValue) text.insert(prefixLength, insertValue)
}

function updateSharedNode(record: Y.Map<unknown>, node: CanvasDocumentNode) {
  setIfChanged(record, 'type', node.type ?? 'note')

  const position = nestedMap(record, 'position')
  setIfChanged(position, 'x', node.position.x)
  setIfChanged(position, 'y', node.position.y)

  const data = nestedMap(record, 'data')
  setIfChanged(data, 'title', node.data.title)
  if (node.data.tone) setIfChanged(data, 'tone', node.data.tone)
  else if (data.has('tone')) data.delete('tone')
  if (node.data.width !== undefined) setIfChanged(data, 'width', node.data.width)
  else if (data.has('width')) data.delete('width')
  if (node.data.height !== undefined) setIfChanged(data, 'height', node.data.height)
  else if (data.has('height')) data.delete('height')
  if (node.data.language) setIfChanged(data, 'language', node.data.language)
  else if (data.has('language')) data.delete('language')

  const sharedText = data.get('text')
  if (sharedText instanceof Y.Text) {
    updateText(sharedText, node.data.text)
  } else {
    const text = new Y.Text()
    if (node.data.text) text.insert(0, node.data.text)
    data.set('text', text)
  }
}

export function syncNodesToDocument(
  document: Y.Doc,
  sharedNodes: Y.Map<Y.Map<unknown>>,
  nodes: CanvasDocumentNode[],
) {
  document.transact(() => {
    const nodeIds = new Set(nodes.map((node) => node.id))
    for (const id of sharedNodes.keys()) {
      if (!nodeIds.has(id)) sharedNodes.delete(id)
    }

    for (const node of nodes) {
      let sharedNode = sharedNodes.get(node.id)
      if (!sharedNode) {
        sharedNode = new Y.Map<unknown>()
        sharedNodes.set(node.id, sharedNode)
      }
      updateSharedNode(sharedNode, node)
    }
  })
}

export function readNodesFromDocument(sharedNodes: Y.Map<Y.Map<unknown>>): CanvasDocumentNode[] {
  const nodes: CanvasDocumentNode[] = []

  sharedNodes.forEach((record, id) => {
    const position = record.get('position')
    const data = record.get('data')
    if (!(position instanceof Y.Map) || !(data instanceof Y.Map)) return

    const sharedText = data.get('text')
    nodes.push({
      id,
      type: String(record.get('type') ?? 'note'),
      position: {
        x: Number(position.get('x') ?? 0),
        y: Number(position.get('y') ?? 0),
      },
      data: {
        title: String(data.get('title') ?? 'Untitled'),
        text: sharedText instanceof Y.Text ? sharedText.toString() : String(sharedText ?? ''),
        ...(typeof data.get('tone') === 'string' ? { tone: data.get('tone') as string } : {}),
        ...(typeof data.get('width') === 'number' ? { width: data.get('width') as number } : {}),
        ...(typeof data.get('height') === 'number' ? { height: data.get('height') as number } : {}),
        ...(data.get('language') === 'javascript' || data.get('language') === 'typescript' ? { language: data.get('language') as 'javascript' | 'typescript' } : {}),
      },
    })
  })

  return nodes
}

export function canvasNodeSignature(nodes: CanvasDocumentNode[]): string {
  return JSON.stringify(nodes
    .map(({ id, type, position, data }) => ({ id, type: type ?? 'note', position, data }))
    .sort((first, second) => first.id.localeCompare(second.id)))
}
