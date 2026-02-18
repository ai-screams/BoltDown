import { StateField } from '@codemirror/state'
import { type DecorationSet, EditorView } from '@codemirror/view'

import type { MermaidSecurityLevel } from '@/types/settings'

import { buildDecorations } from './buildDecorations'

export function wysiwygExtension(mermaidSecurityLevel: MermaidSecurityLevel = 'strict') {
  const wysiwygDecorations = StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(state, mermaidSecurityLevel)
    },
    update(decorations, tr) {
      // No changes at all: reuse existing decorations
      if (!tr.docChanged && !tr.selection) return decorations

      // Full rebuild on any doc or selection change.
      // The LRU caches for KaTeX (wysiwygKatexCache) and Mermaid (mermaidSvgCache)
      // make each rebuild cheap — the expensive rendering is served from cache,
      // so only the tree walk and decoration assembly cost remains.
      // A truly incremental approach (mapping + partial rebuild) was considered
      // but is fragile with the two-tier reveal system and cross-referencing
      // between code ranges and math decorations.
      return buildDecorations(tr.state, mermaidSecurityLevel)
    },
    provide: field => EditorView.decorations.from(field),
  })

  return wysiwygDecorations
}
