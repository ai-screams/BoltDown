import { redo, undo } from '@codemirror/commands'
import { Transaction } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { WidgetType } from '@codemirror/view'

import {
  addColumnLeft,
  addColumnRight,
  addRowAbove,
  addRowBelow,
  deleteColumn,
  deleteRow,
  normalizeCellValue,
  parseTableModel,
  resizeTable,
  serializeTableModel,
  setCellText,
  setColumnAlignment,
  type TableAlignment,
  type TableCellCoords,
  type TableModel,
} from './tableModel'

export class TableWidget extends WidgetType {
  constructor(
    private readonly tableText: string,
    private readonly tableFrom: number,
    private readonly tableTo: number
  ) {
    super()
  }

  private handleHistoryShortcut(view: EditorView, event: KeyboardEvent): boolean {
    if (event.altKey) return false

    const key = event.key.toLowerCase()
    const hasModifier = event.metaKey || event.ctrlKey
    if (!hasModifier) return false

    if (key === 'z') {
      event.preventDefault()
      event.stopPropagation()

      this.ensureSelectionNearTable(view)

      if (event.shiftKey) {
        redo(view)
      } else {
        undo(view)
      }
      return true
    }

    if (key === 'y' && !event.shiftKey) {
      event.preventDefault()
      event.stopPropagation()

      this.ensureSelectionNearTable(view)
      redo(view)
      return true
    }

    return false
  }

  private isNestedUpdateError(error: unknown): boolean {
    return error instanceof Error && error.message.includes('update is in progress')
  }

  private ensureSelectionNearTable(view: EditorView): void {
    const docLength = view.state.doc.length
    const tableStart = Math.max(0, Math.min(this.tableFrom, docLength))
    const tableEnd = Math.max(tableStart, Math.min(this.tableTo, docLength))
    const selection = view.state.selection.main

    if (selection.from >= tableStart && selection.to <= tableEnd) {
      return
    }

    view.dispatch({
      selection: { anchor: tableStart },
      scrollIntoView: false,
      annotations: Transaction.addToHistory.of(false),
    })
  }

  private dispatchModelUpdate(
    view: EditorView,
    updateModel: (model: TableModel) => TableModel,
    tableElement?: HTMLTableElement
  ): boolean {
    if (
      this.tableFrom < 0 ||
      this.tableTo > view.state.doc.length ||
      this.tableFrom >= this.tableTo
    ) {
      return false
    }

    this.ensureSelectionNearTable(view)

    const currentTableText = view.state.sliceDoc(this.tableFrom, this.tableTo)
    const parsedCurrentModel = parseTableModel(currentTableText)
    if (!parsedCurrentModel) return false

    const baseModel = tableElement
      ? this.captureModelFromDom(tableElement, parsedCurrentModel)
      : parsedCurrentModel

    const nextModel = updateModel(baseModel)
    const nextTableText = serializeTableModel(nextModel)
    if (nextTableText === currentTableText) return false

    try {
      view.dispatch({
        changes: {
          from: this.tableFrom,
          to: this.tableTo,
          insert: nextTableText,
        },
      })
    } catch (error) {
      if (!this.isNestedUpdateError(error)) {
        throw error
      }

      requestAnimationFrame(() => {
        if (!view.dom.isConnected) return
        this.dispatchModelUpdate(view, updateModel)
      })

      return true
    }

    return true
  }

  private captureModelFromDom(
    tableElement: HTMLTableElement,
    fallbackModel: TableModel
  ): TableModel {
    const nextModel: TableModel = {
      headers: [...fallbackModel.headers],
      alignments: [...fallbackModel.alignments],
      rows: fallbackModel.rows.map(row => [...row]),
    }

    const headerCells = Array.from(tableElement.querySelectorAll('thead th[data-col-index]'))
    if (headerCells.length === nextModel.headers.length) {
      nextModel.headers = headerCells.map(cell => normalizeCellValue(cell.textContent ?? ''))
    }

    const bodyRows = Array.from(tableElement.querySelectorAll('tbody tr[data-row-index]'))
    if (bodyRows.length === nextModel.rows.length) {
      nextModel.rows = bodyRows.map(row => {
        const bodyCells = Array.from(row.querySelectorAll('td[data-col-index]'))
        if (bodyCells.length !== nextModel.headers.length) {
          return new Array(nextModel.headers.length).fill('')
        }
        return bodyCells.map(cell => normalizeCellValue(cell.textContent ?? ''))
      })
    }

    return nextModel
  }

  private createEditableCell(
    view: EditorView,
    cellTag: 'th' | 'td',
    text: string,
    coords: TableCellCoords,
    alignment: TableAlignment,
    onActivate: (coords: TableCellCoords) => void,
    getTableElement: () => HTMLTableElement
  ): HTMLElement {
    const cell = document.createElement(cellTag)
    cell.textContent = text
    cell.contentEditable = 'true'
    cell.spellcheck = false
    cell.dataset.rowIndex = String(coords.rowIndex)
    cell.dataset.colIndex = String(coords.columnIndex)
    cell.style.cssText = `border: 1px solid rgb(var(--c-wys-table-border) / 1); padding: 6px 12px; text-align: ${alignment}; ${cellTag === 'th' ? 'font-weight: 600; background: var(--c-wys-table-head-bg);' : ''}`

    let committedValue = normalizeCellValue(text)

    const commit = () => {
      const nextValue = cell.textContent ?? ''
      const normalized = normalizeCellValue(nextValue)
      if (normalized === committedValue) return

      const didApplyUpdate = this.dispatchModelUpdate(
        view,
        model => setCellText(model, coords, normalized),
        getTableElement()
      )

      if (didApplyUpdate) {
        committedValue = normalized
      }
    }

    cell.addEventListener('focus', () => {
      onActivate(coords)
      this.ensureSelectionNearTable(view)
    })

    cell.addEventListener('mousedown', event => {
      event.stopPropagation()
    })

    cell.addEventListener('click', event => {
      event.stopPropagation()
      onActivate(coords)
    })

    cell.addEventListener('keydown', event => {
      const isHistoryShortcut =
        !event.altKey &&
        (event.metaKey || event.ctrlKey) &&
        (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y')

      if (isHistoryShortcut) {
        const hasDraftChanges = normalizeCellValue(cell.textContent ?? '') !== committedValue
        if (hasDraftChanges) {
          event.stopPropagation()
          return
        }
      }

      if (this.handleHistoryShortcut(view, event)) {
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        commit()
        cell.blur()
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        cell.textContent = committedValue
        cell.blur()
      }
    })

    cell.addEventListener('blur', () => {
      commit()
    })

    return cell
  }

  private createControlButton(
    label: string,
    action: string,
    onClick: () => void,
    options: {
      isActive?: boolean
      variant?: 'default' | 'danger' | 'segment'
      compact?: boolean
    } = {}
  ): HTMLButtonElement {
    const { isActive = false, variant = 'default', compact = false } = options

    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.dataset.action = action

    const borderColor =
      variant === 'danger' ? 'rgba(180, 35, 24, 0.45)' : 'rgb(var(--c-wys-table-border) / 1)'
    const background = isActive ? 'var(--c-wys-table-head-bg)' : 'var(--c-wys-bg)'
    const color = variant === 'danger' ? '#b42318' : 'var(--c-wys-text)'
    const borderRadius = variant === 'segment' ? '0' : '8px'
    const padding = compact ? '2px 8px' : '4px 10px'

    button.style.cssText = `border: 1px solid ${borderColor}; border-radius: ${borderRadius}; padding: ${padding}; font-size: 12px; line-height: 1.4; background: ${background}; color: ${color}; cursor: pointer; white-space: nowrap;`

    button.addEventListener('mousedown', event => {
      event.stopPropagation()
    })

    button.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      onClick()
    })

    return button
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-table-widget'
    wrapper.style.cssText = 'padding: 8px 0; overflow-x: auto;'

    const model = parseTableModel(this.tableText)
    if (!model) {
      wrapper.textContent = this.tableText
      return wrapper
    }

    let activeCoords: TableCellCoords = {
      rowIndex: model.rows.length > 0 ? 1 : 0,
      columnIndex: 0,
    }

    const controlsContainer = document.createElement('div')
    controlsContainer.style.cssText =
      'display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px;'

    const actionBar = document.createElement('div')
    actionBar.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px; align-items: center;'

    const resizePanel = document.createElement('div')
    resizePanel.dataset.role = 'resize-panel'
    resizePanel.style.cssText =
      'display: none; align-items: center; flex-wrap: wrap; gap: 8px; padding: 8px; border: 1px solid rgb(var(--c-wys-table-border) / 1); border-radius: 10px; background: var(--c-wys-table-head-bg);'

    const rowMenuPanel = document.createElement('div')
    rowMenuPanel.dataset.role = 'row-menu'
    rowMenuPanel.style.cssText =
      'display: none; align-items: center; flex-wrap: wrap; gap: 6px; padding: 8px; border: 1px solid rgb(var(--c-wys-table-border) / 1); border-radius: 10px; background: var(--c-wys-table-head-bg);'

    const colMenuPanel = document.createElement('div')
    colMenuPanel.dataset.role = 'col-menu'
    colMenuPanel.style.cssText =
      'display: none; align-items: center; flex-wrap: wrap; gap: 6px; padding: 8px; border: 1px solid rgb(var(--c-wys-table-border) / 1); border-radius: 10px; background: var(--c-wys-table-head-bg);'

    const colsLabel = document.createElement('label')
    colsLabel.textContent = 'Cols'
    colsLabel.style.cssText = 'font-size: 12px; color: var(--c-wys-text);'

    const colsInput = document.createElement('input')
    colsInput.type = 'number'
    colsInput.min = '1'
    colsInput.max = '99'
    colsInput.value = String(Math.max(model.headers.length, 1))
    colsInput.dataset.field = 'resize-cols'
    colsInput.style.cssText =
      'width: 64px; border: 1px solid rgb(var(--c-wys-table-border) / 1); border-radius: 6px; padding: 2px 6px; background: var(--c-wys-bg); color: var(--c-wys-text);'

    const rowsLabel = document.createElement('label')
    rowsLabel.textContent = 'Rows'
    rowsLabel.style.cssText = 'font-size: 12px; color: var(--c-wys-text);'

    const rowsInput = document.createElement('input')
    rowsInput.type = 'number'
    rowsInput.min = '1'
    rowsInput.max = '99'
    rowsInput.value = String(Math.max(model.rows.length, 1))
    rowsInput.dataset.field = 'resize-rows'
    rowsInput.style.cssText =
      'width: 64px; border: 1px solid rgb(var(--c-wys-table-border) / 1); border-radius: 6px; padding: 2px 6px; background: var(--c-wys-bg); color: var(--c-wys-text);'

    const table = document.createElement('table')
    table.style.cssText = 'border-collapse: collapse; width: 100%; font-size: 0.9em;'

    type PanelKind = 'resize' | 'row' | 'col'
    const panels: Record<PanelKind, HTMLDivElement> = {
      resize: resizePanel,
      row: rowMenuPanel,
      col: colMenuPanel,
    }

    const isPanelOpen = (panel: PanelKind): boolean => panels[panel].style.display !== 'none'

    const setPanelOpen = (panel: PanelKind, open: boolean): void => {
      panels[panel].style.display = open ? 'flex' : 'none'
    }

    const closeAllPanels = (): void => {
      setPanelOpen('resize', false)
      setPanelOpen('row', false)
      setPanelOpen('col', false)
    }

    const togglePanel = (panel: PanelKind): void => {
      const shouldOpen = !isPanelOpen(panel)
      closeAllPanels()
      setPanelOpen(panel, shouldOpen)
    }

    const getActiveColumnIndex = (): number => {
      if (model.headers.length <= 1) return 0
      return Math.max(0, Math.min(activeCoords.columnIndex, model.headers.length - 1))
    }

    const getActiveBodyRowIndex = (): number => {
      if (model.rows.length === 0) return 0
      return Math.max(0, Math.min(activeCoords.rowIndex - 1, model.rows.length - 1))
    }

    const applyControlAction = (updater: (nextModel: TableModel) => TableModel): boolean => {
      return this.dispatchModelUpdate(view, updater, table)
    }

    const applyResize = (): void => {
      const nextCols = Number.parseInt(colsInput.value, 10)
      const nextRows = Number.parseInt(rowsInput.value, 10)
      if (!Number.isFinite(nextCols) || !Number.isFinite(nextRows)) return

      applyControlAction(nextModel =>
        resizeTable(nextModel, Math.max(1, nextRows), Math.max(1, nextCols))
      )
      closeAllPanels()
    }

    actionBar.appendChild(
      this.createControlButton('Resize', 'toggle-resize-panel', () => {
        colsInput.value = String(Math.max(model.headers.length, 1))
        rowsInput.value = String(Math.max(model.rows.length, 1))
        togglePanel('resize')
      })
    )

    actionBar.appendChild(
      this.createControlButton('Row', 'toggle-row-menu', () => {
        togglePanel('row')
      })
    )

    actionBar.appendChild(
      this.createControlButton('Col', 'toggle-col-menu', () => {
        togglePanel('col')
      })
    )

    const alignGroup = document.createElement('div')
    alignGroup.style.cssText =
      'display: inline-flex; overflow: hidden; border: 1px solid rgb(var(--c-wys-table-border) / 1); border-radius: 8px;'

    const alignLeftButton = this.createControlButton(
      'L',
      'align-left',
      () => {
        applyControlAction(nextModel =>
          setColumnAlignment(nextModel, getActiveColumnIndex(), 'left')
        )
      },
      {
        isActive: false,
        variant: 'segment',
        compact: true,
      }
    )
    const alignCenterButton = this.createControlButton(
      'C',
      'align-center',
      () => {
        applyControlAction(nextModel =>
          setColumnAlignment(nextModel, getActiveColumnIndex(), 'center')
        )
      },
      {
        isActive: false,
        variant: 'segment',
        compact: true,
      }
    )
    const alignRightButton = this.createControlButton(
      'R',
      'align-right',
      () => {
        applyControlAction(nextModel =>
          setColumnAlignment(nextModel, getActiveColumnIndex(), 'right')
        )
      },
      {
        isActive: false,
        variant: 'segment',
        compact: true,
      }
    )

    const setAlignmentButtonsActive = (alignment: TableAlignment): void => {
      const applyState = (button: HTMLButtonElement, active: boolean): void => {
        button.dataset.active = active ? 'true' : 'false'
        button.style.background = active ? 'var(--c-wys-table-head-bg)' : 'var(--c-wys-bg)'
      }

      applyState(alignLeftButton, alignment === 'left')
      applyState(alignCenterButton, alignment === 'center')
      applyState(alignRightButton, alignment === 'right')
    }

    alignGroup.appendChild(alignLeftButton)
    alignGroup.appendChild(alignCenterButton)
    alignGroup.appendChild(alignRightButton)
    setAlignmentButtonsActive(model.alignments[getActiveColumnIndex()] ?? 'left')

    actionBar.appendChild(alignGroup)

    rowMenuPanel.appendChild(
      this.createControlButton(
        '+ Above',
        'add-row-above',
        () => {
          applyControlAction(nextModel => addRowAbove(nextModel, getActiveBodyRowIndex()))
          closeAllPanels()
        },
        { compact: true }
      )
    )
    rowMenuPanel.appendChild(
      this.createControlButton(
        '+ Below',
        'add-row-below',
        () => {
          applyControlAction(nextModel => addRowBelow(nextModel, getActiveBodyRowIndex()))
          closeAllPanels()
        },
        { compact: true }
      )
    )
    rowMenuPanel.appendChild(
      this.createControlButton(
        'Delete row',
        'delete-row',
        () => {
          applyControlAction(nextModel => deleteRow(nextModel, getActiveBodyRowIndex()))
          closeAllPanels()
        },
        { variant: 'danger', compact: true }
      )
    )

    colMenuPanel.appendChild(
      this.createControlButton(
        '+ Left',
        'add-col-left',
        () => {
          applyControlAction(nextModel => addColumnLeft(nextModel, getActiveColumnIndex()))
          closeAllPanels()
        },
        { compact: true }
      )
    )
    colMenuPanel.appendChild(
      this.createControlButton(
        '+ Right',
        'add-col-right',
        () => {
          applyControlAction(nextModel => addColumnRight(nextModel, getActiveColumnIndex()))
          closeAllPanels()
        },
        { compact: true }
      )
    )
    colMenuPanel.appendChild(
      this.createControlButton(
        'Delete col',
        'delete-col',
        () => {
          applyControlAction(nextModel => deleteColumn(nextModel, getActiveColumnIndex()))
          closeAllPanels()
        },
        { variant: 'danger', compact: true }
      )
    )

    colsLabel.appendChild(colsInput)
    rowsLabel.appendChild(rowsInput)
    resizePanel.appendChild(colsLabel)
    resizePanel.appendChild(rowsLabel)
    resizePanel.appendChild(
      this.createControlButton('Apply', 'apply-resize', applyResize, { compact: true })
    )
    actionBar.appendChild(
      this.createControlButton(
        'Close',
        'close-panels',
        () => {
          closeAllPanels()
        },
        {
          compact: true,
        }
      )
    )
    resizePanel.appendChild(
      this.createControlButton('Cancel', 'cancel-resize', closeAllPanels, { compact: true })
    )

    colsInput.addEventListener('keydown', event => {
      if (this.handleHistoryShortcut(view, event)) {
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        applyResize()
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeAllPanels()
      }
    })

    rowsInput.addEventListener('keydown', event => {
      if (this.handleHistoryShortcut(view, event)) {
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        applyResize()
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeAllPanels()
      }
    })

    controlsContainer.appendChild(actionBar)
    controlsContainer.appendChild(rowMenuPanel)
    controlsContainer.appendChild(colMenuPanel)
    controlsContainer.appendChild(resizePanel)

    wrapper.addEventListener('keydown', event => {
      this.handleHistoryShortcut(view, event)
    })

    wrapper.appendChild(controlsContainer)

    const setActiveCoords = (coords: TableCellCoords): void => {
      activeCoords = coords
      const activeAlignment = model.alignments[getActiveColumnIndex()] ?? 'left'
      setAlignmentButtonsActive(activeAlignment)
    }

    const thead = document.createElement('thead')
    const headerRow = document.createElement('tr')
    model.headers.forEach((header, columnIndex) => {
      const alignment = model.alignments[columnIndex] ?? 'left'
      const headerCell = this.createEditableCell(
        view,
        'th',
        header,
        { rowIndex: 0, columnIndex },
        alignment,
        setActiveCoords,
        () => table
      )
      headerRow.appendChild(headerCell)
    })
    thead.appendChild(headerRow)
    table.appendChild(thead)

    const tbody = document.createElement('tbody')
    model.rows.forEach((row, bodyIndex) => {
      const rowElement = document.createElement('tr')
      rowElement.dataset.rowIndex = String(bodyIndex)
      if (bodyIndex % 2 === 0) {
        rowElement.style.background = 'var(--c-wys-table-row-alt-bg)'
      }

      row.forEach((cellText, columnIndex) => {
        const alignment = model.alignments[columnIndex] ?? 'left'
        const bodyCell = this.createEditableCell(
          view,
          'td',
          cellText,
          { rowIndex: bodyIndex + 1, columnIndex },
          alignment,
          setActiveCoords,
          () => table
        )
        rowElement.appendChild(bodyCell)
      })

      tbody.appendChild(rowElement)
    })

    table.appendChild(tbody)
    wrapper.appendChild(table)
    return wrapper
  }

  eq(other: TableWidget): boolean {
    return (
      this.tableText === other.tableText &&
      this.tableFrom === other.tableFrom &&
      this.tableTo === other.tableTo
    )
  }

  ignoreEvent(_event: Event): boolean {
    return true
  }
}
