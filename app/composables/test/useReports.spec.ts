import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { globalStateMap } from '../../../test/setup'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

const mockProfile = ref({
  id: 'user-123',
  organization_id: 'org-abc',
  role: 'admin' as const
})

const mockUser = ref({ id: 'user-123' })
const mockResolveAccessToken = vi.fn().mockResolvedValue('token-123')

mockNuxtImport('useSupabaseClient', () => () => ({ from: vi.fn() }))
mockNuxtImport('useSessionAccess', () => () => ({
  resolveAccessToken: mockResolveAccessToken
}))
mockNuxtImport('useAuth', () => () => ({
  profile: mockProfile,
  user: mockUser,
  fetchProfile: vi.fn().mockResolvedValue(mockProfile.value)
}))
mockNuxtImport('useUserContext', () => () => ({
  profile: mockProfile,
  user: mockUser,
  ensureContext: vi.fn().mockResolvedValue({
    profile: mockProfile.value,
    user: mockUser.value
  })
}))
mockNuxtImport('usePermissions', () => () => ({
  getAccessibleBranches: vi.fn().mockResolvedValue([
    { id: 'branch-1', name: 'Sucursal 1' },
    { id: 'branch-2', name: 'Sucursal 2' }
  ])
}))
mockNuxtImport('useSubscription', () => () => ({
  capabilities: ref(null),
  loadCapabilities: vi.fn().mockResolvedValue(undefined)
}))

describe('useReports', () => {
  beforeEach(() => {
    globalStateMap.clear()
    mockResolveAccessToken.mockResolvedValue('token-123')
    mockProfile.value = {
      id: 'user-123',
      organization_id: 'org-abc',
      role: 'admin'
    }
  })

  it('formatea moneda en BOB', async () => {
    const { useReports } = await import('../useReports')
    const reports = useReports()

    expect(reports.formatCurrency(100)).toContain('Bs')
    expect(reports.formatCurrency(759.5)).toContain('759,50')
  })

  it('formatea numero entero', async () => {
    const { useReports } = await import('../useReports')
    const reports = useReports()

    expect(reports.formatInteger(1000)).toBe('1.000')
    expect(reports.formatInteger(6)).toBe('6')
  })

  it('formatea porcentaje', async () => {
    const { useReports } = await import('../useReports')
    const reports = useReports()

    expect(reports.formatPercent(0.67)).toContain('67')
    expect(reports.formatPercent(0)).toContain('0')
  })

  it('genera filtros por defecto con rango de 30 dias', async () => {
    const { useReports } = await import('../useReports')
    const reports = useReports()

    const filters = reports.getDefaultFilters()

    expect(filters.branchIds).toEqual([])
    expect(filters.employeeId).toBe(null)
    expect(filters.paymentMethod).toBe('all')
    expect(filters.categoryIds).toEqual([])
    expect(filters.startDate).toBeDefined()
    expect(filters.endDate).toBeDefined()
  })

  it('asigna branch al manager', async () => {
    const { useReports } = await import('../useReports')
    const reports = useReports()

    const filters = reports.getDefaultFilters({
      role: 'manager',
      assignedBranchId: 'branch-1'
    })

    expect(filters.branchIds).toEqual(['branch-1'])
  })

  it('tiene labels de metodos de pago', async () => {
    const { useReports } = await import('../useReports')
    const reports = useReports()

    expect(reports.PAYMENT_METHOD_LABELS.cash).toBe('Efectivo')
    expect(reports.PAYMENT_METHOD_LABELS.card).toBe('Tarjeta')
    expect(reports.PAYMENT_METHOD_LABELS.digital_wallet).toBe('Billetera digital')
    expect(reports.PAYMENT_METHOD_LABELS.mixed).toBe('Mixto')
    expect(reports.PAYMENT_METHOD_LABELS.transfer).toBe('Transferencia')
    expect(reports.PAYMENT_METHOD_LABELS.all).toBe('Todos los metodos')
  })

  it('carga overview report con contexto y filtros', async () => {
    const { useReports } = await import('../useReports')
    const reports = useReports()

    mockFetch.mockResolvedValueOnce({
      kpis: [
        { label: 'Ventas netas', value: 'Bs 760', tone: 'primary', meta: '6 transacciones' }
      ],
      salesTrend: [
        { label: '2026-05-17', value: 760 }
      ],
      paymentMix: [
        { label: 'cash', value: 760 }
      ],
      appointmentStatusMix: [],
      branchComparison: [],
      topHighlights: [],
      canCompareBranches: false,
      filterOptions: {
        branches: [],
        employees: [],
        productCategories: [],
        serviceCategories: [],
        paymentMethods: []
      }
    })

    const result = await reports.loadOverviewReport({
      startDate: '2026-05-01',
      endDate: '2026-05-19'
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/reports/overview', expect.objectContaining({
      headers: { Authorization: 'Bearer token-123' },
      query: expect.objectContaining({
        startDate: '2026-05-01',
        endDate: '2026-05-19'
      })
    }))
    expect(result.kpis).toHaveLength(1)
    expect(result.context).toBeDefined()
    expect(result.filters.startDate).toBe('2026-05-01')
  })

  it('carga sales report', async () => {
    const { useReports } = await import('../useReports')
    const reports = useReports()

    mockFetch.mockResolvedValueOnce({
      kpis: [],
      salesTrend: [],
      paymentBreakdown: [],
      branchBreakdown: [],
      employeeBreakdown: [],
      transactionsTable: [],
      filterOptions: {
        branches: [],
        employees: [],
        productCategories: [],
        serviceCategories: [],
        paymentMethods: []
      }
    })

    const result = await reports.loadSalesReport()

    expect(mockFetch).toHaveBeenCalledWith('/api/reports/sales', expect.any(Object))
    expect(result.transactionsTable).toBeDefined()
  })

  it('carga products report', async () => {
    const { useReports } = await import('../useReports')
    const reports = useReports()

    mockFetch.mockResolvedValueOnce({
      kpis: [],
      topProducts: [],
      rotation: [],
      lowStock: [],
      movementSummary: [],
      tableRows: [],
      filterOptions: {
        branches: [],
        employees: [],
        productCategories: [],
        serviceCategories: [],
        paymentMethods: []
      }
    })

    const result = await reports.loadProductsReport()

    expect(mockFetch).toHaveBeenCalledWith('/api/reports/products', expect.any(Object))
    expect(result.tableRows).toBeDefined()
  })

  it('carga services report', async () => {
    const { useReports } = await import('../useReports')
    const reports = useReports()

    mockFetch.mockResolvedValueOnce({
      kpis: [],
      topServices: [],
      employeeProductivity: [],
      serviceMix: [],
      tableRows: [],
      filterOptions: {
        branches: [],
        employees: [],
        productCategories: [],
        serviceCategories: [],
        paymentMethods: []
      }
    })

    const result = await reports.loadServicesReport()

    expect(mockFetch).toHaveBeenCalledWith('/api/reports/services', expect.any(Object))
    expect(result.tableRows).toBeDefined()
  })

  it('carga appointments report', async () => {
    const { useReports } = await import('../useReports')
    const reports = useReports()

    mockFetch.mockResolvedValueOnce({
      kpis: [],
      statusBreakdown: [],
      employeeOccupancy: [],
      serviceDemand: [],
      tableRows: [],
      filterOptions: {
        branches: [],
        employees: [],
        productCategories: [],
        serviceCategories: [],
        paymentMethods: []
      }
    })

    const result = await reports.loadAppointmentsReport()

    expect(mockFetch).toHaveBeenCalledWith('/api/reports/appointments', expect.any(Object))
    expect(result.tableRows).toBeDefined()
  })

  it('invierte fechas si startDate > endDate', async () => {
    const { useReports } = await import('../useReports')
    const reports = useReports()

    mockFetch.mockResolvedValueOnce({
      kpis: [],
      salesTrend: [],
      paymentMix: [],
      appointmentStatusMix: [],
      branchComparison: [],
      topHighlights: [],
      canCompareBranches: false,
      filterOptions: {
        branches: [],
        employees: [],
        productCategories: [],
        serviceCategories: [],
        paymentMethods: []
      }
    })

    await reports.loadOverviewReport({
      startDate: '2026-05-19',
      endDate: '2026-05-01'
    })

    const callArgs = mockFetch.mock.calls[0]![1]
    expect(callArgs.query.startDate).toBe('2026-05-01')
    expect(callArgs.query.endDate).toBe('2026-05-19')
  })
})
