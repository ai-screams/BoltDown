<!-- Parent: ../AGENTS.md -->

# common/ — Shared UI Primitives

## Purpose

Reusable UI components shared across multiple feature areas.

## Key Files

- `IconButton.tsx` — Themed button wrapping a Lucide icon with tooltip (aria-label), optional keyboard shortcut display, active/disabled states, and dark mode support. Used by EditorToolbar for formatting buttons.

## For AI Agents

- Props: `icon` (LucideIcon), `label` (string), `shortcut?` (string), `onClick`, `active?`, `disabled?`
- Styling uses `clsx` for conditional classes
- Active state: Electric Yellow background; Disabled: reduced opacity + cursor-not-allowed
