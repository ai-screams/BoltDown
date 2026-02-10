import { useState } from 'react'

function App() {
  const [markdown, setMarkdown] = useState(
    '# Hello BoltDown! ⚡\n\nStrike through your writing at the speed of light.'
  )

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">BoltDown</h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">Lightning-Fast Markdown</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden">
        {/* Editor Pane */}
        <div className="flex-1 border-r border-gray-200 dark:border-gray-700">
          <textarea
            value={markdown}
            onChange={e => setMarkdown(e.target.value)}
            className="h-full w-full resize-none bg-white p-4 font-mono text-gray-900 focus:outline-none dark:bg-gray-800 dark:text-white"
            placeholder="Start writing in Markdown..."
          />
        </div>

        {/* Preview Pane */}
        <div className="flex-1 overflow-auto bg-white p-4 dark:bg-gray-800">
          <div className="prose dark:prose-invert max-w-none">
            <div dangerouslySetInnerHTML={{ __html: markdown }} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>Ready ⚡</span>
          <span>{markdown.length} characters</span>
        </div>
      </footer>
    </div>
  )
}

export default App
