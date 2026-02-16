import { foldGutter, syntaxTree } from '@codemirror/language'
import type { EditorState, Extension } from '@codemirror/state'
import { EditorView, highlightActiveLineGutter, lineNumbers } from '@codemirror/view'

import { useEditorStore } from '@/stores/editorStore'
import { useTabStore } from '@/stores/tabStore'
import { getDirectoryPath, joinPath, toPosixPath } from '@/utils/imagePath'
import { isTauri } from '@/utils/tauri'

// Constants
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10 MB
export const supportedImageExtensions = /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)$/i
export const nestedListIndent = '    '
export const orderedListMarkerRegex = /^(\s*)(\d+)([.)])(\s*)/

let tauriInvokePromise: Promise<(typeof import('@tauri-apps/api/core'))['invoke']> | null = null

export async function getTauriInvoke() {
  if (!tauriInvokePromise) {
    tauriInvokePromise = import('@tauri-apps/api/core').then(mod => mod.invoke)
  }

  return tauriInvokePromise
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
        const invoke = await getTauriInvoke()

        if (sourcePath) {
          await invoke('copy_file', {
            srcPath: sourcePath,
            destPath: destinationPath,
          })
        } else {
          if (file.size > MAX_IMAGE_SIZE) {
            const sizeMb = (file.size / 1024 / 1024).toFixed(1)
            useEditorStore.getState().flashStatus(`Image too large (${sizeMb}MB, max 10MB)`, 4000)
            return `<!-- Image "${altText}" skipped: ${sizeMb}MB exceeds 10MB limit -->`
          }
          const data = Array.from(new Uint8Array(await file.arrayBuffer()))
          await invoke('write_binary_file', {
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
      .flashStatus('Inserted embedded image data (save file first for local image paths)', 4000)
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
      const invoke = await getTauriInvoke()

      await invoke('copy_file', {
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

export function indentOrderedListItem(view: EditorView): boolean {
  const selection = view.state.selection.main
  if (!selection.empty) return false
  if (!isInOrderedList(view.state, selection.from)) return false

  const doc = view.state.doc
  const line = doc.lineAt(selection.from)
  const currentMatch = orderedListMarkerRegex.exec(line.text)
  if (!currentMatch) return false

  const currentIndent = currentMatch[1]!
  const currentNumber = Number(currentMatch[2])
  const currentDelimiter = currentMatch[3]!
  const currentSpace = currentMatch[4]!
  if (!Number.isFinite(currentNumber)) return false

  const changes: { from: number; to: number; insert: string }[] = []
  changes.push({
    from: line.from,
    to: line.from + currentMatch[0].length,
    insert: `${currentIndent}${nestedListIndent}1${currentDelimiter}${currentSpace}`,
  })

  let renumber = currentNumber

  for (let lineNo = line.number + 1; lineNo <= doc.lines; lineNo++) {
    const candidate = doc.line(lineNo)
    const text = candidate.text

    if (!text.trim()) break

    const candidateIndent = text.match(/^\s*/)?.[0] ?? ''
    if (candidateIndent.length < currentIndent.length) break

    const siblingMatch = orderedListMarkerRegex.exec(text)
    if (!siblingMatch) continue
    if (siblingMatch[1] !== currentIndent) continue

    changes.push({
      from: candidate.from,
      to: candidate.from + siblingMatch[0].length,
      insert: `${currentIndent}${renumber}${siblingMatch[3]}${siblingMatch[4]}`,
    })
    renumber += 1
  }

  view.dispatch({ changes })
  return true
}
