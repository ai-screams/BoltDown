import type { EditorView, KeyBinding } from '@codemirror/view'

// ---------------------------------------------------------------------------
// Raw formatting helpers (used by EditorToolbar onClick handlers)
// ---------------------------------------------------------------------------

export function toggleWrap(view: EditorView, before: string, after: string): void {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  const doc = view.state.doc

  // Case 1: Selected text is already wrapped with markers (e.g. selecting "**bold**")
  if (
    selected.startsWith(before) &&
    selected.endsWith(after) &&
    selected.length >= before.length + after.length
  ) {
    const inner = selected.slice(before.length, selected.length - after.length)
    view.dispatch({
      changes: { from, to, insert: inner },
      selection: { anchor: from, head: from + inner.length },
    })
    view.focus()
    return
  }

  // Case 2: Markers exist just outside the selection (e.g. cursor inside **|bold|**)
  const outerFrom = from - before.length
  const outerTo = to + after.length
  if (
    outerFrom >= 0 &&
    outerTo <= doc.length &&
    doc.sliceString(outerFrom, from) === before &&
    doc.sliceString(to, outerTo) === after
  ) {
    // Guard: for single-char markers (e.g. * for italic), count the full consecutive
    // run to avoid stripping a char that belongs to a longer marker (e.g. ** for bold).
    // Even count => marker not present (all chars paired as bold) => skip removal.
    let shouldRemove = true
    if (before === after && before.length === 1) {
      const ch = before
      let left = 0
      for (let i = from - 1; i >= 0 && doc.sliceString(i, i + 1) === ch; i--) left++
      let right = 0
      for (let i = to; i < doc.length && doc.sliceString(i, i + 1) === ch; i++) right++
      if (left % 2 === 0 || right % 2 === 0) shouldRemove = false
    }

    if (shouldRemove) {
      view.dispatch({
        changes: [
          { from: outerFrom, to: from, insert: '' },
          { from: to, to: outerTo, insert: '' },
        ],
        selection: { anchor: outerFrom, head: outerFrom + (to - from) },
      })
      view.focus()
      return
    }
  }

  // Case 3: No existing markers — wrap with markers
  const text = selected || 'text'
  view.dispatch({
    changes: { from, to, insert: `${before}${text}${after}` },
    selection: { anchor: from + before.length, head: from + before.length + text.length },
  })
  view.focus()
}

export function insertAtLineStart(view: EditorView, prefix: string): void {
  const { from } = view.state.selection.main
  const line = view.state.doc.lineAt(from)
  const currentText = line.text

  // Toggle: if line already starts with prefix, remove it
  if (currentText.startsWith(prefix)) {
    view.dispatch({
      changes: { from: line.from, to: line.from + prefix.length, insert: '' },
    })
  } else {
    // Remove existing heading prefixes before adding new one
    const headingMatch = /^#{1,6}\s/.exec(currentText)
    const removeLen = headingMatch ? headingMatch[0].length : 0
    view.dispatch({
      changes: { from: line.from, to: line.from + removeLen, insert: prefix },
    })
  }
  view.focus()
}

export function insertBlock(view: EditorView, text: string): void {
  const { from } = view.state.selection.main
  view.dispatch({
    changes: { from, insert: text },
    selection: { anchor: from + text.length },
  })
  view.focus()
}

/** Smart code toggle: multi-line selection gets fenced, single-line gets inline backticks */
export function toggleCode(view: EditorView): void {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  if (selected.includes('\n')) {
    toggleWrap(view, '```\n', '\n```')
  } else {
    toggleWrap(view, '`', '`')
  }
}

/** Insert a fenced code block (always block-level, distinct from inline code) */
export function insertCodeBlock(view: EditorView): void {
  const { from } = view.state.selection.main
  const template = '```\n\n```'
  view.dispatch({
    changes: { from, insert: template },
    // Place cursor on the empty line inside the fence
    selection: { anchor: from + 4 },
  })
  view.focus()
}

/** Insert a 3x3 markdown table template */
export function insertTable(view: EditorView): void {
  const { from } = view.state.selection.main
  const table = [
    '| Header | Header | Header |',
    '| ------ | ------ | ------ |',
    '| Cell   | Cell   | Cell   |',
    '| Cell   | Cell   | Cell   |',
    '',
  ].join('\n')
  view.dispatch({
    changes: { from, insert: table },
    selection: { anchor: from + 2, head: from + 8 },
  })
  view.focus()
}

/** Insert a math block (KaTeX $$) */
export function insertMathBlock(view: EditorView): void {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  if (selected.includes('\n') || selected.length === 0) {
    const template = '$$\n\n$$'
    view.dispatch({
      changes: { from, to, insert: template },
      selection: { anchor: from + 3 },
    })
  } else {
    toggleWrap(view, '$', '$')
    return
  }
  view.focus()
}

/** Insert a task list item */
export function insertTaskList(view: EditorView): void {
  insertAtLineStart(view, '- [ ] ')
}

/** Insert a footnote reference and definition */
export function insertFootnote(view: EditorView): void {
  const { from } = view.state.selection.main
  const ref = '[^1]'
  const def = '\n\n[^1]: '
  view.dispatch({
    changes: { from, insert: ref + def },
    selection: { anchor: from + ref.length + def.length },
  })
  view.focus()
}

/** Insert a table of contents marker */
export function insertToc(view: EditorView): void {
  insertBlock(view, '[toc]\n')
}

// ---------------------------------------------------------------------------
// CM6 Command wrappers (return true to indicate "handled")
// ---------------------------------------------------------------------------

function cmd(fn: (view: EditorView) => void) {
  return (view: EditorView): boolean => {
    fn(view)
    return true
  }
}

export const toggleBold = cmd(v => toggleWrap(v, '**', '**'))
export const toggleItalic = cmd(v => toggleWrap(v, '*', '*'))
export const toggleStrikethrough = cmd(v => toggleWrap(v, '~~', '~~'))
export const toggleInlineCode = cmd(v => toggleWrap(v, '`', '`'))
export const insertLinkCmd = cmd(v => toggleWrap(v, '[', '](url)'))
export const toggleBlockquote = cmd(v => insertAtLineStart(v, '> '))
export const toggleBulletList = cmd(v => insertAtLineStart(v, '- '))
export const toggleNumberedList = cmd(v => insertAtLineStart(v, '1. '))
export const toggleTaskList = cmd(v => insertTaskList(v))

// ---------------------------------------------------------------------------
// Formatting keymap for CM6 registration
// ---------------------------------------------------------------------------

// Vim/Emacs safety notes:
// - Mod = Cmd on macOS (no conflict with Ctrl-based vim/emacs bindings)
// - On Linux/Windows Mod = Ctrl; CM6 vim extension uses its own keymap
//   layer so these Mod- bindings coexist (vim intercepts in normal mode,
//   these fire in insert mode or when vim is off).
// - Cmd+E: emacs Ctrl+E (end-of-line) is separate from Cmd+E on macOS.
// - Cmd+K: vim Ctrl+K (digraph) is Ctrl, not Cmd. Safe.
export const formattingKeymap: KeyBinding[] = [
  { key: 'Mod-b', run: toggleBold },
  { key: 'Mod-i', run: toggleItalic },
  { key: 'Mod-Shift-x', run: toggleStrikethrough },
  { key: 'Mod-e', run: toggleInlineCode },
  { key: 'Mod-k', run: insertLinkCmd },
]
