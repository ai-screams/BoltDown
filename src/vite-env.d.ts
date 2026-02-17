/// <reference types="vite/client" />

// Build-time constants injected via vite.config.ts `define`
declare const __APP_VERSION__: string

// Environment variables type definitions
interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  readonly VITE_APP_VERSION: string
  // Add more env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
