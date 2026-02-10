import { useMemo } from 'react'

import { md } from '@/utils/markdownConfig'

export function useMarkdownParser(content: string): string {
  return useMemo(() => md.render(content), [content])
}
