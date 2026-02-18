export interface ShortcutEntry {
  keys: string
  label: string
}

export interface ShortcutGroup {
  title: string
  shortcuts: ShortcutEntry[]
}

const MOD = navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'File',
    shortcuts: [
      { keys: `${MOD}+N`, label: 'New file' },
      { keys: `${MOD}+O`, label: 'Open file' },
      { keys: `${MOD}+S`, label: 'Save' },
      { keys: `${MOD}+Shift+S`, label: 'Save as' },
      { keys: 'F2', label: 'Rename tab' },
    ],
  },
  {
    title: 'Edit',
    shortcuts: [
      { keys: `${MOD}+F`, label: 'Find' },
      { keys: `${MOD}+H`, label: 'Find & Replace' },
    ],
  },
  {
    title: 'Formatting',
    shortcuts: [
      { keys: `${MOD}+B`, label: 'Bold' },
      { keys: `${MOD}+I`, label: 'Italic' },
      { keys: `${MOD}+Shift+X`, label: 'Strikethrough' },
      { keys: `${MOD}+E`, label: 'Inline code' },
      { keys: `${MOD}+K`, label: 'Link' },
    ],
  },
  {
    title: 'View',
    shortcuts: [
      { keys: `${MOD}+\\`, label: 'Cycle mode (Split / Source / Live)' },
      { keys: `${MOD}+Shift+Z`, label: 'Toggle Zen (full immersion)' },
      { keys: `${MOD}+Shift+E`, label: 'Toggle sidebar' },
      { keys: `${MOD}+,`, label: 'Settings' },
      { keys: 'Escape', label: 'Exit Zen mode' },
    ],
  },
  {
    title: 'Help',
    shortcuts: [{ keys: `${MOD}+?`, label: 'Keyboard shortcuts' }],
  },
]
