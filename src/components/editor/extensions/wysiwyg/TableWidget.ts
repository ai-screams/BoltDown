import { WidgetType } from '@codemirror/view'

export class TableWidget extends WidgetType {
  constructor(private tableText: string) {
    super()
  }
  toDOM() {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-table-widget'
    wrapper.style.cssText = 'padding: 8px 0; overflow-x: auto;'

    const lines = this.tableText.split('\n').filter(l => l.trim())
    if (lines.length < 2) {
      wrapper.textContent = this.tableText
      return wrapper
    }

    const parseCells = (line: string): string[] =>
      line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map(c => c.trim())

    const headers = parseCells(lines[0]!)
    const alignLine = parseCells(lines[1]!)
    const alignments = alignLine.map(cell => {
      const trimmed = cell.trim()
      if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center'
      if (trimmed.endsWith(':')) return 'right'
      return 'left'
    })

    const table = document.createElement('table')
    table.style.cssText = 'border-collapse: collapse; width: 100%; font-size: 0.9em;'

    const thead = document.createElement('thead')
    const headerRow = document.createElement('tr')
    headers.forEach((h, i) => {
      const th = document.createElement('th')
      th.textContent = h
      th.style.cssText = `border: 1px solid rgb(var(--c-wys-table-border) / 1); padding: 6px 12px; font-weight: 600; text-align: ${alignments[i] ?? 'left'}; background: var(--c-wys-table-head-bg);`
      headerRow.appendChild(th)
    })
    thead.appendChild(headerRow)
    table.appendChild(thead)

    const tbody = document.createElement('tbody')
    for (let r = 2; r < lines.length; r++) {
      const cells = parseCells(lines[r]!)
      const tr = document.createElement('tr')
      if (r % 2 === 1) {
        tr.style.background = 'var(--c-wys-table-row-alt-bg)'
      }
      cells.forEach((c, i) => {
        const td = document.createElement('td')
        td.textContent = c
        td.style.cssText = `border: 1px solid rgb(var(--c-wys-table-border) / 1); padding: 6px 12px; text-align: ${alignments[i] ?? 'left'};`
        tr.appendChild(td)
      })
      tbody.appendChild(tr)
    }
    table.appendChild(tbody)
    wrapper.appendChild(table)
    return wrapper
  }
  eq(other: TableWidget) {
    return this.tableText === other.tableText
  }
  ignoreEvent() {
    return false
  }
}
