import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, foldGutter, indentOnInput, syntaxTree } from '@codemirror/language'
import { search } from '@codemirror/search'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { memo, useEffect, useRef } from 'react'

import { useEditorView } from '@/contexts/EditorViewContext'
import { useEditorStore } from '@/stores/editorStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useSidebarStore } from '@/stores/sidebarStore'
import { useTabStore } from '@/stores/tabStore'
import { isTauri } from '@/utils/tauri'

import { focusExtension } from './extensions/focus'
import { markdownExtension } from './extensions/markdown'
import { boltdownDarkTheme, boltdownTheme } from './extensions/theme'
import { typewriterExtension } from './extensions/typewriter'
import { wysiwygExtension } from './extensions/wysiwyg'

function buildGutterExts(showGutter: boolean): Extension {
  return showGutter ? [lineNumbers(), foldGutter(), highlightActiveLineGutter()] : []
}

function getSpellingContentAttributes(enabled: boolean) {
  return {
    spellcheck: enabled ? 'true' : 'false',
    writingsuggestions: enabled ? 'true' : 'false',
  }
}

const orderedListMarkerRegex = /^(\s*)(\d+)([.)])(\s*)/
const nestedListIndent = '    '
const supportedImageExtensions = /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)$/i

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || supportedImageExtensions.test(file.name)
}

function sanitizeFileName(fileName: string): string {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '-')
  return sanitized || `image-${Date.now()}.png`
}

function getDirectoryPath(filePath: string): string {
  const slash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  if (slash === -1) return ''
  if (slash === 0) return filePath[0]!
  return filePath.slice(0, slash)
}

function joinPath(dir: string, name: string): string {
  if (!dir) return name
  const separator = dir.includes('\\') ? '\\' : '/'
  const needsSeparator = !dir.endsWith('/') && !dir.endsWith('\\')
  return `${dir}${needsSeparator ? separator : ''}${name}`
}

function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/')
}

function isPathInDirectory(filePath: string, directoryPath: string): boolean {
  const path = toPosixPath(filePath)
  const dir = toPosixPath(directoryPath)
  if (!dir) return false
  if (path === dir) return true

  const normalizedDir = dir.endsWith('/') ? dir : `${dir}/`
  return path.startsWith(normalizedDir)
}

function buildDestinationImagePath(
  markdownFilePath: string,
  fileName: string,
  index: number
): string {
  const markdownDir = getDirectoryPath(markdownFilePath)
  const safeName = sanitizeFileName(fileName)
  const prefixedName = `${Date.now()}-${index + 1}-${safeName}`
  return joinPath(markdownDir, prefixedName)
}

function getMarkdownImagePath(markdownFilePath: string, imageFilePath: string): string {
  const markdownDir = toPosixPath(getDirectoryPath(markdownFilePath))
  const targetPath = toPosixPath(imageFilePath)

  if (isPathInDirectory(targetPath, markdownDir)) {
    const normalizedDir = markdownDir.endsWith('/') ? markdownDir : `${markdownDir}/`
    return `./${encodeURI(targetPath.slice(normalizedDir.length))}`
  }

  return encodeURI(targetPath)
}

function readFileAsDataUrl(file: File): Promise<string> {
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

function getDroppedFilePath(file: File): string | null {
  const candidate = (file as File & { path?: string }).path
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null
}

function hasFileDragType(dataTransfer: DataTransfer): boolean {
  if (dataTransfer.files.length > 0) return true
  return Array.from(dataTransfer.types).some(type => type === 'Files' || type === 'text/uri-list')
}

function normalizeAltText(fileName: string): string {
  return (fileName.replace(/\.[^.]+$/, '') || 'image').split('[').join('').split(']').join('')
}

function parseFilePathFromText(text: string): string | null {
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

function getDroppedImagePathsFromDataTransfer(dataTransfer: DataTransfer): string[] {
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

function getFileNameFromPath(filePath: string): string {
  return filePath.split(/[/\\]/).pop() ?? filePath
}

async function ensureMarkdownPathForImageInsert(): Promise<string | null> {
  if (!isTauri()) return null

  const { tabs, activeTabId, renameTab, markClean } = useTabStore.getState()
  const tab = tabs.find(t => t.id === activeTabId)
  if (!tab) return null
  if (tab.filePath) return tab.filePath

  try {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const path = await save({
      filters: [{ name: 'Markdown', extensions: ['md'] }],
      defaultPath: tab.fileName,
    })
    if (!path) return null

    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('write_file', { path, content: tab.content })

    const fileName = getFileNameFromPath(path)
    renameTab(activeTabId, fileName, path)
    markClean(activeTabId, tab.content)

    const sidebarStore = useSidebarStore.getState()
    sidebarStore.addRecentFile(path, fileName)
    await sidebarStore.loadParentDirectory(path, true)

    useEditorStore.getState().flashStatus('Saved current file to insert local image paths', 3000)
    return path
  } catch (error) {
    console.error('Failed to save markdown file before image insert:', error)
    useEditorStore
      .getState()
      .flashStatus('Image insert fallback: could not save current file', 4000)
    return null
  }
}

async function toImageMarkdown(
  file: File,
  markdownFilePath: string | null,
  index: number
): Promise<string> {
  const altText = normalizeAltText(file.name)
  const sourcePath = isTauri() ? getDroppedFilePath(file) : null

  if (isTauri()) {
    if (markdownFilePath) {
      try {
        const markdownDir = getDirectoryPath(markdownFilePath)

        if (sourcePath && isPathInDirectory(sourcePath, markdownDir)) {
          const existingPath = getMarkdownImagePath(markdownFilePath, sourcePath)
          return `![${altText}](<${existingPath}>)`
        }

        const destinationPath = buildDestinationImagePath(markdownFilePath, file.name, index)
        const { invoke } = await import('@tauri-apps/api/core')

        if (sourcePath) {
          await invoke('copy_file', {
            srcPath: sourcePath,
            destPath: destinationPath,
          })
        } else {
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

async function toImageMarkdownFromPath(
  sourcePath: string,
  markdownFilePath: string | null,
  index: number
) {
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
      const { invoke } = await import('@tauri-apps/api/core')

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

function dispatchImageSnippets(view: EditorView, snippets: string[], insertPos: number) {
  if (snippets.length === 0) return

  const before = insertPos > 0 ? view.state.doc.sliceString(insertPos - 1, insertPos) : ''
  const after =
    insertPos < view.state.doc.length ? view.state.doc.sliceString(insertPos, insertPos + 1) : ''
  const prefix = before && before !== '\n' ? '\n' : ''
  const suffix = after && after !== '\n' ? '\n' : ''
  const insertText = `${prefix}${snippets.join('\n\n')}${suffix}`

  view.dispatch({
    changes: { from: insertPos, to: insertPos, insert: insertText },
    selection: { anchor: insertPos + insertText.length },
    scrollIntoView: true,
  })

  const imageWord = snippets.length === 1 ? 'image' : 'images'
  useEditorStore.getState().flashStatus(`Inserted ${snippets.length} ${imageWord}`)
}

async function insertDroppedImages(view: EditorView, files: File[], insertPos: number) {
  const markdownFilePath = await ensureMarkdownPathForImageInsert()
  const snippets: string[] = []

  for (const [index, file] of files.entries()) {
    snippets.push(await toImageMarkdown(file, markdownFilePath, index))
  }

  dispatchImageSnippets(view, snippets, insertPos)
}

async function insertDroppedImagePaths(view: EditorView, paths: string[], insertPos: number) {
  const markdownFilePath = await ensureMarkdownPathForImageInsert()
  const snippets: string[] = []

  for (const [index, path] of paths.entries()) {
    snippets.push(await toImageMarkdownFromPath(path, markdownFilePath, index))
  }

  dispatchImageSnippets(view, snippets, insertPos)
}

function isInOrderedList(state: EditorState, pos: number): boolean {
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

function indentOrderedListItem(view: EditorView): boolean {
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

export default memo(function MarkdownEditor() {
  const mode = useEditorStore(s => s.mode)
  const themeMode = useSettingsStore(s => s.settings.theme.mode)
  const isDark =
    themeMode === 'dark' ||
    (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const editorViewRef = useEditorView()

  const focusMode = useSettingsStore(s => s.settings.editor.focusMode)
  const focusContextLines = useSettingsStore(s => s.settings.editor.focusContextLines)
  const spellcheck = useSettingsStore(s => s.settings.editor.spellcheck)
  const typewriterMode = useSettingsStore(s => s.settings.editor.typewriterMode)
  const mermaidSecurityLevel = useSettingsStore(s => s.settings.preview.mermaidSecurityLevel)

  const activeTabId = useTabStore(s => s.activeTabId)
  const updateContent = useTabStore(s => s.updateContent)

  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const stateCacheRef = useRef(new Map<string, EditorState>())
  const prevTabIdRef = useRef<string | null>(null)
  const activeTabIdRef = useRef(activeTabId)

  // Instance-level compartments (not module-level singletons)
  const themeCompRef = useRef(new Compartment())
  const wysiwygCompRef = useRef(new Compartment())
  const gutterCompRef = useRef(new Compartment())
  const focusCompRef = useRef(new Compartment())
  const spellcheckCompRef = useRef(new Compartment())
  const typewriterCompRef = useRef(new Compartment())

  activeTabIdRef.current = activeTabId

  // Build extensions array with current compartment state
  const buildExtensions = (): Extension[] => [
    markdownExtension(),
    themeCompRef.current.of(isDark ? boltdownDarkTheme : boltdownTheme),
    wysiwygCompRef.current.of(mode === 'zen' ? wysiwygExtension(mermaidSecurityLevel) : []),
    gutterCompRef.current.of(buildGutterExts(mode !== 'zen')),
    focusCompRef.current.of(focusMode ? focusExtension(focusContextLines) : []),
    spellcheckCompRef.current.of(
      EditorView.contentAttributes.of(getSpellingContentAttributes(spellcheck))
    ),
    typewriterCompRef.current.of(typewriterMode ? typewriterExtension() : []),
    history(),
    search(),
    bracketMatching(),
    indentOnInput(),
    highlightActiveLine(),
    EditorView.lineWrapping,
    keymap.of([
      { key: 'Tab', run: indentOrderedListItem },
      ...defaultKeymap,
      ...historyKeymap,
      indentWithTab,
    ]),
    EditorView.updateListener.of(update => {
      if (update.docChanged) {
        updateContent(activeTabIdRef.current, update.state.doc.toString())
      }
    }),
  ]

  // Create EditorView once on mount
  useEffect(() => {
    if (!containerRef.current) return

    const activeTab = useTabStore
      .getState()
      .tabs.find(t => t.id === useTabStore.getState().activeTabId)

    const extensions = buildExtensions()
    const state = EditorState.create({ doc: activeTab?.content ?? '', extensions })
    const view = new EditorView({ state, parent: containerRef.current })

    const handleDragOver = (event: DragEvent) => {
      const dataTransfer = event.dataTransfer
      if (!dataTransfer || !hasFileDragType(dataTransfer)) return

      event.preventDefault()
      dataTransfer.dropEffect = 'copy'
    }

    const handleDrop = (event: DragEvent) => {
      const dataTransfer = event.dataTransfer
      if (!dataTransfer || !hasFileDragType(dataTransfer)) return

      event.preventDefault()

      const insertPos =
        view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.head

      const imageFiles = Array.from(dataTransfer.files).filter(isImageFile)
      const imagePaths = getDroppedImagePathsFromDataTransfer(dataTransfer)
      if (imagePaths.length > 0) {
        void insertDroppedImagePaths(view, imagePaths, insertPos)
        return
      }

      if (imageFiles.length > 0) {
        void insertDroppedImages(view, imageFiles, insertPos)
        return
      }

      useEditorStore.getState().flashStatus('Only image files are supported', 3000)
    }

    view.dom.addEventListener('dragover', handleDragOver)
    view.dom.addEventListener('drop', handleDrop)

    viewRef.current = view
    editorViewRef.current = view
    prevTabIdRef.current = activeTabId

    return () => {
      view.dom.removeEventListener('dragover', handleDragOver)
      view.dom.removeEventListener('drop', handleDrop)
      view.destroy()
      viewRef.current = null
      editorViewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tab switching — save/restore EditorState
  useEffect(() => {
    const view = viewRef.current
    if (!view || prevTabIdRef.current === activeTabId) return

    // Save current tab's EditorState (includes undo history, cursor, scroll)
    if (prevTabIdRef.current) {
      stateCacheRef.current.set(prevTabIdRef.current, view.state)
    }

    // Restore cached state or create fresh for new tab
    const cached = stateCacheRef.current.get(activeTabId)
    if (cached) {
      view.setState(cached)
      // Re-apply current compartment configs after restore
      view.dispatch({
        effects: [
          themeCompRef.current.reconfigure(isDark ? boltdownDarkTheme : boltdownTheme),
          wysiwygCompRef.current.reconfigure(
            mode === 'zen' ? wysiwygExtension(mermaidSecurityLevel) : []
          ),
          gutterCompRef.current.reconfigure(buildGutterExts(mode !== 'zen')),
          focusCompRef.current.reconfigure(focusMode ? focusExtension(focusContextLines) : []),
          spellcheckCompRef.current.reconfigure(
            EditorView.contentAttributes.of(getSpellingContentAttributes(spellcheck))
          ),
          typewriterCompRef.current.reconfigure(typewriterMode ? typewriterExtension() : []),
        ],
      })
    } else {
      const activeTab = useTabStore.getState().tabs.find(t => t.id === activeTabId)
      view.setState(
        EditorState.create({
          doc: activeTab?.content ?? '',
          extensions: buildExtensions(),
        })
      )
    }

    prevTabIdRef.current = activeTabId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId])

  // Clean up state cache when tabs are closed
  useEffect(() => {
    const unsub = useTabStore.subscribe((state, prev) => {
      if (state.tabs.length < prev.tabs.length) {
        const currentIds = new Set(state.tabs.map(t => t.id))
        for (const key of stateCacheRef.current.keys()) {
          if (!currentIds.has(key)) stateCacheRef.current.delete(key)
        }
      }
    })
    return unsub
  }, [])

  // Theme reconfiguration
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: themeCompRef.current.reconfigure(isDark ? boltdownDarkTheme : boltdownTheme),
    })
  }, [isDark])

  // Mode reconfiguration (wysiwyg + gutters)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: [
        wysiwygCompRef.current.reconfigure(
          mode === 'zen' ? wysiwygExtension(mermaidSecurityLevel) : []
        ),
        gutterCompRef.current.reconfigure(buildGutterExts(mode !== 'zen')),
      ],
    })
  }, [mode, mermaidSecurityLevel])

  // Focus, Spellcheck, and Typewriter mode reconfiguration
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: [
        focusCompRef.current.reconfigure(focusMode ? focusExtension(focusContextLines) : []),
        spellcheckCompRef.current.reconfigure(
          EditorView.contentAttributes.of(getSpellingContentAttributes(spellcheck))
        ),
        typewriterCompRef.current.reconfigure(typewriterMode ? typewriterExtension() : []),
      ],
    })
  }, [focusMode, focusContextLines, spellcheck, typewriterMode])

  return <div ref={containerRef} className="h-full [&_.cm-editor]:h-full" />
})
