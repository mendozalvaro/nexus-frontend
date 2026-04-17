import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { globalStateMap } from '../../../test/setup'

const mockMaybeSingle = vi.fn()
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

mockNuxtImport('useSupabaseClient', () => () => ({
  from: mockFrom,
  auth: {
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn()
  }
}))

const mockSession = ref({
  user: { id: 'user-123', email: 'test@nexus.com', user_metadata: {} }
})

mockNuxtImport('useSupabaseSession', () => () => mockSession)
mockNuxtImport('useSessionAccess', () => () => ({
  resolveUser: vi.fn().mockResolvedValue(mockSession.value.user)
}))

describe('useAuth cache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    globalStateMap.clear()

    mockSession.value = {
      user: { id: 'user-123', email: 'test@nexus.com', user_metadata: {} }
    }

    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'user-123',
        organization_id: 'org-abc',
        role: 'admin',
        full_name: 'Test User',
        email: 'test@nexus.com'
      },
      error: null
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('no consulta perfil hasta que se llama fetchProfile', async () => {
    const { useAuth } = await import('../useAuth')

    useAuth()
    useAuth()

    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('cachea fetchProfile por 30 segundos', async () => {
    const { useAuth } = await import('../useAuth')
    const { fetchProfile } = useAuth()

    await fetchProfile()
    expect(mockFrom).toHaveBeenCalledTimes(1)

    await fetchProfile()
    expect(mockFrom).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(31_000)
    await fetchProfile()
    expect(mockFrom).toHaveBeenCalledTimes(2)
  })

  it('permite forzar refresh con force=true', async () => {
    const { useAuth } = await import('../useAuth')
    const { fetchProfile } = useAuth()

    await fetchProfile({ force: true })
    expect(mockFrom).toHaveBeenCalledTimes(1)

    await fetchProfile({ force: true })
    expect(mockFrom).toHaveBeenCalledTimes(2)
  })
})
