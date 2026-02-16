import { useCallback } from 'react'

import { STATUS_TIMEOUT_MS } from '@/constants/feedback'
import { useEditorStore } from '@/stores/editorStore'
import { getActiveTabSnapshot } from '@/stores/tabStore'
import { md } from '@/utils/markdownConfig'
import { escapeHtml } from '@/utils/markdownText'
import { invokeTauri, isTauri } from '@/utils/tauri'

interface ExportThemeTokens {
  fontSans: string
  textPrimary: string
  borderDefault: string
  codeBlockBg: string
  blockquoteText: string
  blockquoteBorder: string
  linkText: string
  tableBorder: string
  hrBorder: string
}

function readCssToken(name: string): string {
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value
}

function getExportThemeTokens(): ExportThemeTokens {
  const bodyFontFamily = window.getComputedStyle(document.body).fontFamily

  return {
    fontSans: readCssToken('--p-font-sans') || bodyFontFamily,
    textPrimary: readCssToken('--s-text-primary') || readCssToken('--p-color-slate-900'),
    borderDefault: readCssToken('--s-border-default') || readCssToken('--p-color-slate-200'),
    codeBlockBg: readCssToken('--c-code-block-bg') || readCssToken('--s-bg-muted'),
    blockquoteText: readCssToken('--c-wys-blockquote-text') || readCssToken('--s-text-muted'),
    blockquoteBorder:
      readCssToken('--c-wys-blockquote-border') || readCssToken('--s-border-default'),
    linkText: readCssToken('--s-link') || readCssToken('--color-deep-blue'),
    tableBorder: readCssToken('--c-wys-table-border') || readCssToken('--s-border-default'),
    hrBorder: readCssToken('--c-wys-hr-border') || readCssToken('--s-border-default'),
  }
}

function buildStandaloneHtml(html: string, title: string, tokens: ExportThemeTokens): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.css">
<style>
  :root {
    --e-font-sans: ${tokens.fontSans};
    --e-text-primary: ${tokens.textPrimary};
    --e-border-default: ${tokens.borderDefault};
    --e-code-block-bg: ${tokens.codeBlockBg};
    --e-blockquote-text: ${tokens.blockquoteText};
    --e-blockquote-border: ${tokens.blockquoteBorder};
    --e-link-text: ${tokens.linkText};
    --e-table-border: ${tokens.tableBorder};
    --e-hr-border: ${tokens.hrBorder};
  }
  body {
    font-family: var(--e-font-sans);
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    color: rgb(var(--e-text-primary) / 1);
    line-height: 1.6;
  }
  h1 { font-size: 2em; margin: 0.67em 0; font-weight: 600; border-bottom: 1px solid rgb(var(--e-border-default) / 1); padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; margin-top: 1.5em; font-weight: 600; border-bottom: 1px solid rgb(var(--e-border-default) / 1); padding-bottom: 0.3em; }
  h3 { font-size: 1.25em; margin-top: 1.25em; font-weight: 600; }
  code { background: rgb(var(--e-code-block-bg) / 1); padding: 0.2em 0.4em; border-radius: 3px; font-size: 85%; }
  pre { background: rgb(var(--e-code-block-bg) / 1); padding: 16px; border-radius: 6px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  blockquote { margin: 0; padding: 0 1em; color: rgb(var(--e-blockquote-text) / 1); border-left: 0.25em solid rgb(var(--e-blockquote-border) / 1); }
  a { color: rgb(var(--e-link-text) / 1); text-decoration: none; }
  a:hover { text-decoration: underline; }
  img { max-width: 100%; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
  th, td { padding: 6px 13px; border: 1px solid rgb(var(--e-table-border) / 1); }
  th { background: rgb(var(--e-code-block-bg) / 1); font-weight: 600; }
  hr { height: 0.25em; padding: 0; margin: 24px 0; background-color: rgb(var(--e-hr-border) / 1); border: 0; }
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
  return getActiveTabSnapshot().tab
}

export function useExport() {
  const exportHtml = useCallback(async () => {
    const tab = getActiveTab()
    if (!tab) return

    const html = md.render(tab.content)
    const title = tab.fileName.replace(/\.[^.]+$/, '')
    const fullHtml = buildStandaloneHtml(html, title, getExportThemeTokens())

    try {
      if (isTauri()) {
        const { save } = await import('@tauri-apps/plugin-dialog')
        const path = await save({
          filters: [{ name: 'HTML', extensions: ['html'] }],
          defaultPath: `${title}.html`,
        })
        if (path) {
          await invokeTauri('write_file', { path, content: fullHtml })
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
    } catch (e) {
      console.error('Export HTML failed:', e)
      useEditorStore.getState().flashStatus('Export failed', STATUS_TIMEOUT_MS.error)
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
      try {
        await navigator.clipboard.writeText(tab.content)
        useEditorStore.getState().flashStatus('Copied as text')
        return false
      } catch (e) {
        console.error('Copy HTML failed:', e)
        useEditorStore.getState().flashStatus('Copy failed', STATUS_TIMEOUT_MS.error)
        return false
      }
    }
  }, [])

  return { exportHtml, exportPdf, copyHtml }
}
