import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, indentOnInput } from '@codemirror/language'
import { search } from '@codemirror/search'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { EditorView, highlightActiveLine, keymap } from '@codemirror/view'
import { memo, useCallback, useEffect, useRef, useState } from 'react'

import { STATUS_TIMEOUT_MS } from '@/constants/feedback'
import { MEDIA_QUERIES } from '@/constants/storage'
import { useEditorView } from '@/contexts/EditorViewContext'
import { useEditorStore } from '@/stores/editorStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTabStore } from '@/stores/tabStore'
import type { MermaidSecurityLevel } from '@/types/settings'
import { isTauri } from '@/utils/tauri'

import {
  buildGutterExts,
  getDroppedImagePathsFromDataTransfer,
  getSpellingContentAttributes,
  hasFileDragType,
  indentOrderedListItem,
  insertDroppedImagePaths,
  insertDroppedImages,
  isImageFile,
  outdentOrderedListItem,
  supportedImageExtensions,
} from './editorUtils'
import { fenceLanguageCompletion } from './extensions/fenceLanguageCompletion'
import { focusExtension } from './extensions/focus'
import { markdownExtension } from './extensions/markdown'
import { boltdownDarkTheme, boltdownTheme } from './extensions/theme'
import { typewriterExtension } from './extensions/typewriter'
import { formattingKeymap } from './formatCommands'

// Module-level cache for lazy-loaded wysiwyg extension
let cachedWysiwygFn: ((level: MermaidSecurityLevel) => Extension) | null = null

export default memo(function MarkdownEditor() {
  const mode = useEditorStore(s => s.mode)
  const themeMode = useSettingsStore(s => s.settings.theme.mode)
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia(MEDIA_QUERIES.prefersDark).matches
  )
  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemDark)
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

  const isWysiwyg = mode === 'live' || mode === 'zen'

  // Lazy-load wysiwyg extension when Live/Zen mode is first activated
  useEffect(() => {
    if (!isWysiwyg || cachedWysiwygFn) return
    void import('./extensions/wysiwyg').then(mod => {
      cachedWysiwygFn = mod.wysiwygExtension
      const view = viewRef.current
      if (view) {
        view.dispatch({
          effects: wysiwygCompRef.current.reconfigure(mod.wysiwygExtension(mermaidSecurityLevel)),
        })
      }
    })
  }, [isWysiwyg, mermaidSecurityLevel])

  useEffect(() => {
    const media = window.matchMedia(MEDIA_QUERIES.prefersDark)
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemDark(event.matches)
    }
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  const buildReconfigureEffects = useCallback(
    () => [
      themeCompRef.current.reconfigure(isDark ? boltdownDarkTheme : boltdownTheme),
      wysiwygCompRef.current.reconfigure(
        isWysiwyg && cachedWysiwygFn ? cachedWysiwygFn(mermaidSecurityLevel) : []
      ),
      gutterCompRef.current.reconfigure(buildGutterExts(true)),
      focusCompRef.current.reconfigure(focusMode ? focusExtension(focusContextLines) : []),
      spellcheckCompRef.current.reconfigure(
        EditorView.contentAttributes.of(getSpellingContentAttributes(spellcheck))
      ),
      typewriterCompRef.current.reconfigure(typewriterMode ? typewriterExtension() : []),
    ],
    [
      focusContextLines,
      focusMode,
      isDark,
      isWysiwyg,
      mermaidSecurityLevel,
      spellcheck,
      typewriterMode,
    ]
  )

  // Build extensions array with current compartment state
  const buildExtensions = (): Extension[] => [
    markdownExtension(),
    themeCompRef.current.of(isDark ? boltdownDarkTheme : boltdownTheme),
    wysiwygCompRef.current.of(
      isWysiwyg && cachedWysiwygFn ? cachedWysiwygFn(mermaidSecurityLevel) : []
    ),
    gutterCompRef.current.of(buildGutterExts(true)),
    focusCompRef.current.of(focusMode ? focusExtension(focusContextLines) : []),
    spellcheckCompRef.current.of(
      EditorView.contentAttributes.of(getSpellingContentAttributes(spellcheck))
    ),
    typewriterCompRef.current.of(typewriterMode ? typewriterExtension() : []),
    fenceLanguageCompletion(),
    history(),
    search(),
    bracketMatching(),
    indentOnInput(),
    highlightActiveLine(),
    EditorView.lineWrapping,
    keymap.of([
      ...formattingKeymap,
      { key: 'Tab', run: indentOrderedListItem },
      { key: 'Shift-Tab', run: outdentOrderedListItem },
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

    // --- Drag-drop setup ---
    let unlistenTauriDrop: (() => void) | null = null
    let htmlDndCleanup: (() => void) | null = null
    let cancelled = false

    if (isTauri()) {
      // Tauri native drag-drop: provides real file paths (web File API does not)
      void (async () => {
        const { getCurrentWebview } = await import('@tauri-apps/api/webview')
        const unlisten = await getCurrentWebview().onDragDropEvent(event => {
          if (cancelled) return
          if (event.payload.type !== 'drop') return

          const paths = event.payload.paths.filter(p => supportedImageExtensions.test(p))
          if (paths.length === 0) return

          const { x, y } = event.payload.position
          const cssX = x / window.devicePixelRatio
          const cssY = y / window.devicePixelRatio
          const insertPos = view.posAtCoords({ x: cssX, y: cssY }) ?? view.state.selection.main.head

          void insertDroppedImagePaths(view, paths, insertPos)
        })
        if (cancelled) {
          unlisten()
        } else {
          unlistenTauriDrop = unlisten
        }
      })()
    } else {
      // Browser fallback: HTML5 drag-drop (no file paths, data URL only)
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

        useEditorStore
          .getState()
          .flashStatus('Only image files are supported', STATUS_TIMEOUT_MS.error)
      }

      view.dom.addEventListener('dragover', handleDragOver)
      view.dom.addEventListener('drop', handleDrop)
      htmlDndCleanup = () => {
        view.dom.removeEventListener('dragover', handleDragOver)
        view.dom.removeEventListener('drop', handleDrop)
      }
    }

    viewRef.current = view
    editorViewRef.current = view
    prevTabIdRef.current = activeTabId

    return () => {
      cancelled = true
      unlistenTauriDrop?.()
      htmlDndCleanup?.()
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
        effects: buildReconfigureEffects(),
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

  // Dynamic compartment reconfiguration
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({ effects: buildReconfigureEffects() })
  }, [buildReconfigureEffects])

  return <div ref={containerRef} className="h-full [&_.cm-editor]:h-full" />
})
