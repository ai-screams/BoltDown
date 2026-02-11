import { useCallback } from 'react'

import { useEditorStore } from '@/stores/editorStore'
import { useTabStore } from '@/stores/tabStore'
import { md } from '@/utils/markdownConfig'
import { isTauri } from '@/utils/tauri'

function buildStandaloneHtml(html: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.css">
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    color: #24292e;
    line-height: 1.6;
  }
  h1 { font-size: 2em; margin: 0.67em 0; font-weight: 600; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; margin-top: 1.5em; font-weight: 600; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
  h3 { font-size: 1.25em; margin-top: 1.25em; font-weight: 600; }
  code { background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 3px; font-size: 85%; }
  pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  blockquote { margin: 0; padding: 0 1em; color: #6a737d; border-left: 0.25em solid #dfe2e5; }
  a { color: #0366d6; text-decoration: none; }
  a:hover { text-decoration: underline; }
  img { max-width: 100%; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
  th, td { padding: 6px 13px; border: 1px solid #dfe2e5; }
  th { background: #f6f8fa; font-weight: 600; }
  hr { height: 0.25em; padding: 0; margin: 24px 0; background-color: #e1e4e8; border: 0; }
  ul, ol { padding-left: 2em; }
  .katex-block { text-align: center; margin: 1em 0; }
</style>
</head>
<body>
${html}
</body>
</html>`
}

function getActiveTab() {
  const { tabs, activeTabId } = useTabStore.getState()
  return tabs.find(t => t.id === activeTabId)
}

export function useExport() {
  const exportHtml = useCallback(async () => {
    const tab = getActiveTab()
    if (!tab) return

    const html = md.render(tab.content)
    const title = tab.fileName.replace(/\.[^.]+$/, '')
    const fullHtml = buildStandaloneHtml(html, title)

    if (isTauri()) {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { invoke } = await import('@tauri-apps/api/core')
      const path = await save({
        filters: [{ name: 'HTML', extensions: ['html'] }],
        defaultPath: `${title}.html`,
      })
      if (path) {
        await invoke('write_file', { path, content: fullHtml })
        useEditorStore.getState().flashStatus('Exported HTML')
      }
    } else {
      const blob = new Blob([fullHtml], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title}.html`
      a.click()
      URL.revokeObjectURL(url)
      useEditorStore.getState().flashStatus('Exported HTML')
    }
  }, [])

  const exportPdf = useCallback(() => {
    window.print()
  }, [])

  const copyHtml = useCallback(async () => {
    const tab = getActiveTab()
    if (!tab) return false

    const html = md.render(tab.content)
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([tab.content], { type: 'text/plain' }),
        }),
      ])
      useEditorStore.getState().flashStatus('Copied HTML')
      return true
    } catch {
      await navigator.clipboard.writeText(tab.content)
      useEditorStore.getState().flashStatus('Copied as text')
      return false
    }
  }, [])

  return { exportHtml, exportPdf, copyHtml }
}
