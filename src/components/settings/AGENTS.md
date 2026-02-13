<!-- Parent: ../AGENTS.md -->

# settings/ — Settings Modal Components

## Purpose

Application settings UI with categorized panels for theme, editor, preview, and general preferences.

## Key Files

- `SettingsModal.tsx` — Full settings modal (640x480px) with sidebar navigation (4 categories: Theme, Editor, Preview, General). Shared control components: `SettingRow` (label + description + control), `Toggle` (switch with role="switch"), `Select<T>` (generic dropdown), `NumberInput` (real-time spinner with focused draft state, clamped input, blur commit, Enter blur). Category panels: `ThemePanel` (light/dark/system segmented control with Sun/Moon/Monitor icons), `EditorPanel` (font family, size 10-24px, line height 1.2-2.4, tab size 2/4/8, word wrap, line numbers), `PreviewPanel` (font size 12-24px, line height 1.2-2.4, code block font size 10-20px, max width 600-1200px), `GeneralPanel` (auto save, delay 1000-10000ms, restore last file). Includes reset per-category and reset all buttons. Opens with Cmd+, shortcut. Closes on Escape or backdrop click. Memoized with `memo()`.

## For AI Agents

- All settings state comes from `useSettingsStore` (not local React state)
- Settings are persisted with 500ms debounce via `settingsStorage.ts` (Tauri appDataDir or localStorage)
- Theme panel uses segmented button group (not dropdown)
- Shared controls (SettingRow, Toggle, Select, NumberInput) are defined in the same file (not extracted) — KISS principle
- NumberInput uses focused draft state pattern: shows draft value while focused, syncs with store value when blurred or on external reset
- NumberInput allows real-time typing (onChange fires immediately if value is valid), blur commits final value
- Adding a new settings category requires: new interface in `types/settings.ts`, new update method in `settingsStore.ts`, new panel component, add to `categories` and `panels` arrays
