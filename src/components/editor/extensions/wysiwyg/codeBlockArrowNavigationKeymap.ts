import type { Extension } from '@codemirror/state'
import { keymap, type EditorView, type KeyBinding } from '@codemirror/view'

import {
  resolveCodeBlockArrowNavigation,
  resolveCodeBlockSelectAllRange,
  type ArrowNavigationDirection,
} from './codeBlockArrowNavigationModel'
import { openLanguagePopoverForCodeBlock } from './CodeBlockWidget'

function runCodeBlockArrowNavigation(
  view: EditorView,
  direction: ArrowNavigationDirection
): boolean {
  const selection = view.state.selection.main
  const action = resolveCodeBlockArrowNavigation(view.state, selection, direction)
  if (!action) return false

  if (action.type === 'open-language-editor') {
    return openLanguagePopoverForCodeBlock(view, action.blockId)
  }

  view.dispatch({
    selection: { anchor: action.targetPos },
    scrollIntoView: true,
  })
  return true
}

function runCodeBlockSelectAll(view: EditorView): boolean {
  const selection = view.state.selection.main
  const range = resolveCodeBlockSelectAllRange(view.state, selection)
  if (!range) {
    return false
  }

  view.dispatch({
    selection: { anchor: range.from, head: range.to },
    scrollIntoView: true,
  })
  return true
}

const codeBlockArrowNavigationKeybindings: readonly KeyBinding[] = [
  {
    key: 'Mod-a',
    run: runCodeBlockSelectAll,
  },
  {
    key: 'ArrowUp',
    run: view => runCodeBlockArrowNavigation(view, 'up'),
  },
  {
    key: 'ArrowDown',
    run: view => runCodeBlockArrowNavigation(view, 'down'),
  },
]

export function codeBlockArrowNavigationKeymap(): Extension {
  return keymap.of(codeBlockArrowNavigationKeybindings)
}
