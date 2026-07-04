import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { globalStateMap } from '../../../test/setup'

const mockMaybeSingle = vi.fn()
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))
const mockFetch = vi.fn()
const mockSignInWithPassword = vi.fn()
const mockSignInWithOAuth = vi.fn()
const mockSignOut = vi.fn()
const mockSignUp = vi.fn()
const mockResetPasswordForEmail = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

mockNuxtImport('useSupabaseClient', () => () => ({
  from: mockFrom,
  auth: {
    signInWithPassword: mockSignInWithPassword,
    signInWithOAuth: mockSignInWithOAuth,
    signOut: mockSignOut,
    signUp: mockSignUp,
    resetPasswordForEmail: mockResetPasswordForEmail
  }
}))

const mockSession = ref({
  user: { id: 'user-123', email: 'test@nexus.com', user_metadata: {} }
})
const mockAuthenticatedUser = ref(mockSession.value.user)
const mockBootstrapState = ref<'idle' | 'resolving' | 'authenticated' | 'profile_incomplete' | 'unauthenticated'>('authenticated')

mockNuxtImport('useSupabaseSession', () => () => mockSession)
mockNuxtImport('useSessionAccess', () => () => ({
  session: mockSession,
  authenticatedUser: mockAuthenticatedUser,
  authBootstrapState: mockBootstrapState,
  resolveUser: vi.fn().mockImplementation(async () => mockSession.value.user),
  resolveAccessToken: vi.fn().mockResolvedValue('token-123'),
}))

describe('useAuth cache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    globalStateMap.clear()

    mockSession.value = {
      user: { id: 'user-123', email: 'test@nexus.com', user_metadata: {} }
    }
    mockAuthenticatedUser.value = mockSession.value.user
    mockBootstrapState.value = 'authenticated'

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
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'user-123', email: 'test@nexus.com' },
        session: { access_token: 'token-123' },
      },
      error: null,
    })
    mockSignInWithOAuth.mockResolvedValue({
      data: { provider: 'google', url: 'https://accounts.google.com' },
      error: null,
    })
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

  it('evita /api/profile en login publico', async () => {
    const { useAuth } = await import('../useAuth')
    const { signIn } = useAuth()

    const result = await signIn('test@nexus.com', '12345678', { resolveProfile: false })

    expect(result.error).toBeNull()
    expect(mockSignInWithPassword).toHaveBeenCalledTimes(1)
    expect(mockFetch).not.toHaveBeenCalledWith("/api/profile")
  })

  it('cierra sesion si una cuenta client intenta entrar por login staff y /api/profile responde 403', async () => {
    mockSession.value = {
      user: { id: 'client-123', email: 'client@nexus.com', user_metadata: { role: 'client' } }
    }
    mockAuthenticatedUser.value = mockSession.value.user
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'client-123', email: 'client@nexus.com', user_metadata: { role: 'client' } },
        session: { access_token: 'token-456' },
      },
      error: null,
    })
    mockFetch.mockRejectedValue({
      statusCode: 403,
      message: 'El perfil autenticado no tiene organization_id asignado.',
    })
    mockSignOut.mockResolvedValue({ error: null })

    const { useAuth } = await import('../useAuth')
    const { signIn } = useAuth()

    const result = await signIn('client@nexus.com', '12345678')

    expect(result.data).toBeNull()
    expect(result.error).toBe('Esta cuenta no tiene acceso al panel interno.')
    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })

  it('inicia oauth staff preservando redirect valido', async () => {
    const { useAuth } = await import('../useAuth')
    const { signInWithProvider } = useAuth()

    const result = await signInWithProvider('google', {
      audience: 'staff',
      redirect: '/inventory',
    })

    expect(result.error).toBeNull()
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:3000/auth/callback?audience=staff&redirect=%2Finventory',
      },
    })
  })
})
