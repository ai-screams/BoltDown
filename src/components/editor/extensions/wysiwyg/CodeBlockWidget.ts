import type { Range } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'
import Prism from 'prismjs'

import { sanitizeCodeHtml } from '@/utils/sanitize'

import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-typescript'

export function getCodeBlockPalette() {
  const isDark = document.documentElement.classList.contains('dark')
  return {
    background: 'rgb(var(--c-code-block-bg) / 1)',
    text: 'rgb(var(--c-code-block-text) / 1)',
    badge: 'rgb(var(--c-code-block-badge) / 1)',
    keyword: isDark ? '#c678dd' : '#a626a4',
    string: isDark ? '#98c379' : '#50a14f',
    comment: isDark ? '#5c6370' : '#a0a1a7',
    function: isDark ? '#61afef' : '#4078f2',
    number: isDark ? '#d19a66' : '#986801',
    punctuation: isDark ? '#abb2bf' : '#383a42',
  }
}

export function getPrismTokenColor(
  type: string,
  palette: ReturnType<typeof getCodeBlockPalette>
): string | null {
  if (type === 'keyword' || type === 'tag' || type === 'builtin') return palette.keyword
  if (type === 'string' || type === 'char' || type === 'template-string') return palette.string
  if (type === 'comment' || type === 'prolog' || type === 'doctype') return palette.comment
  if (type === 'function' || type === 'class-name') return palette.function
  if (type === 'number' || type === 'boolean') return palette.number
  if (type === 'operator' || type === 'punctuation') return palette.punctuation
  if (type === 'attr-name' || type === 'property') return palette.keyword
  if (type === 'attr-value') return palette.string
  return null
}

export function applyPrismTokens(
  decorations: Range<Decoration>[],
  tokens: (string | Prism.Token)[],
  startPos: number,
  palette: ReturnType<typeof getCodeBlockPalette>
): number {
  let pos = startPos
  for (const token of tokens) {
    if (typeof token === 'string') {
      pos += token.length
    } else {
      const tokenStart = pos
      if (Array.isArray(token.content)) {
        pos = applyPrismTokens(decorations, token.content, pos, palette)
      } else if (typeof token.content === 'string') {
        pos += token.content.length
      } else {
        // token.content is a single Token — recurse
        pos = applyPrismTokens(decorations, [token.content], pos, palette)
      }
      const color = getPrismTokenColor(token.type, palette)
      if (color) {
        decorations.push(
          Decoration.mark({ attributes: { style: `color: ${color};` } }).range(tokenStart, pos)
        )
      }
    }
  }
  return pos
}

/** Languages available for autocomplete (sorted, common ones first). */
const KNOWN_LANGUAGES = [
  'bash',
  'c',
  'cmake',
  'coffeescript',
  'cpp',
  'csharp',
  'css',
  'dart',
  'diff',
  'docker',
  'elixir',
  'erlang',
  'go',
  'graphql',
  'groovy',
  'haskell',
  'html',
  'ini',
  'java',
  'javascript',
  'json',
  'jsx',
  'kotlin',
  'latex',
  'lua',
  'makefile',
  'markdown',
  'matlab',
  'mermaid',
  'nginx',
  'objectivec',
  'ocaml',
  'perl',
  'php',
  'plaintext',
  'powershell',
  'python',
  'r',
  'ruby',
  'rust',
  'sass',
  'scala',
  'scss',
  'shell',
  'sql',
  'swift',
  'toml',
  'tsx',
  'typescript',
  'vim',
  'xml',
  'yaml',
  'zig',
]

/** Show a floating input with autocomplete over the badge for inline language editing. */
function showLanguagePopover(
  view: EditorView,
  badgeEl: HTMLElement,
  codeInfoFrom: number,
  codeInfoTo: number,
  currentLang: string
) {
  // Remove any existing popover
  view.dom.querySelector('.codeblock-lang-popover')?.remove()

  // --- Container ---
  const container = document.createElement('div')
  container.className = 'codeblock-lang-popover'

  // Position over the badge
  const badgeRect = badgeEl.getBoundingClientRect()
  const editorRect = view.dom.getBoundingClientRect()
  container.style.top = `${badgeRect.top - editorRect.top}px`
  container.style.right = `${editorRect.right - badgeRect.right}px`

  // --- Input ---
  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'codeblock-lang-input'
  input.value = currentLang
  input.spellcheck = false
  input.setAttribute('autocomplete', 'off')
  input.setAttribute('autocorrect', 'off')
  input.setAttribute('placeholder', 'language…')
  container.appendChild(input)

  // --- Dropdown list ---
  const list = document.createElement('ul')
  list.className = 'codeblock-lang-list'
  container.appendChild(list)

  let activeIndex = -1

  function filterList() {
    const query = input.value.trim().toLowerCase()
    list.innerHTML = ''
    activeIndex = -1

    const matches = query ? KNOWN_LANGUAGES.filter(l => l.includes(query)) : KNOWN_LANGUAGES

    if (matches.length === 0 || (matches.length === 1 && matches[0] === query)) {
      list.style.display = 'none'
      return
    }

    list.style.display = ''
    for (const lang of matches.slice(0, 8)) {
      const li = document.createElement('li')
      li.className = 'codeblock-lang-option'
      // Highlight the matching substring
      if (query) {
        const idx = lang.indexOf(query)
        li.appendChild(document.createTextNode(lang.slice(0, idx)))
        const strong = document.createElement('strong')
        strong.textContent = lang.slice(idx, idx + query.length)
        li.appendChild(strong)
        li.appendChild(document.createTextNode(lang.slice(idx + query.length)))
      } else {
        li.textContent = lang
      }
      li.addEventListener('mousedown', e => {
        e.preventDefault()
        input.value = lang
        commit()
      })
      list.appendChild(li)
    }
  }

  function setActive(index: number) {
    const items = list.querySelectorAll('.codeblock-lang-option')
    if (items.length === 0) return
    // Clamp
    activeIndex = Math.max(0, Math.min(index, items.length - 1))
    items.forEach((el, i) => el.classList.toggle('active', i === activeIndex))
    items[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }

  view.dom.appendChild(container)

  requestAnimationFrame(() => {
    input.focus()
    input.select()
    filterList()
  })

  let committed = false
  const commit = () => {
    if (committed) return
    committed = true
    const newLang = input.value.trim().toLowerCase()
    container.remove()
    if (newLang !== currentLang) {
      view.dispatch({ changes: { from: codeInfoFrom, to: codeInfoTo, insert: newLang } })
    }
    view.focus()
  }
  const cancel = () => {
    if (committed) return
    committed = true
    container.remove()
    view.focus()
  }

  input.addEventListener('input', filterList)

  input.addEventListener('keydown', e => {
    const items = list.querySelectorAll('.codeblock-lang-option')

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(activeIndex + 1)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(activeIndex - 1)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && activeIndex < items.length) {
        input.value = items[activeIndex]!.textContent ?? ''
      }
      commit()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      if (activeIndex >= 0 && activeIndex < items.length) {
        input.value = items[activeIndex]!.textContent ?? ''
        filterList()
      }
    }
  })

  input.addEventListener('blur', () => {
    // Delay to allow mousedown on list items to fire first
    setTimeout(() => {
      if (!committed) commit()
    }, 100)
  })
}

export class LanguageBadgeWidget extends WidgetType {
  constructor(
    private language: string,
    private codeInfoFrom: number,
    private codeInfoTo: number
  ) {
    super()
  }
  toDOM(view: EditorView) {
    const badge = document.createElement('span')
    badge.className = 'codeblock-badge'
    badge.textContent = this.language

    badge.addEventListener('mousedown', e => {
      e.preventDefault()
      showLanguagePopover(view, badge, this.codeInfoFrom, this.codeInfoTo, this.language)
    })

    return badge
  }
  eq(other: LanguageBadgeWidget) {
    return (
      this.language === other.language &&
      this.codeInfoFrom === other.codeInfoFrom &&
      this.codeInfoTo === other.codeInfoTo
    )
  }
  ignoreEvent(event: Event) {
    return event instanceof MouseEvent
  }
}

export class CodeBlockWidget extends WidgetType {
  constructor(
    private code: string,
    private language: string
  ) {
    super()
  }
  toDOM() {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-codeblock-widget'
    wrapper.style.cssText = 'position: relative; padding: 8px 0;'
    const palette = getCodeBlockPalette()

    // Language badge
    if (this.language) {
      const badge = document.createElement('span')
      badge.textContent = this.language
      badge.style.cssText = `position: absolute; top: 6px; right: 10px; font-size: 0.7em; color: ${palette.badge}; font-family: monospace; text-transform: uppercase; letter-spacing: 0.05em;`
      wrapper.appendChild(badge)
    }

    const pre = document.createElement('pre')
    pre.style.cssText = `background: ${palette.background}; color: ${palette.text}; border-radius: 6px; padding: 16px; overflow-x: auto; font-size: 0.875em; line-height: 1.6; margin: 0;`
    const codeEl = document.createElement('code')

    const grammar = Prism.languages[this.language]
    if (grammar) {
      codeEl.innerHTML = sanitizeCodeHtml(Prism.highlight(this.code, grammar, this.language))
    } else {
      codeEl.textContent = this.code
    }

    codeEl.style.cssText = 'font-family: monospace; white-space: pre;'
    pre.appendChild(codeEl)
    wrapper.appendChild(pre)
    return wrapper
  }
  eq(other: CodeBlockWidget) {
    return this.code === other.code && this.language === other.language
  }
  ignoreEvent() {
    return false
  }
}
