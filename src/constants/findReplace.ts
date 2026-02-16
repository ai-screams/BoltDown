export const FIND_REPLACE_INPUT_LIMITS = {
  searchMaxChars: 1000,
  replaceMaxChars: 10000,
} as const

export const FIND_REPLACE_SEARCH_POLICY = {
  maxResultsDisplay: 200,
  maxTotalMatches: 10000,
  debounceMs: 150,
  timeoutMs: 2000,
  statusClearMs: 2000,
} as const

export const REGEX_SAFETY_POLICY = {
  maxPatternLength: 500,
  maxCaptureGroups: 10,
  dangerousPatterns: [/\(.*[+*]\)(?:[+*]|\{)/, /\((?:[^()]*\|){3,}[^()]*\)/],
} as const

export const FIND_REPLACE_ERRORS = {
  invalidRegex: 'Invalid regex',
  replaceFailed: 'Replace failed',
  timeout: 'Search timeout - pattern may be too complex',
} as const
