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

  it('crea filtros de transferencias por defecto', async () => {
    const { useInventory } = await import('../useInventory')
    const inventory = useInventory()

    const filters = inventory.createDefaultTransferFilters()
    expect(filters.status).toBe('all')
    expect(filters.branchId).toBe(null)
    expect(filters.productId).toBe(null)
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

  it('prevalida y registra ajuste batch con token', async () => {
    const { useInventory } = await import('../useInventory')
    const inventory = useInventory()

    const payload = {
      idempotencyKey: 'batch-adjust-1',
      branchId: 'branch-1',
      mode: 'add' as const,
      reason: 'Carga inicial',
      note: 'lote',
      lines: [{ productId: 'prod-1', quantity: 10 }]
    }

    mockFetch
      .mockResolvedValueOnce({ success: true, isValid: true, errors: [] })
      .mockResolvedValueOnce({ success: true, batchId: 'batch-1', processedCount: 1, idempotent: false })

    const precheck = await inventory.precheckAdjustStockBatch(payload)
    const result = await inventory.adjustStockBatch(payload)

    expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/inventory/stock/adjust/batch/precheck', {
      method: 'POST',
      headers: { Authorization: 'Bearer token-123' },
      body: {
        ...payload,
        lines: [{ productId: 'prod-1', quantity: 10, minStockLevel: null }]
      }
    })
    expect(mockFetch).toHaveBeenNthCalledWith(2, '/api/inventory/stock/adjust/batch', {
      method: 'POST',
      headers: { Authorization: 'Bearer token-123' },
      body: {
        ...payload,
        lines: [{ productId: 'prod-1', quantity: 10, minStockLevel: null }]
      }
    })
    expect(precheck.isValid).toBe(true)
    expect(result.batchId).toBe('batch-1')
  })

  it('envia payload batch normalizado al precheck de ajustes', async () => {
    const { useInventory } = await import('../useInventory')
    const inventory = useInventory()

    const payload = {
      idempotencyKey: 'batch-adjust-norm',
      branchId: 'branch-1',
      mode: 'add' as const,
      reason: 'Carga inicial',
      note: 'lote',
      lines: [
        { productId: 'prod-1', quantity: 2, minStockLevel: null },
        { productId: 'prod-1', quantity: 3, minStockLevel: 5 }
      ]
    }

    mockFetch.mockResolvedValueOnce({ success: true, isValid: true, errors: [] })

    await inventory.precheckAdjustStockBatch(payload)

    expect(mockFetch).toHaveBeenCalledWith('/api/inventory/stock/adjust/batch/precheck', {
      method: 'POST',
      headers: { Authorization: 'Bearer token-123' },
      body: {
        ...payload,
        lines: [{ productId: 'prod-1', quantity: 5, minStockLevel: 5 }]
      }
    })
  })

  it('prevalida y registra transferencia batch con token', async () => {
    const { useInventory } = await import('../useInventory')
    const inventory = useInventory()

    const payload = {
      idempotencyKey: 'batch-transfer-1',
      sourceBranchId: 'branch-1',
      destinationBranchId: 'branch-2',
      observations: 'rebalanceo',
      internalNote: 'lote semanal',
      lines: [{ productId: 'prod-1', quantity: 3 }]
    }

    mockFetch
      .mockResolvedValueOnce({ success: true, isValid: true, errors: [] })
      .mockResolvedValueOnce({ success: true, batchId: 'tb-1', processedCount: 1, status: 'pending' })

    const precheck = await inventory.precheckTransferStockBatch(payload)
    const result = await inventory.transferStockBatch(payload)

    expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/inventory/stock/transfer/batch/precheck', {
      method: 'POST',
      headers: { Authorization: 'Bearer token-123' },
      body: payload
    })
    expect(mockFetch).toHaveBeenNthCalledWith(2, '/api/inventory/stock/transfer/batch', {
      method: 'POST',
      headers: { Authorization: 'Bearer token-123' },
      body: payload
    })
    expect(precheck.isValid).toBe(true)
    expect(result.batchId).toBe('tb-1')
  })

  it('normaliza lineas repetidas en ajuste add/remove sumando cantidades', async () => {
    const { normalizeInventoryAdjustmentBatchLines } = await import('../useInventory')

    const result = normalizeInventoryAdjustmentBatchLines('add', [
      { productId: 'prod-1', quantity: 3, minStockLevel: null },
      { productId: 'prod-2', quantity: 2, minStockLevel: null },
      { productId: 'prod-1', quantity: 4, minStockLevel: 6 }
    ])

    expect(result.originalLines).toBe(3)
    expect(result.normalizedLines).toBe(2)
    expect(result.mergedProducts).toBe(1)
    expect(result.lines).toEqual([
      { productId: 'prod-1', quantity: 7, minStockLevel: 6 },
      { productId: 'prod-2', quantity: 2, minStockLevel: null }
    ])
  })

  it('normaliza lineas repetidas en ajuste set usando ultimo valor y ultimo min no nulo', async () => {
    const { normalizeInventoryAdjustmentBatchLines } = await import('../useInventory')

    const result = normalizeInventoryAdjustmentBatchLines('set', [
      { productId: 'prod-1', quantity: 3, minStockLevel: 4 },
      { productId: 'prod-1', quantity: 9, minStockLevel: null },
      { productId: 'prod-1', quantity: 5, minStockLevel: 7 }
    ])

    expect(result.lines).toEqual([
      { productId: 'prod-1', quantity: 5, minStockLevel: 7 }
    ])
  })

  it('normaliza lineas repetidas en transferencias sumando por producto', async () => {
    const { normalizeInventoryTransferBatchLines } = await import('../useInventory')

    const result = normalizeInventoryTransferBatchLines([
      { productId: 'prod-1', quantity: 1 },
      { productId: 'prod-2', quantity: 2 },
      { productId: 'prod-1', quantity: 5 }
    ])

    expect(result.originalLines).toBe(3)
    expect(result.normalizedLines).toBe(2)
    expect(result.mergedProducts).toBe(1)
    expect(result.lines).toEqual([
      { productId: 'prod-1', quantity: 6 },
      { productId: 'prod-2', quantity: 2 }
    ])
  })
})
