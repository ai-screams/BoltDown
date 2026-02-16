export const THEME_MODES = ['light', 'dark', 'system'] as const

export const DEFAULT_THEME_NAME = 'bolt' as const

export const THEME_PRESETS = [
  {
    name: 'bolt',
    label: 'Bolt',
    description: 'Electric yellow with cool slate surfaces',
    swatches: ['#F8FAFC', '#FFFFFF', '#FACC15', '#0F172A', '#94A3B8'],
    info: '#2563EB',
    danger: '#DC2626',
  },
  {
    name: 'sepia',
    label: 'Sepia',
    description: 'Warm paper tones for long-form reading',
    swatches: ['#FAF4E8', '#FFFAF2', '#B47844', '#3F3021', '#7A6246'],
    info: '#4A6C94',
    danger: '#AC3A2A',
  },
  {
    name: 'nord',
    label: 'Nord',
    description: 'Calm arctic blues with muted contrast',
    swatches: ['#ECEFF4', '#E5E9F0', '#5E81AC', '#2E3440', '#4C566A'],
    info: '#4C709D',
    danger: '#BF616A',
  },
  {
    name: 'contrast',
    label: 'High Contrast',
    description: 'Maximum readability and sharp boundaries',
    swatches: ['#FFFFFF', '#FFFFFF', '#005CFF', '#101010', '#404040'],
    info: '#0046C8',
    danger: '#C80000',
  },
  {
    name: 'meadow',
    label: 'Meadow',
    description: 'Fresh pastel greens and sky blues',
    swatches: ['#98B8E1', '#DAE199', '#B9D889', '#F6EC4F', '#C0E0F6'],
    info: '#5A8CC8',
    danger: '#C33C37',
  },
  {
    name: 'vivid',
    label: 'Vivid',
    description: 'Bold deep blue with warm pop accents',
    swatches: ['#123D96', '#EEC2DA', '#EDD841', '#B4D156', '#F6B26B'],
    info: '#3264BE',
    danger: '#C8323C',
  },
] as const

const BUILT_IN_THEME_NAMES = new Set<string>(THEME_PRESETS.map(theme => theme.name))

export function isBuiltInThemeName(value: string): value is (typeof THEME_PRESETS)[number]['name'] {
  return BUILT_IN_THEME_NAMES.has(value)
}
