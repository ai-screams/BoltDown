import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, foldGutter, indentOnInput } from '@codemirror/language'
import { search, searchKeymap } from '@codemirror/search'
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
import { useTabStore } from '@/stores/tabStore'

import { markdownExtension } from './extensions/markdown'
import { boltdownDarkTheme, boltdownTheme } from './extensions/theme'
import { wysiwygPlugin } from './extensions/wysiwyg'

function buildGutterExts(showGutter: boolean): Extension {
  return showGutter ? [lineNumbers(), foldGutter(), highlightActiveLineGutter()] : []
}

export default memo(function MarkdownEditor() {
  const mode = useEditorStore(s => s.mode)
  const themeMode = useSettingsStore(s => s.settings.theme.mode)
  const isDark =
    themeMode === 'dark' ||
    (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const editorViewRef = useEditorView()

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

  activeTabIdRef.current = activeTabId

  // Build extensions array with current compartment state
  const buildExtensions = (): Extension[] => [
    markdownExtension(),
    themeCompRef.current.of(isDark ? boltdownDarkTheme : boltdownTheme),
    wysiwygCompRef.current.of(mode === 'zen' ? wysiwygPlugin : []),
    gutterCompRef.current.of(buildGutterExts(mode !== 'zen')),
    history(),
    search(),
    bracketMatching(),
    indentOnInput(),
    highlightActiveLine(),
    EditorView.lineWrapping,
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
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
    viewRef.current = view
    editorViewRef.current = view
    prevTabIdRef.current = activeTabId

    return () => {
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
          wysiwygCompRef.current.reconfigure(mode === 'zen' ? wysiwygPlugin : []),
          gutterCompRef.current.reconfigure(buildGutterExts(mode !== 'zen')),
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
        wysiwygCompRef.current.reconfigure(mode === 'zen' ? wysiwygPlugin : []),
        gutterCompRef.current.reconfigure(buildGutterExts(mode !== 'zen')),
      ],
    })
  }, [mode])

  return <div ref={containerRef} className="h-full [&_.cm-editor]:h-full" />
})
