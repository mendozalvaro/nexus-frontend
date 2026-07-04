import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { globalStateMap } from '../../../test/setup'
import type { OrganizationCapabilities } from '@/types/subscription'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

const mockProfile = ref<{
  id: string
  organization_id: string | null
  role: 'admin' | 'manager'
}>({
  id: 'user-123',
  organization_id: 'org-abc',
  role: 'admin'
})

const mockResolveAccessToken = vi.fn().mockResolvedValue('token-123')
const mockLoadCapabilities = vi.fn().mockResolvedValue({
  currentPlan: 'pro',
  maxBranches: 5,
  canTransferStock: true,
  planLimits: null,
  currentBranchesCount: 2
})
const mockGetUpgradeMessage = vi.fn().mockReturnValue('Upgrade requerido')
const mockCanCreateResource = vi.fn().mockReturnValue(true)

const createCapabilities = (overrides: Partial<OrganizationCapabilities> = {}): OrganizationCapabilities => ({
  planName: 'Plan Pro',
  planSlug: 'crecimiento',
  maxBranches: 1,
  maxUsers: 10,
  canCreateBranch: true,
  canCreateManager: true,
  canTransferStock: false,
  hasAdvancedReports: false,
  hasApiAccess: false,
  hasForensicExport: false,
  hasHotelModule: false,
  businessTypes: [],
  allowedBusinessTypes: [],
  maxBusinessTypes: 1,
  currentBranchesCount: 1,
  currentUsersCount: 2,
  subscriptionStatus: 'active',
  periodEnd: null,
  planLimits: undefined,
  ...overrides
})

mockNuxtImport('useSupabaseClient', () => () => ({ from: vi.fn() }))
mockNuxtImport('useSessionAccess', () => () => ({
  resolveAccessToken: mockResolveAccessToken
}))
mockNuxtImport('useUserContext', () => () => ({
  profile: mockProfile,
  ensureContext: vi.fn().mockResolvedValue({
    profile: mockProfile.value
  })
}))
mockNuxtImport('useSubscription', () => () => ({
  loadCapabilities: mockLoadCapabilities,
  getUpgradeMessage: mockGetUpgradeMessage,
  canCreateResource: mockCanCreateResource
}))

describe('useBranches', () => {
  beforeEach(() => {
    globalStateMap.clear()
    mockResolveAccessToken.mockResolvedValue('token-123')
    mockProfile.value = {
      id: 'user-123',
      organization_id: 'org-abc',
      role: 'admin'
    }
  })

  it('crea horarios de negocio por defecto', async () => {
    const { useBranches } = await import('../useBranches')
    const branches = useBranches()

    const hours = branches.createDefaultBusinessHours()

    expect(hours.monday.isOpen).toBe(true)
    expect(hours.monday.open).toBe('09:00')
    expect(hours.monday.close).toBe('18:00')
    expect(hours.saturday.isOpen).toBe(true)
    expect(hours.saturday.close).toBe('14:00')
    expect(hours.sunday.isOpen).toBe(false)
  })

  it('tiene orden de dias de semana', async () => {
    const { useBranches } = await import('../useBranches')
    const branches = useBranches()

    expect(branches.weekdayOrder).toEqual([
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
    ])
  })

  it('carga lista de sucursales', async () => {
    const { useBranches } = await import('../useBranches')
    const branches = useBranches()

    mockFetch.mockResolvedValueOnce({
      branches: [
        {
          id: 'branch-1',
          name: 'Sucursal Central',
          code: 'CENTRAL',
          address: 'Calle 123',
          phone: '77777777',
          isActive: true,
          createdAt: '2026-01-01',
          updatedAt: '2026-05-19',
          settings: {
            businessHours: branches.createDefaultBusinessHours()
          },
          stats: {
            salesTotal: 1000,
            salesCount: 10,
            employeesCount: 3,
            appointmentsCount: 5,
            lowStockCount: 2
          }
        }
      ]
    })

    const result = await branches.loadBranches()

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/branches', {
      headers: { Authorization: 'Bearer token-123' }
    })
    expect(result.branches).toHaveLength(1)
    expect(result.branches[0]!.name).toBe('Sucursal Central')
    expect(result.planFeatures.featureMultiBranch).toBe(true)
    expect(result.planFeatures.featureInventoryTransfer).toBe(true)
  })

  it('carga detalles de sucursal', async () => {
    const { useBranches } = await import('../useBranches')
    const branches = useBranches()

    mockFetch.mockResolvedValueOnce({
      branch: {
        id: 'branch-1',
        name: 'Sucursal Central',
        code: 'CENTRAL',
        address: 'Calle 123',
        phone: '77777777',
        isActive: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-05-19',
        settings: {
          businessHours: branches.createDefaultBusinessHours()
        },
        stats: {
          salesTotal: 1000,
          salesCount: 10,
          employeesCount: 3,
          appointmentsCount: 5,
          lowStockCount: 2
        }
      },
      destinationBranches: [
        { label: 'Sucursal Norte', value: 'branch-2' }
      ],
      inventory: [
        {
          stockId: 'stock-1',
          productId: 'prod-1',
          productName: 'Producto 1',
          sku: 'SKU001',
          quantity: 10,
          reservedQuantity: 2,
          availableQuantity: 8,
          minStockLevel: 5
        }
      ]
    })

    const result = await branches.loadBranchDetails('branch-1')

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/branches/branch-1', {
      headers: { Authorization: 'Bearer token-123' }
    })
    expect(result.branch.name).toBe('Sucursal Central')
    expect(result.destinationBranches).toHaveLength(1)
    expect(result.inventory).toHaveLength(1)
  })

  it('crea sucursal con settings serializados', async () => {
    const { useBranches } = await import('../useBranches')
    const branches = useBranches()

    mockFetch.mockResolvedValueOnce({
      id: 'branch-new',
      success: true
    })

    const result = await branches.createBranch({
      name: 'Nueva Sucursal',
      code: 'NUEVA',
      address: 'Av. Principal 456',
      phone: '66666666',
      settings: {
        businessHours: branches.createDefaultBusinessHours()
      }
    }) as { success: boolean }

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/branches', {
      method: 'POST',
      headers: { Authorization: 'Bearer token-123' },
      body: expect.objectContaining({
        name: 'Nueva Sucursal',
        code: 'NUEVA',
        settings: expect.objectContaining({
          businessHours: expect.any(Object)
        })
      })
    })
    expect(result.success).toBe(true)
  })

  it('actualiza sucursal', async () => {
    const { useBranches } = await import('../useBranches')
    const branches = useBranches()

    mockFetch.mockResolvedValueOnce({
      id: 'branch-1',
      success: true
    })

    const result = await branches.updateBranch('branch-1', {
      name: 'Sucursal Actualizada',
      code: 'CENTRAL',
      address: 'Nueva Direccion',
      phone: '77777777',
      settings: {
        businessHours: branches.createDefaultBusinessHours()
      }
    }) as { success: boolean }

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/branches/branch-1', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer token-123' },
      body: expect.objectContaining({
        name: 'Sucursal Actualizada'
      })
    })
    expect(result.success).toBe(true)
  })

  it('actualiza estado de sucursal', async () => {
    const { useBranches } = await import('../useBranches')
    const branches = useBranches()

    mockFetch.mockResolvedValueOnce({
      id: 'branch-1',
      isActive: false
    })

    const result = await branches.updateBranchStatus('branch-1', false) as { isActive: boolean }

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/branches/branch-1/status', {
      method: 'POST',
      headers: { Authorization: 'Bearer token-123' },
      body: { isActive: false }
    })
    expect(result.isActive).toBe(false)
  })

  it('transfiere stock entre sucursales', async () => {
    const { useBranches } = await import('../useBranches')
    const branches = useBranches()

    mockFetch.mockResolvedValueOnce({
      success: true,
      transferId: 'transfer-1'
    })

    const result = await branches.transferStock({
      sourceBranchId: 'branch-1',
      destinationBranchId: 'branch-2',
      productId: 'prod-1',
      quantity: 5,
      note: 'Rebalanceo de stock'
    }) as { success: boolean }

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/branches/transfer-stock', {
      method: 'POST',
      headers: { Authorization: 'Bearer token-123' },
      body: {
        sourceBranchId: 'branch-1',
        destinationBranchId: 'branch-2',
        productId: 'prod-1',
        quantity: 5,
        note: 'Rebalanceo de stock'
      }
    })
    expect(result.success).toBe(true)
  })

  it('transfiere stock sin nota', async () => {
    const { useBranches } = await import('../useBranches')
    const branches = useBranches()

    mockFetch.mockResolvedValueOnce({ success: true })

    await branches.transferStock({
      sourceBranchId: 'branch-1',
      destinationBranchId: 'branch-2',
      productId: 'prod-1',
      quantity: 5
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/admin/branches/transfer-stock', {
      method: 'POST',
      headers: { Authorization: 'Bearer token-123' },
      body: expect.objectContaining({
        note: ''
      })
    })
  })

  it('retorna mensaje de limite de sucursales', async () => {
    const { useBranches } = await import('../useBranches')
    const branches = useBranches()

    const message = branches.branchLimitMessage.value
    expect(message).toBeDefined()
  })

  it('retorna null si multi-sucursal esta habilitado', async () => {
    const { useBranches } = await import('../useBranches')
    const branches = useBranches()

    const message = branches.getMultiBranchMessage({
      capabilities: createCapabilities({ currentBranchesCount: 2, maxBranches: 5, canTransferStock: true }),
      planFeatures: { featureMultiBranch: true, featureInventoryTransfer: true }
    })

    expect(message).toBe(null)
  })

  it('retorna mensaje de upgrade si multi-sucursal no esta habilitado', async () => {
    const { useBranches } = await import('../useBranches')
    const branches = useBranches()

    const message = branches.getMultiBranchMessage({
      capabilities: createCapabilities({ currentBranchesCount: 1, maxBranches: 1, canTransferStock: false }),
      planFeatures: { featureMultiBranch: false, featureInventoryTransfer: false }
    })

    expect(message).toContain('Actualiza tu suscripci')
  })

  it('retorna null si transferencia de stock esta habilitada', async () => {
    const { useBranches } = await import('../useBranches')
    const branches = useBranches()

    const message = branches.getTransferUpgradeMessage({
      capabilities: createCapabilities({ currentBranchesCount: 2, maxBranches: 5, canTransferStock: true }),
      planFeatures: { featureMultiBranch: true, featureInventoryTransfer: true }
    })

    expect(message).toBe(null)
  })

  it('retorna mensaje de upgrade si transferencia no esta habilitada', async () => {
    const { useBranches } = await import('../useBranches')
    const branches = useBranches()

    const message = branches.getTransferUpgradeMessage({
      capabilities: createCapabilities({ currentBranchesCount: 1, maxBranches: 1, canTransferStock: false }),
      planFeatures: { featureMultiBranch: false, featureInventoryTransfer: false }
    })

    expect(message).toContain('transferencia de stock')
  })

  it('lanza error 403 si no es admin', async () => {
    mockProfile.value = {
      id: 'user-123',
      organization_id: 'org-abc',
      role: 'manager'
    }

    const { useBranches } = await import('../useBranches')
    const branches = useBranches()

    await expect(branches.loadBranches()).rejects.toThrow('Solo administradores')
  })

  it('lanza error 401 si no hay token', async () => {
    mockResolveAccessToken.mockResolvedValue(null)

    const { useBranches } = await import('../useBranches')
    const branches = useBranches()

    await expect(branches.loadBranches()).rejects.toThrow('La sesi')
  })
})
