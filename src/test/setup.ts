import '@testing-library/jest-dom'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
})

// Mock Tauri API
interface TauriInternals {
  metadata: {
    windows: unknown[]
    currentWindow: { label: string }
    webviews: unknown[]
    currentWebview: { label: string; windowLabel: string }
  }
  plugins: Record<string, unknown>
}

declare global {
  interface Window {
    __TAURI_INTERNALS__: TauriInternals
  }
}

window.__TAURI_INTERNALS__ = {
  metadata: {
    windows: [],
    currentWindow: { label: 'main' },
    webviews: [],
    currentWebview: { label: 'main', windowLabel: 'main' },
  },
  plugins: {},
}
