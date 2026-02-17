import DOMPurify from 'dompurify'

// -- KaTeX MathML elements --
const MATHML_TAGS = [
  'math',
  'semantics',
  'mrow',
  'mi',
  'mo',
  'mn',
  'ms',
  'mtext',
  'mspace',
  'msup',
  'msub',
  'msubsup',
  'mfrac',
  'mroot',
  'msqrt',
  'mover',
  'munder',
  'munderover',
  'mtable',
  'mtr',
  'mtd',
  'menclose',
  'mpadded',
  'mphantom',
  'annotation',
  'annotation-xml',
]

// -- KaTeX SVG elements --
const KATEX_SVG_TAGS = ['svg', 'line', 'path', 'g', 'rect']

// -- Attributes needed by KaTeX + scroll-sync --
const EXTRA_ATTRS = [
  // MathML
  'xmlns',
  'mathvariant',
  'encoding',
  'displaystyle',
  'scriptlevel',
  'columnalign',
  'rowspacing',
  'columnspacing',
  'fence',
  'stretchy',
  'symmetric',
  'lspace',
  'rspace',
  'movablelimits',
  'accent',
  'accentunder',
  // SVG
  'viewBox',
  'preserveAspectRatio',
  'd',
  'x1',
  'y1',
  'x2',
  'y2',
  'fill',
  'stroke',
  'stroke-width',
  'transform',
  // General
  'style',
  'aria-hidden',
  'role',
]

/**
 * Sanitize markdown preview HTML.
 * Allows KaTeX (MathML + SVG), standard HTML, and data-* attributes for scroll sync.
 */
export function sanitizePreviewHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: [...MATHML_TAGS, ...KATEX_SVG_TAGS],
    ADD_ATTR: EXTRA_ATTRS,
    ALLOW_DATA_ATTR: true,
  })
}

/** Sanitize KaTeX rendered output (WYSIWYG widgets). */
export function sanitizeKatexHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: [...MATHML_TAGS, ...KATEX_SVG_TAGS],
    ADD_ATTR: EXTRA_ATTRS,
  })
}

/** Sanitize Prism.js highlighted code output (WYSIWYG widgets). */
export function sanitizeCodeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['span', 'br'],
    ALLOWED_ATTR: ['class', 'style'],
  })
}

/** Sanitize Mermaid/SVG output. */
export function sanitizeSvgHtml(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['foreignObject', 'style'],
    ADD_ATTR: ['style', 'class', 'aria-hidden', 'role', 'xmlns', 'xmlns:xlink'],
  })
}

/**
 * Filter dangerous patterns from custom CSS.
 * Blocks external resource loading and JS execution vectors.
 */
export function sanitizeCustomCss(css: string): string {
  return css
    .replace(/@import\b[^;]*;?/gi, '/* blocked: @import */')
    .replace(/url\s*\(\s*(['"]?)\s*(?:https?:|\/\/)/gi, "url($1about:invalid'")
    .replace(/javascript\s*:/gi, '/* blocked */')
    .replace(/expression\s*\(/gi, '/* blocked */(')
    .replace(/-moz-binding\s*:/gi, '/* blocked */:')
    .replace(/behavior\s*:/gi, '/* blocked */:')
}
