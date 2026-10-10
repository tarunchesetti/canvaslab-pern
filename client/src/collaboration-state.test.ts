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
