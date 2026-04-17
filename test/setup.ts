import { vi } from 'vitest'
import { ref } from 'vue'

// Mapa global para useState - exportado para que los tests puedan limpiarlo
export const globalStateMap = new Map()

// Helper global requerido por @nuxtjs/color-mode en runtime de pruebas
if (typeof window !== 'undefined') {
  ;(window as Window & { __NUXT_COLOR_MODE__?: unknown }).__NUXT_COLOR_MODE__ = {
    preference: 'light',
    value: 'light',
    getColorScheme: () => 'light',
    addColorScheme: () => {},
    removeColorScheme: () => {}
  }
}

// Mock global de #imports para useState
vi.mock('#imports', async (importOriginal) => {
  const mod = await importOriginal()
  return {
    ...mod,
    useState: <T>(key: string, init?: () => T) => {
      if (!globalStateMap.has(key)) {
        globalStateMap.set(key, ref(init ? init() : undefined))
      }
      return globalStateMap.get(key)
    }
  }
})
