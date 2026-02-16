export const FILE_DEFAULTS = {
  untitledName: 'Untitled.md',
} as const

export const FILE_POLICY = {
  maxCopyAttempts: 100,
} as const

const markdownExtensions = ['md', 'markdown', 'txt'] as const

export const MARKDOWN_FILE_TYPES = {
  extensions: markdownExtensions,
  inputAccept: markdownExtensions.map(ext => `.${ext}`).join(','),
} as const

export const IMAGE_POLICY = {
  maxBytes: 10 * 1024 * 1024,
} as const

export const BYTES_PER_MEGABYTE = 1024 * 1024
