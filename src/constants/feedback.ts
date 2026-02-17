export const STATUS_TIMEOUT_MS = {
  default: 2000,
  error: 3000,
  warning: 4000,
  critical: 5000,
} as const

export const DOCUMENT_STATS_POLICY = {
  debounceMs: 500,
  readingWordsPerMinute: 225,
} as const
