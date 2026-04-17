import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    globals: true,
    setupFiles: ['test/setup.ts'],
    env: {
      NUXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NUXT_PUBLIC_SUPABASE_KEY: 'test-key'
    }
  }
})
