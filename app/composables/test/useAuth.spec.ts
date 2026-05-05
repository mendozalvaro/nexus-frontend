import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { globalStateMap } from '../../../test/setup'

const mockMaybeSingle = vi.fn()
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))
const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

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

    const profileData = {
      id: 'user-123',
      organization_id: 'org-abc',
      role: 'admin',
      full_name: 'Test User',
      email: 'test@nexus.com'
    }

    mockMaybeSingle.mockResolvedValue({
      data: profileData,
      error: null,
    })

    mockFetch.mockResolvedValue(profileData)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('no consulta perfil hasta que se llama fetchProfile', async () => {
    const { useAuth } = await import('../useAuth')

    useAuth()
    useAuth()

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('cachea fetchProfile por 30 segundos', async () => {
    const { useAuth } = await import('../useAuth')
    const { fetchProfile } = useAuth()

    await fetchProfile()
    const callsAfterFirst = mockFetch.mock.calls.length
    expect(callsAfterFirst).toBeGreaterThanOrEqual(1)

    await fetchProfile()
    expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(callsAfterFirst + 1)

    vi.advanceTimersByTime(31_000)
    await fetchProfile()
    expect(mockFetch.mock.calls.length).toBeGreaterThan(callsAfterFirst)
  })

  it('permite forzar refresh con force=true', async () => {
    const { useAuth } = await import('../useAuth')
    const { fetchProfile } = useAuth()

    await fetchProfile({ force: true })
    expect(mockFetch).toHaveBeenCalledTimes(1)

    await fetchProfile({ force: true })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
