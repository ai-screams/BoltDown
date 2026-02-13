<!-- Parent: ../AGENTS.md -->

# settings/ — Settings Modal Components

## Purpose

Application settings UI with categorized panels for theme, editor, preview, and general preferences.

## Key Files

- `SettingsModal.tsx` — Full settings modal with sidebar navigation (4 categories: Theme, Editor, Preview, General). Shared control components: `SettingRow` (label + description + control), `Toggle` (switch), `Select<T>` (dropdown), `NumberInput` (clamped input). Category panels: `ThemePanel` (light/dark/system segmented control), `EditorPanel` (font, size, line height, tab size, word wrap, line numbers), `PreviewPanel` (font size, line height, code block font size, max width), `GeneralPanel` (auto save, delay, restore last file). Includes reset per-category and reset all. Opens with Cmd+, shortcut. Closes on Escape or backdrop click. Memoized with `memo()`.

## For AI Agents

- All settings state comes from `useSettingsStore` (not local React state)
- Settings are persisted with 500ms debounce via `settingsStorage.ts`
- Theme panel uses segmented button group (not dropdown)
- Shared controls (SettingRow, Toggle, Select, NumberInput) are defined in the same file (not extracted) — KISS principle
- Adding a new settings category requires: new interface in `types/settings.ts`, new update method in `settingsStore.ts`, new panel component, add to `categories` and `panels` arrays
