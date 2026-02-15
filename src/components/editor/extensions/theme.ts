import { EditorView } from '@codemirror/view'

export const boltdownTheme = EditorView.theme(
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
      backgroundColor: '#f8fafc',
      borderRight: '1px solid #e2e8f0',
      color: '#94a3b8',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#f1f5f9',
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
      backgroundColor: '#FACC1540 !important',
    },
    '&.cm-focused .cm-selectionBackground': {
      backgroundColor: '#FACC1560 !important',
    },
    '.cm-line': {
      lineHeight: '1.6',
    },
  },
  { dark: false }
)

export const boltdownDarkTheme = EditorView.theme(
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
      backgroundColor: '#1e293b',
      borderRight: '1px solid #334155',
      color: '#64748b',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#334155',
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
      backgroundColor: '#FACC1530 !important',
    },
    '&.cm-focused .cm-selectionBackground': {
      backgroundColor: '#FACC1550 !important',
    },
    '.cm-line': {
      lineHeight: '1.6',
    },
  },
  { dark: true }
)
