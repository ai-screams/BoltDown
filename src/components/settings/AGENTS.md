<!-- Parent: ../AGENTS.md -->

# settings/ — Settings Modal Components

## Purpose

Application settings UI with categorized panels for theme, editor, preview, and general preferences.

## Key Files

- `SettingsModal.tsx` — Full settings modal (640x480px) with sidebar navigation (4 categories: Theme, Editor, Preview, General). Shared control components: `SettingRow` (label + description + control), `Toggle` (switch with role="switch"), `Select<T>` (generic dropdown), `NumberInput` (real-time spinner with focused draft state, clamped input, blur commit, Enter blur). Category panels: `ThemePanel` (light/dark/system segmented control with Sun/Moon/Monitor icons, theme presets with 5-swatch picker, CustomCssEditor with collapsible CssReference), `EditorPanel` (font family, size 10-24px, line height 1.2-2.4, tab size 2/4/8, word wrap, line numbers), `PreviewPanel` (font size 12-24px, line height 1.2-2.4, code block font size 10-20px, max width 600-1200px), `GeneralPanel` (auto save, delay 1000-10000ms, restore last file). **CustomCssEditor**: collapsible editor with char limit display (10240 max, 8192 warning threshold), real-time preview, reset button, placeholder examples. **CssReference**: collapsible panel with CSS variable reference (background, text, border, status), common selectors (.cm-editor, .markdown-preview, etc.), and copy-paste recipes. **Theme Presets**: 6 built-in themes (bolt, sepia, nord, contrast, meadow, vivid) with visual swatch previews (5 main swatches + 2 status colors per theme). Includes reset per-category and reset all buttons. Opens with Cmd+, shortcut. Closes on Escape or backdrop click. Memoized with `memo()`.

## For AI Agents

- All settings state comes from `useSettingsStore` (not local React state)
- Settings are persisted with 500ms debounce via `settingsStorage.ts` (Tauri appDataDir or localStorage)
- Theme panel uses segmented button group (not dropdown)
- Shared controls (SettingRow, Toggle, Select, NumberInput) are defined in the same file (not extracted) — KISS principle
- NumberInput uses focused draft state pattern: shows draft value while focused, syncs with store value when blurred or on external reset
- NumberInput allows real-time typing (onChange fires immediately if value is valid), blur commits final value
- Adding a new settings category requires: new interface in `types/settings.ts`, new update method in `settingsStore.ts`, new panel component, add to `categories` and `panels` arrays
- Editor settings are partially wired in runtime CM6 config: `focusMode`, `focusContextLines`, and `typewriterMode` are actively reconfigured; `tabSize`, `wordWrap`, and `lineNumbers` remain UI-visible but are not yet fully mapped to editor reconfiguration paths
- CustomCssEditor char limits enforced in UI: 10240 max, 8192 warning threshold (yellow text), 150ms debounce before injection
- CssReference provides documentation inline (not in separate file) — sections defined as const arrays (CSS_REFERENCE_SECTIONS, CSS_SELECTORS, CSS_RECIPES)
- Theme presets stored in `constants/theme.ts` as THEME_PRESETS array with name/label/description/swatches/info/danger fields
- Custom CSS injected via `useCustomCss` hook in App.tsx (not in SettingsModal)
