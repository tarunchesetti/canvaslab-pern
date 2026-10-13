import assert from 'node:assert/strict'
import test from 'node:test'
import * as Y from 'yjs'
import { readNodesFromDocument, syncNodesToDocument, type CanvasDocumentNode } from './collaboration-state.js'

const initialNode: CanvasDocumentNode = {
  id: 'note-1',
  type: 'note',
  position: { x: 100, y: 150 },
  data: { title: 'Shared idea', text: 'idea' },
}

test('an empty board has a valid Yjs snapshot', () => {
  const source = new Y.Doc()
  const snapshot = Y.encodeStateAsUpdate(source)
  const restored = new Y.Doc()

  assert.doesNotThrow(() => Y.applyUpdate(restored, snapshot))
  assert.equal(restored.getMap('nodes').size, 0)
})

test('concurrent text insertions merge and node properties round-trip', () => {
  const firstDocument = new Y.Doc()
  const firstNodes = firstDocument.getMap<Y.Map<unknown>>('nodes')
  syncNodesToDocument(firstDocument, firstNodes, [initialNode])

  const secondDocument = new Y.Doc()
  Y.applyUpdate(secondDocument, Y.encodeStateAsUpdate(firstDocument))
  const secondNodes = secondDocument.getMap<Y.Map<unknown>>('nodes')
  const firstState = Y.encodeStateVector(firstDocument)
  const secondState = Y.encodeStateVector(secondDocument)

  syncNodesToDocument(firstDocument, firstNodes, [{
    ...initialNode,
    position: { x: 240, y: 150 },
    data: { ...initialNode.data, text: 'idea from A' },
  }])
  syncNodesToDocument(secondDocument, secondNodes, [{
    ...initialNode,
    position: { x: 100, y: 220 },
    data: { ...initialNode.data, text: 'idea from B' },
  }])

  const updateFromFirst = Y.encodeStateAsUpdate(firstDocument, secondState)
  const updateFromSecond = Y.encodeStateAsUpdate(secondDocument, firstState)
  Y.applyUpdate(firstDocument, updateFromSecond)
  Y.applyUpdate(secondDocument, updateFromFirst)

  const firstResult = readNodesFromDocument(firstNodes)[0]!
  const secondResult = readNodesFromDocument(secondNodes)[0]!
  assert.equal(firstResult.data.text, secondResult.data.text)
  assert.match(firstResult.data.text, /from A/)
  assert.match(firstResult.data.text, /from B/)
  assert.equal(firstResult.position.x, 240)
  assert.equal(secondResult.position.y, 220)
})

test('code language and node dimensions round-trip through the shared document', () => {
  const document = new Y.Doc()
  const nodes = document.getMap<Y.Map<unknown>>('nodes')
  syncNodesToDocument(document, nodes, [{
    ...initialNode,
    type: 'code',
    position: { x: 20, y: 30 },
    data: { title: 'example.js', text: 'const answer = 42', language: 'javascript', width: 420, height: 260 },
  }])
  const restored = readNodesFromDocument(nodes)[0]!
  assert.equal(restored.data.language, 'javascript')
  assert.equal(restored.data.width, 420)
  assert.equal(restored.data.height, 260)
})

test('two collaborators converge after exchanging updates and reconnect from a snapshot', () => {
  const host = new Y.Doc()
  const hostNodes = host.getMap<Y.Map<unknown>>('nodes')
  syncNodesToDocument(host, hostNodes, [initialNode])

  const collaborator = new Y.Doc()
  Y.applyUpdate(collaborator, Y.encodeStateAsUpdate(host))
  const collaboratorNodes = collaborator.getMap<Y.Map<unknown>>('nodes')

  syncNodesToDocument(host, hostNodes, [{
    ...initialNode,
    data: { ...initialNode.data, text: 'edited by host' },
  }])
  syncNodesToDocument(collaborator, collaboratorNodes, [{
    ...initialNode,
    data: { ...initialNode.data, text: 'edited by collaborator' },
  }])

  const hostUpdate = Y.encodeStateAsUpdate(host, Y.encodeStateVector(collaborator))
  const collaboratorUpdate = Y.encodeStateAsUpdate(collaborator, Y.encodeStateVector(host))
  Y.applyUpdate(host, collaboratorUpdate)
  Y.applyUpdate(collaborator, hostUpdate)

  assert.deepEqual(readNodesFromDocument(hostNodes), readNodesFromDocument(collaboratorNodes))

  const reconnectingClient = new Y.Doc()
  Y.applyUpdate(reconnectingClient, Y.encodeStateAsUpdate(host))
  assert.deepEqual(
    readNodesFromDocument(reconnectingClient.getMap<Y.Map<unknown>>('nodes')),
    readNodesFromDocument(hostNodes),
  )
})

test('shape and drawing properties survive a saved-document restore', () => {
  const source = new Y.Doc()
  const sourceNodes = source.getMap<Y.Map<unknown>>('nodes')
  syncNodesToDocument(source, sourceNodes, [
    {
      id: 'shape-1',
      type: 'shape',
      position: { x: 180, y: 240 },
      data: {
        title: 'Decision',
        text: 'Continue?',
        shape: 'diamond',
        width: 210,
        height: 130,
        backgroundColor: '#e4ebff',
        textColor: '#27314a',
        fontSize: 18,
        bold: true,
      },
    },
    {
      id: 'drawing-1',
      type: 'drawing',
      position: { x: 40, y: 60 },
      data: {
        title: 'Freehand drawing',
        text: '',
        path: 'M 0 0 L 20 30 L 45 10',
        strokeColor: '#26352a',
        strokeWidth: 5,
        strokeOpacity: 0.45,
        width: 50,
        height: 35,
      },
    },
  ])

  const restored = new Y.Doc()
  Y.applyUpdate(restored, Y.encodeStateAsUpdate(source))
  const restoredNodes = readNodesFromDocument(restored.getMap<Y.Map<unknown>>('nodes'))

  assert.deepEqual(restoredNodes.find((node) => node.id === 'shape-1'), {
    id: 'shape-1',
    type: 'shape',
    position: { x: 180, y: 240 },
    data: {
      title: 'Decision',
      text: 'Continue?',
      width: 210,
      height: 130,
      backgroundColor: '#e4ebff',
      textColor: '#27314a',
      fontSize: 18,
      bold: true,
      shape: 'diamond',
    },
  })
  assert.deepEqual(restoredNodes.find((node) => node.id === 'drawing-1'), {
    id: 'drawing-1',
    type: 'drawing',
    position: { x: 40, y: 60 },
    data: {
      title: 'Freehand drawing',
      text: '',
      width: 50,
      height: 35,
      shape: undefined,
      path: 'M 0 0 L 20 30 L 45 10',
      strokeColor: '#26352a',
      strokeWidth: 5,
      strokeOpacity: 0.45,
    },
  })
})

test('deleting a canvas node removes it from the shared document', () => {
  const document = new Y.Doc()
  const nodes = document.getMap<Y.Map<unknown>>('nodes')
  const secondNode: CanvasDocumentNode = {
    id: 'note-2',
    type: 'note',
    position: { x: 260, y: 150 },
    data: { title: 'Keep this', text: 'Still here' },
  }

  syncNodesToDocument(document, nodes, [initialNode, secondNode])
  syncNodesToDocument(document, nodes, [secondNode])

  assert.deepEqual(readNodesFromDocument(nodes), [secondNode])
})

