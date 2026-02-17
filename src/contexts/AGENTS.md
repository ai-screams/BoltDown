<!-- Parent: ../AGENTS.md -->

# contexts/ — React Context Providers

## Purpose

React context providers for sharing non-store state across the component tree.

## Key Files

- `EditorViewContext.tsx` — Provides a `RefObject<EditorView | null>` to share the CodeMirror 6 EditorView instance. Exports `EditorViewProvider` (wrapper) and `useEditorView()` (hook returning ref).

## For AI Agents

- The EditorView ref is needed by EditorToolbar to dispatch formatting commands (bold, italic, etc.) and by FindReplaceModal to execute search/replace operations
- This is a ref-based context (not state) — changing the ref does NOT trigger re-renders
- The ref is set in MarkdownEditor.tsx when EditorView is created, consumed in EditorToolbar.tsx and FindReplaceModal.tsx
- Only one context exists currently; Zustand stores handle all reactive state
