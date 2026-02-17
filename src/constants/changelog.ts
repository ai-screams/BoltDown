export interface ChangelogEntry {
  version: string
  date: string
  changes: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.1.0',
    date: '2026-02-17',
    changes: [
      'Initial release with WYSIWYG, Split, and Source editing modes',
      'Zen mode for distraction-free writing',
      'KaTeX math rendering (inline & block)',
      'Mermaid diagram support',
      'Split view with synchronized scrolling',
      'File tree sidebar with drag & drop',
      'Multi-tab editing with dirty state tracking',
      'Find & Replace with regex support',
      'Focus mode and typewriter mode',
      'Six built-in color themes (Bolt, Sepia, Nord, Contrast, Meadow, Vivid)',
      'Custom CSS injection for advanced theming',
      'Export to HTML, Print/PDF, and clipboard',
      'Auto-save with configurable delay',
      'Outline panel for heading navigation',
      'Word, line, and character count with reading time',
      'Full keyboard shortcut support',
      'Tauri 2.0 desktop integration',
    ],
  },
]
