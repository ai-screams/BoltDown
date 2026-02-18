import { describe, expect, it } from 'vitest'

import { md } from '@/utils/markdownConfig'
import { sanitizePreviewHtml } from '@/utils/sanitize'

describe('markdown task list rendering', () => {
  it('renders unchecked and checked task markers as disabled checkboxes', () => {
    const html = md.render('- [ ] todo\n- [x] done')

    expect(html).toMatch(/<ul[^>]*class="[^"]*\bcontains-task-list\b[^"]*"/)
    expect(html).toMatch(/<li[^>]*class="[^"]*\btask-list-item\b[^"]*"/)
    expect(html).toContain('<input class="task-list-item-checkbox" type="checkbox" disabled>')
    expect(html).toContain(
      '<input class="task-list-item-checkbox" type="checkbox" checked disabled>'
    )
    expect(html).not.toContain('contains-task-list contains-task-list')
    expect(html).not.toContain('[ ]')
    expect(html).not.toContain('[x]')
  })

  it('renders ordered task lists with checkbox inputs', () => {
    const html = md.render('1. [ ] first\n2. [x] second')

    expect(html).toMatch(/<ol[^>]*class="[^"]*\bcontains-task-list\b[^"]*"/)
    expect(html).toMatch(/<li[^>]*class="[^"]*\btask-list-item\b[^"]*"/)
    expect(html).toContain('<input class="task-list-item-checkbox" type="checkbox" disabled>')
    expect(html).toContain(
      '<input class="task-list-item-checkbox" type="checkbox" checked disabled>'
    )
    expect(html).not.toContain('contains-task-list contains-task-list')
  })

  it('keeps task checkboxes after preview sanitization', () => {
    const rawHtml = md.render('- [ ] safe\n- [x] done')
    const sanitizedHtml = sanitizePreviewHtml(rawHtml)

    expect(sanitizedHtml).toContain('task-list-item-checkbox')
    expect(sanitizedHtml).toContain('type="checkbox"')
  })
})
