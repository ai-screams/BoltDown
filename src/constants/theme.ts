export const THEME_MODES = ['light', 'dark', 'system'] as const

export const DEFAULT_THEME_NAME = 'bolt' as const

export const THEME_PRESETS = [
  {
    name: 'bolt',
    label: 'Bolt',
    description: 'Electric yellow with cool slate surfaces',
    swatches: ['#FACC15', '#1E3A8A', '#0F172A'],
  },
  {
    name: 'sepia',
    label: 'Sepia',
    description: 'Warm paper tones for long-form reading',
    swatches: ['#B47844', '#F3E8D6', '#3F3021'],
  },
  {
    name: 'nord',
    label: 'Nord',
    description: 'Calm arctic blues with muted contrast',
    swatches: ['#5E81AC', '#D8DEE9', '#2E3440'],
  },
  {
    name: 'contrast',
    label: 'High Contrast',
    description: 'Maximum readability and sharp boundaries',
    swatches: ['#005CFF', '#FFFFFF', '#101010'],
  },
] as const

const BUILT_IN_THEME_NAMES = new Set<string>(THEME_PRESETS.map(theme => theme.name))

export function isBuiltInThemeName(value: string): value is (typeof THEME_PRESETS)[number]['name'] {
  return BUILT_IN_THEME_NAMES.has(value)
}
