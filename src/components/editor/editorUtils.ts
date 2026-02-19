import { foldGutter, syntaxTree } from '@codemirror/language'
import type { EditorState, Extension } from '@codemirror/state'
import { EditorView, highlightActiveLineGutter, lineNumbers } from '@codemirror/view'

import { STATUS_TIMEOUT_MS } from '@/constants/feedback'
import { BYTES_PER_MEGABYTE, IMAGE_POLICY } from '@/constants/file'
import { useEditorStore } from '@/stores/editorStore'
import { useTabStore } from '@/stores/tabStore'
import { getDirectoryPath, joinPath, toPosixPath } from '@/utils/imagePath'
import { invokeTauri, isTauri } from '@/utils/tauri'

// Constants
export const MAX_IMAGE_SIZE = IMAGE_POLICY.maxBytes
const MAX_IMAGE_SIZE_MB = IMAGE_POLICY.maxBytes / BYTES_PER_MEGABYTE
export const supportedImageExtensions = /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)$/i
export const nestedListIndent = '    '
export const orderedListMarkerRegex = /^(\s*)(\d+)([.)])(\s*)/

interface OrderedListItemContext {
  from: number
  to: number
  indentLength: number
  markerWidth: number
}

interface TextChange {
  from: number
  to: number
  insert: string
}

export function getActiveMarkdownFilePath(): string | null {
  const { tabs, activeTabId } = useTabStore.getState()
  const tab = tabs.find(t => t.id === activeTabId)
  return tab?.filePath ?? null
}

export function sanitizeFileName(fileName: string): string {
  const sanitized = fileName.replace(
    /[^a-zA-Z0-9\u00C0-\u024F\uAC00-\uD7AF\u3040-\u30FF\u4E00-\u9FFF._-]/g,
    '-'
  )
  return sanitized || `image-${Date.now()}.png`
}

export function normalizeAltText(fileName: string): string {
  return (fileName.replace(/\.[^.]+$/, '') || 'image').split('[').join('').split(']').join('')
}

export function parseFilePathFromText(text: string): string | null {
  const value = text.trim()
  if (!value) return null

  if (value.startsWith('file://')) {
    try {
      const url = new URL(value)
      if (url.protocol !== 'file:') return null

      let path = decodeURIComponent(url.pathname)
      if (/^\/[A-Za-z]:\//.test(path)) {
        path = path.slice(1)
      }

      if (url.hostname && url.hostname !== 'localhost') {
        return `//${url.hostname}${path}`
      }

      return path
    } catch {
      return null
    }
  }

  if (value.startsWith('/') || value.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(value)) {
    return value
  }

  return null
}

export function isPathInDirectory(filePath: string, directoryPath: string): boolean {
  const path = toPosixPath(filePath)
  const dir = toPosixPath(directoryPath)
  if (!dir) return false
  if (path === dir) return true

  const normalizedDir = dir.endsWith('/') ? dir : `${dir}/`
  return path.startsWith(normalizedDir)
}

export function getMarkdownImagePath(markdownFilePath: string, imageFilePath: string): string {
  const markdownDir = toPosixPath(getDirectoryPath(markdownFilePath))
  const targetPath = toPosixPath(imageFilePath)

  if (isPathInDirectory(targetPath, markdownDir)) {
    const normalizedDir = markdownDir.endsWith('/') ? markdownDir : `${markdownDir}/`
    return `./${encodeURI(targetPath.slice(normalizedDir.length))}`
  }

  return encodeURI(targetPath)
}

export function buildDestinationImagePath(
  markdownFilePath: string,
  fileName: string,
  index: number
): string {
  const markdownDir = getDirectoryPath(markdownFilePath)
  const safeName = sanitizeFileName(fileName)
  const rand = Math.random().toString(36).slice(2, 6)
  const prefixedName = `${Date.now()}-${index + 1}-${rand}-${safeName}`
  return joinPath(markdownDir, prefixedName)
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('FileReader returned non-string result'))
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })
}

export async function toImageMarkdown(
  file: File,
  markdownFilePath: string | null,
  index: number
): Promise<string> {
  const altText = normalizeAltText(file.name)

  if (isTauri()) {
    const sourcePath = getDroppedFilePath(file)

    if (markdownFilePath) {
      try {
        const markdownDir = getDirectoryPath(markdownFilePath)

        if (sourcePath && isPathInDirectory(sourcePath, markdownDir)) {
          const existingPath = getMarkdownImagePath(markdownFilePath, sourcePath)
          return `![${altText}](<${existingPath}>)`
        }

        const destinationPath = buildDestinationImagePath(markdownFilePath, file.name, index)

        if (sourcePath) {
          await invokeTauri('copy_file', {
            srcPath: sourcePath,
            destPath: destinationPath,
          })
        } else {
          if (file.size > MAX_IMAGE_SIZE) {
            const sizeMb = (file.size / BYTES_PER_MEGABYTE).toFixed(1)
            useEditorStore
              .getState()
              .flashStatus(
                `Image too large (${sizeMb}MB, max ${MAX_IMAGE_SIZE_MB}MB)`,
                STATUS_TIMEOUT_MS.warning
              )

            return `<!-- Image "${altText}" skipped: ${sizeMb}MB exceeds ${MAX_IMAGE_SIZE_MB}MB limit -->`
          }
          const data = Array.from(new Uint8Array(await file.arrayBuffer()))
          await invokeTauri('write_binary_file', {
            destPath: destinationPath,
            data,
          })
        }

        const relativePath = getMarkdownImagePath(markdownFilePath, destinationPath)
        return `![${altText}](<${relativePath}>)`
      } catch (error) {
        console.error(
          'Failed to persist dropped image, fallback to source path or data URL:',
          error
        )
      }
    }

    if (sourcePath) {
      return `![${altText}](<${encodeURI(toPosixPath(sourcePath))}>)`
    }
  }

  const dataUrl = await readFileAsDataUrl(file)
  if (isTauri()) {
    useEditorStore
      .getState()
      .flashStatus(
        'Inserted embedded image data (save file first for local image paths)',
        STATUS_TIMEOUT_MS.warning
      )
  }
  return `![${altText}](<${dataUrl}>)`
}

export async function toImageMarkdownFromPath(
  sourcePath: string,
  markdownFilePath: string | null,
  index: number
): Promise<string> {
  const fileName = sourcePath.split(/[/\\]/).pop() ?? `image-${Date.now()}-${index + 1}.png`
  const altText = normalizeAltText(fileName)

  if (isTauri() && markdownFilePath) {
    try {
      const markdownDir = getDirectoryPath(markdownFilePath)

      if (isPathInDirectory(sourcePath, markdownDir)) {
        const existingPath = getMarkdownImagePath(markdownFilePath, sourcePath)
        return `![${altText}](<${existingPath}>)`
      }

      const destinationPath = buildDestinationImagePath(markdownFilePath, fileName, index)
      await invokeTauri('copy_file', {
        srcPath: sourcePath,
        destPath: destinationPath,
      })

      const relativePath = getMarkdownImagePath(markdownFilePath, destinationPath)
      return `![${altText}](<${relativePath}>)`
    } catch (error) {
      console.error('Failed to copy dropped image path:', error)
    }
  }

  return `![${altText}](<${encodeURI(toPosixPath(sourcePath))}>)`
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || supportedImageExtensions.test(file.name)
}

export function hasFileDragType(dataTransfer: DataTransfer): boolean {
  if (dataTransfer.files.length > 0) return true
  return Array.from(dataTransfer.types).some(type => type === 'Files' || type === 'text/uri-list')
}

export function getDroppedFilePath(file: File): string | null {
  const candidate = (file as File & { path?: string }).path
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null
}

export function getDroppedImagePathsFromDataTransfer(dataTransfer: DataTransfer): string[] {
  const paths = new Set<string>()
  const uriList = dataTransfer.getData('text/uri-list')

  for (const line of uriList.split('\n')) {
    const path = parseFilePathFromText(line)
    if (path && supportedImageExtensions.test(path)) {
      paths.add(path)
    }
  }

  const plainText = dataTransfer.getData('text/plain')
  const plainPath = parseFilePathFromText(plainText)
  if (plainPath && supportedImageExtensions.test(plainPath)) {
    paths.add(plainPath)
  }

  return Array.from(paths)
}

export function dispatchImageSnippets(
  view: EditorView,
  snippets: string[],
  insertPos: number,
  expectedTabId: string
) {
  if (snippets.length === 0) return
  if (!view.dom.isConnected) return
  if (useTabStore.getState().activeTabId !== expectedTabId) return

  // Clamp to valid range — doc may have changed during async image processing
  const clampedPos = Math.min(insertPos, view.state.doc.length)

  const before = clampedPos > 0 ? view.state.doc.sliceString(clampedPos - 1, clampedPos) : ''
  const after =
    clampedPos < view.state.doc.length ? view.state.doc.sliceString(clampedPos, clampedPos + 1) : ''
  const prefix = before && before !== '\n' ? '\n' : ''
  const suffix = after && after !== '\n' ? '\n' : ''
  const insertText = `${prefix}${snippets.join('\n\n')}${suffix}`

  view.dispatch({
    changes: { from: clampedPos, to: clampedPos, insert: insertText },
    selection: { anchor: clampedPos + insertText.length },
    scrollIntoView: true,
  })

  const imageWord = snippets.length === 1 ? 'image' : 'images'
  useEditorStore.getState().flashStatus(`Inserted ${snippets.length} ${imageWord}`)
}

export async function insertDroppedImages(view: EditorView, files: File[], insertPos: number) {
  const expectedTabId = useTabStore.getState().activeTabId
  const markdownFilePath = getActiveMarkdownFilePath()
  const snippets = await Promise.all(
    files.map((file, index) => toImageMarkdown(file, markdownFilePath, index))
  )

  dispatchImageSnippets(view, snippets, insertPos, expectedTabId)
}

export async function insertDroppedImagePaths(
  view: EditorView,
  paths: string[],
  insertPos: number
) {
  const expectedTabId = useTabStore.getState().activeTabId
  const markdownFilePath = getActiveMarkdownFilePath()
  const snippets = await Promise.all(
    paths.map((path, index) => toImageMarkdownFromPath(path, markdownFilePath, index))
  )

  dispatchImageSnippets(view, snippets, insertPos, expectedTabId)
}

export function getSpellingContentAttributes(enabled: boolean) {
  return {
    spellcheck: enabled ? 'true' : 'false',
    writingsuggestions: enabled ? 'true' : 'false',
  }
}

export function buildGutterExts(showGutter: boolean): Extension {
  return showGutter ? [lineNumbers(), foldGutter(), highlightActiveLineGutter()] : []
}

export function isInOrderedList(state: EditorState, pos: number): boolean {
  let node = syntaxTree(state).resolve(pos, -1)

  while (node) {
    if (node.type.name === 'FencedCode' || node.type.name === 'InlineCode') {
      return false
    }
    if (node.type.name === 'OrderedList') {
      return true
    }

    const parent = node.parent
    if (!parent) break
    node = parent
  }

  return false
}

function getOrderedListItemContext(state: EditorState, pos: number): OrderedListItemContext | null {
  let node = syntaxTree(state).resolve(pos, -1)

  while (node) {
    if (node.type.name === 'FencedCode' || node.type.name === 'InlineCode') {
      return null
    }

    if (node.type.name === 'ListItem' && node.parent?.type.name === 'OrderedList') {
      const line = state.doc.lineAt(node.from)
      const markerMatch = orderedListMarkerRegex.exec(line.text)
      if (!markerMatch) return null

      const indentLength = markerMatch[1]!.length
      const markerWidth = markerMatch[0].length - indentLength

      return {
        from: node.from,
        to: node.to,
        indentLength,
        markerWidth,
      }
    }

    const parent = node.parent
    if (!parent) break
    node = parent
  }

  return null
}

function getIndentStepFromPreviousSibling(
  state: EditorState,
  selectionPos: number,
  currentIndentLength: number
): number | null {
  const currentItemNode = syntaxTree(state).resolve(selectionPos, -1)
  let node = currentItemNode

  while (!(node.type.name === 'ListItem' && node.parent?.type.name === 'OrderedList')) {
    const parent = node.parent
    if (!parent) return null
    node = parent
  }

  const orderedListNode = node.parent
  if (!orderedListNode) return null

  const siblings = orderedListNode.getChildren('ListItem')
  const index = siblings.findIndex(sibling => sibling.from === node.from && sibling.to === node.to)
  if (index <= 0) return null

  const previousSibling = siblings[index - 1]!
  const nestedOrderedLists = previousSibling.getChildren('OrderedList')

  for (const nestedOrderedList of nestedOrderedLists) {
    const nestedItems = nestedOrderedList.getChildren('ListItem')
    if (nestedItems.length === 0) continue

    const nestedLine = state.doc.lineAt(nestedItems[0]!.from)
    const nestedMatch = orderedListMarkerRegex.exec(nestedLine.text)
    if (!nestedMatch) continue

    const nestedIndentLength = nestedMatch[1]!.length
    if (nestedIndentLength <= currentIndentLength) continue

    return nestedIndentLength - currentIndentLength
  }

  return null
}

function getOutdentStep(
  state: EditorState,
  selectionPos: number,
  currentIndentLength: number
): number {
  const currentItemNode = syntaxTree(state).resolve(selectionPos, -1)
  let node = currentItemNode

  while (!(node.type.name === 'ListItem' && node.parent?.type.name === 'OrderedList')) {
    const parent = node.parent
    if (!parent) return 0
    node = parent
  }

  const parentOrderedList = node.parent
  if (!parentOrderedList) return 0

  const parentListItem = parentOrderedList.parent
  if (!parentListItem || parentListItem.type.name !== 'ListItem') return 0

  const parentLine = state.doc.lineAt(parentListItem.from)
  const parentMatch = orderedListMarkerRegex.exec(parentLine.text)
  const parentIndentLength = parentMatch
    ? parentMatch[1]!.length
    : (parentLine.text.match(/^\s*/)?.[0]?.length ?? 0)

  const step = currentIndentLength - parentIndentLength
  if (step > 0) return step

  return Math.min(nestedListIndent.length, currentIndentLength)
}

function buildIndentedListItemChanges(
  state: EditorState,
  itemRange: OrderedListItemContext,
  indentSize: number
): TextChange[] {
  const changes: TextChange[] = []
  const fromLine = state.doc.lineAt(itemRange.from).number
  const toLine = state.doc.lineAt(Math.max(itemRange.from, itemRange.to - 1)).number

  for (let lineNo = fromLine; lineNo <= toLine; lineNo += 1) {
    const line = state.doc.line(lineNo)
    changes.push({
      from: line.from,
      to: line.from,
      insert: ' '.repeat(indentSize),
    })
  }

  return changes
}

function buildOutdentedListItemChanges(
  state: EditorState,
  itemRange: OrderedListItemContext,
  indentSize: number
): TextChange[] {
  const changes: TextChange[] = []
  const fromLine = state.doc.lineAt(itemRange.from).number
  const toLine = state.doc.lineAt(Math.max(itemRange.from, itemRange.to - 1)).number

  for (let lineNo = fromLine; lineNo <= toLine; lineNo += 1) {
    const line = state.doc.line(lineNo)
    const leadingSpaces = line.text.match(/^\s*/)?.[0] ?? ''
    const removeLength = Math.min(indentSize, leadingSpaces.length)
    if (removeLength === 0) continue

    changes.push({
      from: line.from,
      to: line.from + removeLength,
      insert: '',
    })
  }

  return changes
}

function buildOrderedListRenumberChanges(state: EditorState): TextChange[] {
  const changes: TextChange[] = []
  const tree = syntaxTree(state)

  tree.iterate({
    enter(node) {
      if (node.name !== 'OrderedList') return

      const listItems = node.node.getChildren('ListItem')
      let expectedNumber = 1

      for (const listItem of listItems) {
        const listMark = listItem.getChildren('ListMark')[0]
        if (!listMark) continue

        const markerText = state.sliceDoc(listMark.from, listMark.to)
        const markerMatch = /^(\d+)([.)])$/.exec(markerText)
        if (!markerMatch) continue

        const delimiter = markerMatch[2]!
        const expectedMarker = `${expectedNumber}${delimiter}`

        if (markerText !== expectedMarker) {
          changes.push({
            from: listMark.from,
            to: listMark.to,
            insert: expectedMarker,
          })
        }

        expectedNumber += 1
      }
    },
  })

  return changes
}

function applyOrderedListRenumbering(view: EditorView): void {
  const renumberChanges = buildOrderedListRenumberChanges(view.state)
  if (renumberChanges.length === 0) return

  view.dispatch({ changes: renumberChanges })
}

export function indentOrderedListItem(view: EditorView): boolean {
  const selection = view.state.selection.main
  if (!selection.empty) return false
  const itemContext = getOrderedListItemContext(view.state, selection.from)
  if (!itemContext) return false

  const siblingStep = getIndentStepFromPreviousSibling(
    view.state,
    selection.from,
    itemContext.indentLength
  )
  const indentSize = siblingStep ?? Math.max(1, itemContext.markerWidth)

  const changes = buildIndentedListItemChanges(view.state, itemContext, indentSize)
  if (changes.length === 0) return false

  view.dispatch({ changes })
  applyOrderedListRenumbering(view)

  return true
}

export function outdentOrderedListItem(view: EditorView): boolean {
  const selection = view.state.selection.main
  if (!selection.empty) return false

  const itemContext = getOrderedListItemContext(view.state, selection.from)
  if (!itemContext) return false

  if (itemContext.indentLength === 0) return false

  const outdentSize = getOutdentStep(view.state, selection.from, itemContext.indentLength)
  if (outdentSize === 0) return false

  const changes = buildOutdentedListItemChanges(view.state, itemContext, outdentSize)
  if (changes.length === 0) return false

  view.dispatch({ changes })
  applyOrderedListRenumbering(view)

  return true
}
