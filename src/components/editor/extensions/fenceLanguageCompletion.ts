import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { autocompletion } from '@codemirror/autocomplete'
import type { Extension } from '@codemirror/state'

import { KNOWN_LANGUAGES } from './wysiwyg/CodeBlockWidget'

const FENCE_PATTERN = /^`{3,}(\w*)$/

/** Only activates on fence opening lines (` ```lang `). Returns null otherwise. */
function fenceLanguageSource(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos)
  const match = FENCE_PATTERN.exec(line.text)
  if (!match) return null

  const backtickEnd: number = line.from + line.text.indexOf(match[1]!)
  if (context.pos < backtickEnd) return null

  return {
    from: backtickEnd,
    options: KNOWN_LANGUAGES.map((lang: string) => ({
      label: lang,
      type: 'keyword' as const,
    })),
    validFor: /^\w*$/,
  }
}

/** CM6 extension: fence language autocomplete for markdown code blocks. */
export function fenceLanguageCompletion(): Extension {
  return autocompletion({
    override: [fenceLanguageSource],
    activateOnTyping: true,
    icons: false,
    closeOnBlur: true,
    defaultKeymap: true,
  })
}
