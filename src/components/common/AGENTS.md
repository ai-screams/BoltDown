<!-- Parent: ../AGENTS.md -->

# common/ — Shared UI Primitives

## Purpose

Reusable UI components shared across multiple feature areas.

## Key Files

- `IconButton.tsx` — Themed button wrapping a Lucide icon with tooltip (aria-label), optional keyboard shortcut display, active/disabled states, and dark mode support. Used by EditorToolbar for formatting buttons.
- `ErrorBoundary.tsx` — React error boundary component with retry functionality. Catches rendering errors and displays fallback UI with error message and retry button. Used to wrap components that may throw errors.

## For AI Agents

- **IconButton** props: `icon` (LucideIcon), `label` (string), `shortcut?` (string), `onClick`, `active?`, `disabled?`
- IconButton styling uses `clsx` for conditional classes
- Active state: Electric Yellow background; Disabled: reduced opacity + cursor-not-allowed
- **ErrorBoundary** is a class component (required for componentDidCatch lifecycle)
- ErrorBoundary accepts optional `fallback` ReactNode and `onError` callback
- ErrorBoundary provides default fallback UI with retry button that resets error state
