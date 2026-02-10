import { useState } from 'react'

function App() {
  const [markdown, setMarkdown] = useState(
    '# Hello BoltDown! ⚡\n\nStrike through your writing at the speed of light.'
  )

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">BoltDown</h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">Lightning-Fast Markdown</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Editor Pane */}
        <div className="flex-1 border-r border-gray-200 dark:border-gray-700">
          <textarea
            value={markdown}
            onChange={e => setMarkdown(e.target.value)}
            className="w-full h-full p-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono resize-none focus:outline-none"
            placeholder="Start writing in Markdown..."
          />
        </div>

        {/* Preview Pane */}
        <div className="flex-1 p-4 bg-white dark:bg-gray-800 overflow-auto">
          <div className="prose dark:prose-invert max-w-none">
            <div dangerouslySetInnerHTML={{ __html: markdown }} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>Ready ⚡</span>
          <span>{markdown.length} characters</span>
        </div>
      </footer>
    </div>
  )
}

export default App
