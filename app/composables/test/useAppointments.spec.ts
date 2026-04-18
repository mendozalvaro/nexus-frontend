import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { globalStateMap } from '../../../test/setup'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

mockNuxtImport('useSupabaseClient', () => () => ({ from: vi.fn() }))
mockNuxtImport('useSessionAccess', () => () => ({
  resolveAccessToken: vi.fn().mockResolvedValue('token-abc')
}))
mockNuxtImport('useAuth', () => () => ({
  profile: ref({
    id: 'user-123',
    organization_id: 'org-abc',
    role: 'manager' as const,
    branch_id: 'branch-1'
  }),
  fetchProfile: vi.fn().mockResolvedValue({
    id: 'user-123',
    organization_id: 'org-abc',
    role: 'manager',
    branch_id: 'branch-1'
  })
}))

describe('useAppointments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalStateMap.clear()
  })

  it('crea filtros por defecto', async () => {
    const { useAppointments } = await import('../useAppointments')
    const appointments = useAppointments()

    const filters = appointments.createDefaultFilters()
    expect(filters.view).toBe('week')
    expect(filters.status).toBe('all')
    expect(filters.anchorDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('calcula rango diario', async () => {
    const { useAppointments } = await import('../useAppointments')
    const appointments = useAppointments()

    const range = appointments.getDateRange('day', '2024-01-15')
    const start = new Date(range.startIso).getTime()
    const end = new Date(range.endIso).getTime()

    expect(end).toBeGreaterThan(start)
    expect(end - start).toBeGreaterThanOrEqual(86_399_000)
    expect(end - start).toBeLessThanOrEqual(86_399_999)
  })

  it('carga catálogo en scope client vía API', async () => {
    const { useAppointments } = await import('../useAppointments')
    const appointments = useAppointments()

    mockFetch.mockResolvedValueOnce({
      organizationId: 'org-abc',
      branches: [{ id: 'branch-1', name: 'Sucursal 1', code: 'S1', address: null }],
      services: [{ id: 'serv-1', name: 'Servicio 1', duration_minutes: 60, price: 100 }],
      employees: [{ id: 'emp-1', full_name: 'Empleado 1', branch_id: 'branch-1', role: 'employee' }]
    })

    const catalog = await appointments.loadCatalog('client')

    expect(mockFetch).toHaveBeenCalledWith('/api/appointments/client-catalog', {
      headers: { Authorization: 'Bearer token-abc' }
    })
    expect(catalog.organizationId).toBe('org-abc')
    expect(catalog.branches).toHaveLength(1)
    expect(catalog.services).toHaveLength(1)
    expect(catalog.branches[0]!.label).toBe('Sucursal 1')
    expect(catalog.services[0]!.value).toBe('serv-1')
  })

  it('actualiza estado de cita por API', async () => {
    const { useAppointments } = await import('../useAppointments')
    const appointments = useAppointments()

    mockFetch.mockResolvedValueOnce({
      success: true,
      appointmentId: 'appt-1',
      status: 'in_progress'
    })

    const result = await appointments.updateAppointmentStatus('appt-1', { status: 'in_progress' })

    expect(mockFetch).toHaveBeenCalledWith('/api/appointments/appt-1/status', {
      method: 'POST',
      headers: { Authorization: 'Bearer token-abc' },
      body: { status: 'in_progress' }
    })
    expect(result.status).toBe('in_progress')
  })
})
