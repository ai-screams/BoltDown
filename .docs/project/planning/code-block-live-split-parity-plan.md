# Code Block Live/Split Parity Plan

> Status: Proposed (planning only)
> Last updated: 2026-02-19

## Objective

Define a repo-specific plan to keep code-block behavior consistent across live editing (`src/components/editor/extensions/wysiwyg/*`) and split preview (`src/components/preview/MarkdownPreview.tsx` + markdown-it pipeline), with explicit regression gates.

## Scope Boundaries

### In Scope

- Fenced code-block boundary navigation behavior in live/zen (`ArrowUp`, `ArrowDown`, block-scoped `Mod+A`).
- Language badge + popover behavior and metadata wiring (`CodeBlockWidget.ts`, `buildDecorations.ts`).
- Code-block line/fence class + data-attribute contract between `buildDecorations.ts` and `src/styles/codeblock.css`.
- Shared language source contract (`KNOWN_LANGUAGES` and `fenceLanguageCompletion.ts`).
- Regression coverage for model and decoration behavior.

### Out of Scope

- Replacing markdown-it preview parser with CM6 rendering.
- New syntax-highlighting engine or Prism language bundle redesign.
- Global editor keymap redesign outside code-block boundary cases.
- Table, TOC, or math parity changes unrelated to code blocks.

## Acceptance Criteria

- `MarkdownEditor.tsx` keeps `codeBlockArrowNavCompRef` and only enables `codeBlockArrowNavigationKeymap()` in `mode === 'live' || mode === 'zen'`.
- `codeBlockArrowNavigationModel.ts` resolves all documented boundary actions:
  - `ArrowUp` on first code line opens language editor action.
  - `ArrowDown` on last code line exits below block.
  - `ArrowDown` from above enters first code line.
  - `ArrowUp` from below enters last code line.
  - `Mod+A` inside fenced block selects code text only.
- `buildDecorations.ts` still emits `codeblock-line`, `codeblock-fence-hidden-line`, badge/popover hooks, and required `data-*` attributes consumed by `src/styles/codeblock.css`.
- `KNOWN_LANGUAGES` remains the single source for both badge popover filtering and fence autocomplete options.
- Tests pass for updated behavior (`codeBlockArrowNavigationModel.test.ts`, `codeBlockBadge.test.ts`, and any affected widget tests).

## Regression Checklist

- Live mode: caret on first code line + `ArrowUp` opens language popover for the same fenced block.
- Live mode: caret on last code line + `ArrowDown` moves to line below closing fence.
- Live mode: caret above fenced block + `ArrowDown` enters first code line.
- Live mode: caret below fenced block + `ArrowUp` enters last code line.
- Live/zen mode: `Mod+A` inside fenced block selects only code text range; outside block keeps normal select-all.
- Unlabeled fenced block still shows language badge and editable popover.
- Mermaid fenced block still keeps reveal behavior while preserving badge editing path.
- `codeblock.css` selectors still match emitted classes/attributes after any decoration changes.

## Risk Matrix

| Risk                                                 | Severity | Likelihood | Impact                                                       | Mitigation                                                                                       |
| ---------------------------------------------------- | -------- | ---------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Model/keymap drift (`Model` vs `Keymap`)             | High     | Medium     | Boundary keys fail or wrong cursor jumps                     | Keep model and keymap edits in same PR; require model tests update                               |
| Decoration/CSS contract drift                        | High     | Medium     | Broken line numbers, badge placement, hidden fence rendering | Review `buildDecorations.ts` + `src/styles/codeblock.css` together; verify class/data attributes |
| Language source split (`KNOWN_LANGUAGES` duplicates) | Medium   | Medium     | Badge and fence autocomplete diverge                         | Keep `KNOWN_LANGUAGES` as single source imported by fence completion                             |
| Widget event handling regression (`ignoreEvent`)     | Medium   | Low        | Click/keyboard actions swallowed or leaked                   | Add/update widget tests and manual click-through checks                                          |
| Split preview parity assumptions overreach           | Low      | Medium     | False-positive parity bugs                                   | Limit parity scope to behavior that is intentionally shared/documented                           |

## Rollout Order (Repo-Specific)

1. **Model first**: update `src/components/editor/extensions/wysiwyg/codeBlockArrowNavigationModel.ts` + `codeBlockArrowNavigationModel.test.ts`.
2. **Keymap wiring**: update `src/components/editor/extensions/wysiwyg/codeBlockArrowNavigationKeymap.ts` and `src/components/editor/MarkdownEditor.tsx` compartment reconfigure path.
3. **Decoration/UI contract**: update `src/components/editor/extensions/wysiwyg/buildDecorations.ts`, `src/components/editor/extensions/wysiwyg/CodeBlockWidget.ts`, and `src/styles/codeblock.css` together.
4. **Autocomplete source check**: confirm `src/components/editor/extensions/fenceLanguageCompletion.ts` still imports `KNOWN_LANGUAGES`.
5. **Regression pass**: run focused tests for model/badge/widget behavior before broader lint/type/build checks.
6. **Docs sync**: update `AGENTS.md`, scoped AGENTS docs, and backlog links in the same change set.
