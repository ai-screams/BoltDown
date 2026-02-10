interface FooterProps {
  charCount: number
  wordCount: number
  readingTime: number
}

export default function Footer({ charCount, wordCount, readingTime }: FooterProps) {
  return (
    <footer className="flex h-8 items-center justify-between border-t border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-800">
      <span className="text-xs text-thunder-gray">Ready ⚡</span>
      <span className="text-xs text-thunder-gray">
        {wordCount} words · {readingTime} min read · {charCount} chars
      </span>
    </footer>
  )
}
