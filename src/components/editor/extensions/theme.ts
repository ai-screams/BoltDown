import { EditorView } from '@codemirror/view'

function createBoltdownTheme(dark: boolean) {
  return EditorView.theme(
    {
      '&': {
        fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
        fontSize: '14px',
        height: '100%',
      },
      '.cm-content': {
        padding: '16px',
        caretColor: '#FACC15',
      },
      '.cm-cursor': {
        borderLeftColor: '#FACC15',
        borderLeftWidth: '2px',
      },
      '.cm-gutters': {
        backgroundColor: dark ? '#1e293b' : '#f8fafc',
        borderRight: dark ? '1px solid #334155' : '1px solid #e2e8f0',
        color: dark ? '#64748b' : '#94a3b8',
      },
      '.cm-activeLineGutter': {
        backgroundColor: dark ? '#334155' : '#f1f5f9',
      },
      '.cm-activeLine': {
        backgroundColor: 'rgba(250, 204, 21, 0.08)',
        boxShadow: 'inset 3px 0 0 rgba(250, 204, 21, 0.85)',
        borderRadius: '4px',
        transition: 'background-color 120ms ease-out, box-shadow 120ms ease-out',
      },
      '&.cm-focused .cm-activeLine': {
        backgroundColor: 'rgba(250, 204, 21, 0.14)',
        boxShadow: 'inset 3px 0 0 rgba(250, 204, 21, 1)',
      },
      '.cm-selectionBackground': {
        backgroundColor: dark ? '#FACC1530 !important' : '#FACC1540 !important',
      },
      '&.cm-focused .cm-selectionBackground': {
        backgroundColor: dark ? '#FACC1550 !important' : '#FACC1560 !important',
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
