import { clsx } from 'clsx'
import type { LucideIcon } from 'lucide-react'
import { memo } from 'react'

interface IconButtonProps {
  icon: LucideIcon
  label: string
  shortcut?: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
}

export default memo(function IconButton({
  icon: Icon,
  label,
  shortcut,
  onClick,
  active,
  disabled,
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={clsx(
        'rounded p-1.5 transition-[color,background-color,opacity,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50',
        active
          ? 'bg-electric-yellow/20 text-electric-dark'
          : 'text-fg-muted hover:bg-surface-muted hover:text-fg-secondary',
        disabled ? 'cursor-not-allowed opacity-40' : 'hover:scale-110 active:scale-95'
      )}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
      onClick={onClick}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
    </button>
  )
})
