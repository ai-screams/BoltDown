import { useEffect } from 'react'

import { CUSTOM_CSS_LIMITS } from '@/constants/settingsLimits'
import { useSettingsStore } from '@/stores/settingsStore'

const STYLE_ELEMENT_ID = 'boltdown-custom-css'

export function useCustomCss(): void {
  const customCss = useSettingsStore(s => s.settings.theme.customCss)

  useEffect(() => {
    const timer = setTimeout(() => {
      let el = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null

      if (!customCss) {
        el?.remove()
        return
      }

      if (!el) {
        el = document.createElement('style')
        el.id = STYLE_ELEMENT_ID
        document.head.appendChild(el)
      }

      el.textContent = customCss
    }, CUSTOM_CSS_LIMITS.debounceMs)

    return () => {
      clearTimeout(timer)
    }
  }, [customCss])

  useEffect(() => {
    return () => {
      document.getElementById(STYLE_ELEMENT_ID)?.remove()
    }
  }, [])
}
