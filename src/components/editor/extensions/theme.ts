import { EditorView } from '@codemirror/view'

function createBoltdownTheme(dark: boolean) {
  return EditorView.theme(
    {
      '&': {
        fontFamily: 'var(--p-font-mono)',
        fontSize: '14px',
        height: '100%',
      },
      '.cm-content': {
        padding: '16px',
        caretColor: 'rgb(var(--s-accent) / 1)',
      },
      '.cm-cursor': {
        borderLeftColor: 'rgb(var(--s-accent) / 1)',
        borderLeftWidth: '2px',
      },
      '.cm-gutters': {
        backgroundColor: 'rgb(var(--c-cm-gutter-bg) / 1)',
        borderRight: '1px solid rgb(var(--c-cm-gutter-border) / 1)',
        color: 'rgb(var(--c-cm-gutter-text) / 1)',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'rgb(var(--c-cm-gutter-active-bg) / 1)',
      },
      '.cm-activeLine': {
        backgroundColor: 'var(--c-cm-active-line-bg)',
        boxShadow: 'inset 3px 0 0 var(--c-cm-active-line-shadow)',
        borderRadius: '4px',
        transition: 'background-color 120ms ease-out, box-shadow 120ms ease-out',
      },
      '&.cm-focused .cm-activeLine': {
        backgroundColor: 'var(--c-cm-active-line-bg-focused)',
        boxShadow: 'inset 3px 0 0 var(--c-cm-active-line-shadow-focused)',
      },
      '.cm-selectionBackground': {
        backgroundColor: 'var(--c-cm-selection-bg) important!',
      },
      '&.cm-focused .cm-selectionBackground': {
        backgroundColor: 'var(--c-cm-selection-bg-focused) important!',
      },
      '.cm-line': {
        lineHeight: '1.6',
      },
    },
    { dark }
  )
}

export const boltdownTheme = createBoltdownTheme(false)
export const boltdownDarkTheme = createBoltdownTheme(true)
