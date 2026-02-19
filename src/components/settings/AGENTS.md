<!-- Parent: ../AGENTS.md -->

# settings/ — Settings Modal Components

## Purpose

Application settings UI with categorized panels for theme, editor, preview, and general preferences. Full accessibility support with form controls.

## Key Files

- `SettingsModal.tsx` — Full settings modal (640x480px) with sidebar navigation (4 categories: Theme, Editor, Preview, General). Shared control components: `SettingRow` (label + description + control), `Toggle` (switch with `role="switch"` and `aria-checked`), `Select<T>` (generic dropdown with `aria-label`), `NumberInput` (real-time spinner with `aria-label`, focused draft state, clamped input, blur commit, Enter blur). Category panels: `ThemePanel` (light/dark/system segmented control with Sun/Moon/Monitor icons, theme presets with 5-swatch picker, CustomCssEditor with collapsible CssReference), `EditorPanel` (font family, size 10-24px, line height 1.2-2.4, tab size 2/4/8, word wrap, spellcheck, line numbers, focus mode, typewriter mode, **vim mode**), `PreviewPanel` (font size 12-24px, line height 1.2-2.4, code block font size 10-20px, max width 600-1200px, mermaid security level with ⚠️ warning icon when set to 'loose'), `GeneralPanel` (auto save, delay 1000-10000ms, restore last file). **CustomCssEditor**: collapsible editor with char limit display (10240 max, 8192 warning threshold), real-time preview, reset button, placeholder examples. **CssReference**: collapsible panel with CSS variable reference (background, text, border, status), common selectors (.cm-editor, .markdown-preview, etc.), and copy-paste recipes. **Theme Presets**: 6 built-in themes (bolt, sepia, nord, contrast, meadow, vivid) with visual swatch previews (5 main swatches + 2 status colors per theme). Includes reset per-category and reset all buttons. Opens with Cmd+, shortcut. Closes on Escape or backdrop click. Dialog has `aria-labelledby="settings-dialog-title"` and `aria-modal="true"`. Decorative icons marked with `aria-hidden="true"`. Memoized with `memo()`.

## Accessibility Features

### Dialog

- **ARIA Attributes**: `role="dialog"`, `aria-labelledby="settings-dialog-title"`, `aria-modal="true"`
- **Title Element**: `<span id="settings-dialog-title">Settings</span>` provides accessible name
- **Keyboard**: Escape key closes dialog
- **Focus Management**: Focus returns to trigger when closed

### Form Controls

- **Toggle**: `role="switch"`, `aria-checked={checked}`, `aria-label={label}` on all instances
- **Select**: `aria-label={label}` on all `<select>` elements (Font Family, Tab Size, Mermaid Security, etc.)
- **NumberInput**: `aria-label={label}` on all `<input type="number">` elements (Font Size, Line Height, etc.)
- **Buttons**: Clear aria-labels on icon-only buttons (Close, Reset)
- **Decorative Icons**: All icons marked with `aria-hidden="true"`

```tsx
// Toggle component
<button
  role="switch"
  aria-checked={checked}
  aria-label={label}
  onClick={() => onChange(!checked)}
>
  <span className={checked ? 'translate-x-[18px]' : 'translate-x-[3px]'} />
</button>

// Select component
<select
  aria-label={label}
  value={value}
  onChange={e => onChange(e.target.value as T)}
>
  {options.map(o => <option key={o.value}>{o.label}</option>)}
</select>

// NumberInput component
<input
  type="number"
  aria-label={label}
  value={value}
  min={min}
  max={max}
  onChange={onChange}
/>
```

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

## WIG Compliance

### Dialog Structure

- ✅ `role="dialog"` with `aria-labelledby` and `aria-modal="true"`
- ✅ Accessible name via `id="settings-dialog-title"`
- ✅ Escape key closes dialog
- ✅ Backdrop click closes dialog

### Form Accessibility

- ✅ All Toggle components have `role="switch"`, `aria-checked`, and `aria-label`
- ✅ All Select components have `aria-label`
- ✅ All NumberInput components have `aria-label`
- ✅ Icon-only buttons have clear `aria-label` attributes
- ✅ Decorative icons marked with `aria-hidden="true"`
- ✅ Focus-visible rings on all interactive elements
