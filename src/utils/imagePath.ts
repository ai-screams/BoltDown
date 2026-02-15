import { convertFileSrc } from '@tauri-apps/api/core'

import { isTauri } from './tauri'

function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/')
}

function getDirectoryPath(filePath: string): string {
  const slash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  if (slash === -1) return ''
  if (slash === 0) return filePath[0]!
  return filePath.slice(0, slash)
}

function joinPath(dir: string, name: string): string {
  if (!dir) return name
  const separator = dir.includes('\\') ? '\\' : '/'
  const needsSeparator = !dir.endsWith('/') && !dir.endsWith('\\')
  return `${dir}${needsSeparator ? separator : ''}${name}`
}

function isAbsoluteFilePath(filePath: string): boolean {
  return filePath.startsWith('/') || filePath.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(filePath)
}

function isWebUrl(value: string): boolean {
  if (isAbsoluteFilePath(value)) return false
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value) || value.startsWith('//')
}

function safeDecodeUri(value: string): string {
  try {
    return decodeURI(value)
  } catch {
    return value
  }
}

function toFileUrl(filePath: string): string {
  const normalized = toPosixPath(filePath)

  if (/^[A-Za-z]:\//.test(normalized)) {
    return `file:///${encodeURI(normalized)}`
  }

  if (normalized.startsWith('//')) {
    return `file:${encodeURI(normalized)}`
  }

  return `file://${encodeURI(normalized)}`
}

function fromFileUrl(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl)
    if (url.protocol !== 'file:') return null

    let path = decodeURIComponent(url.pathname)
    if (/^\/[A-Za-z]:\//.test(path)) {
      path = path.slice(1)
    }

    if (url.hostname && url.hostname !== 'localhost') {
      return `//${url.hostname}${path}`
    }

    return path
  } catch {
    return null
  }
}

function resolveRelativePath(markdownFilePath: string, relativePath: string): string | null {
  try {
    const markdownDir = getDirectoryPath(markdownFilePath)
    const basePath = joinPath(markdownDir, '__base__.md')
    const resolvedUrl = new URL(relativePath, toFileUrl(basePath))
    return fromFileUrl(resolvedUrl.toString())
  } catch {
    return null
  }
}

export function normalizeMarkdownUrl(url: string): string {
  const trimmed = url.trim()
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

export function resolveImageSrcForDisplay(rawUrl: string, markdownFilePath: string | null): string {
  const normalized = normalizeMarkdownUrl(rawUrl)
  if (!normalized) return normalized

  if (!isTauri()) return normalized

  if (normalized.startsWith('asset:') || normalized.startsWith('http://asset.localhost')) {
    return normalized
  }

  const fileUrlPath = normalized.startsWith('file://') ? fromFileUrl(normalized) : null
  if (fileUrlPath) {
    return convertFileSrc(fileUrlPath)
  }

  if (isAbsoluteFilePath(normalized)) {
    return convertFileSrc(safeDecodeUri(normalized))
  }

  if (isWebUrl(normalized)) {
    return normalized
  }

  if (!markdownFilePath) {
    return normalized
  }

  const resolvedPath = resolveRelativePath(markdownFilePath, normalized)
  if (!resolvedPath) return normalized

  return convertFileSrc(safeDecodeUri(resolvedPath))
}
