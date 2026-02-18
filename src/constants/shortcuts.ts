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
    title: 'View',
    shortcuts: [
      { keys: `${MOD}+\\`, label: 'Cycle mode (Split / Source / Zen)' },
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
