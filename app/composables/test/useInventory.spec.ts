import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { globalStateMap } from '../../../test/setup'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

mockNuxtImport('useSupabaseClient', () => () => ({ from: vi.fn() }))
mockNuxtImport('useSessionAccess', () => () => ({
  resolveAccessToken: vi.fn().mockResolvedValue('token-123')
}))
mockNuxtImport('useAuth', () => () => ({
  profile: ref({
    id: 'user-123',
    organization_id: 'org-abc',
    role: 'admin' as const
  }),
  fetchProfile: vi.fn().mockResolvedValue({
    id: 'user-123',
    organization_id: 'org-abc',
    role: 'admin'
  })
}))
mockNuxtImport('useSubscription', () => () => ({
  loadCapabilities: vi.fn(),
  getUpgradeMessage: vi.fn().mockReturnValue('Upgrade requerido para más sucursales')
}))

describe('useInventory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalStateMap.clear()
  })

  it('crea filtros de movimiento por defecto', async () => {
    const { useInventory } = await import('../useInventory')
    const inventory = useInventory()

    const filters = inventory.createDefaultMovementFilters()
    expect(filters.movementType).toBe('all')
    expect(filters.branchId).toBe(null)
    expect(filters.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(filters.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('expone labels y colores para movimientos', async () => {
    const { useInventory } = await import('../useInventory')
    const inventory = useInventory()

    expect(inventory.getMovementLabel('entry')).toBe('Entrada')
    expect(inventory.getMovementColor('entry')).toBe('success')
    expect(inventory.getMovementColor('transfer_out')).toBe('warning')
  })

  it('calcula tono de stock según umbral', async () => {
    const { useInventory } = await import('../useInventory')
    const inventory = useInventory()

    expect(inventory.getStockTone(0, 5)).toBe('error')
    expect(inventory.getStockTone(5, 5)).toBe('warning')
    expect(inventory.getStockTone(20, 5)).toBe('success')
  })

  it('retorna mensaje de upgrade si transferencias no están habilitadas', async () => {
    const { useInventory } = await import('../useInventory')
    const inventory = useInventory()

    const message = inventory.getTransferUpgradeMessage({ canTransferStock: false } as never)
    expect(message).toBe('Upgrade requerido para más sucursales')
  })

  it('envía ajuste de stock por API con token', async () => {
    const { useInventory } = await import('../useInventory')
    const inventory = useInventory()

    const payload = {
      branchId: 'branch-1',
      productId: 'prod-1',
      mode: 'add' as const,
      quantity: 5,
      reason: 'Ajuste test',
      note: 'nota'
    }

    mockFetch.mockResolvedValueOnce({
      success: true,
      stockId: 'stock-1',
      movementId: 'mov-1'
    })

    const result = await inventory.adjustStock(payload)

    expect(mockFetch).toHaveBeenCalledWith('/api/inventory/stock/adjust', {
      method: 'POST',
      headers: { Authorization: 'Bearer token-123' },
      body: payload
    })
    expect(result.success).toBe(true)
    expect(result.movementId).toBe('mov-1')
  })
})
