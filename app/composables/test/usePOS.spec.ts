import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { globalStateMap } from '../../../test/setup'
import type { POSProductItem } from '../usePOS'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

const mockProfile = ref({
  id: 'user-123',
  organization_id: 'org-abc',
  role: 'admin' as const,
  full_name: 'Test User',
  branch_id: 'branch-1'
})

mockNuxtImport('useSupabaseClient', () => () => ({ from: vi.fn() }))
mockNuxtImport('useSessionAccess', () => () => ({
  resolveAccessToken: vi.fn().mockResolvedValue('mock-token')
}))
mockNuxtImport('useAuth', () => () => ({
  profile: mockProfile,
  fetchProfile: vi.fn().mockResolvedValue(mockProfile.value)
}))
mockNuxtImport('createError', () => (payload: { statusMessage?: string }) => {
  return new Error(payload?.statusMessage ?? 'Error')
})

describe('usePOS', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalStateMap.clear()
    mockProfile.value = {
      id: 'user-123',
      organization_id: 'org-abc',
      role: 'admin',
      full_name: 'Test User',
      branch_id: 'branch-1'
    }
  })

  it('inicializa estado base', async () => {
    const { usePOS } = await import('../usePOS')
    const pos = usePOS()

    expect(pos.cart.value).toEqual([])
    expect(pos.lastCatalog.value).toBe(null)
  })

  it('carga catálogo y mapea respuesta', async () => {
    const { usePOS } = await import('../usePOS')
    const pos = usePOS()

    mockFetch.mockResolvedValueOnce({
      organizationId: 'org-abc',
      currentBranchId: 'branch-1',
      branches: [{ id: 'branch-1', name: 'Sucursal 1', code: 'S1' }],
      categories: [{ id: 'cat-1', name: 'Productos', type: 'product' }],
      products: [{
        id: 'prod-1',
        name: 'Producto 1',
        sku: 'SKU001',
        description: null,
        sale_price: 100,
        category_id: 'cat-1',
        track_inventory: true
      }],
      services: [],
      employees: [],
      assignments: [],
      inventory: [{
        branch_id: 'branch-1',
        product_id: 'prod-1',
        quantity: 10,
        reserved_quantity: 2
      }]
    })

    const result = await pos.loadCatalog()

    expect(mockFetch).toHaveBeenCalledWith('/api/pos/catalog', expect.any(Object))
    expect(result.organizationId).toBe('org-abc')
    expect(result.products).toHaveLength(1)
    expect(result.products[0]!.price).toBe(100)
    expect(result.products[0]!.stockByBranch['branch-1']).toBe(8)
    expect(pos.lastCatalog.value?.organizationId).toBe('org-abc')
  })

  it('agrega producto al carrito y calcula subtotal', async () => {
    const { usePOS } = await import('../usePOS')
    const pos = usePOS()

    const product: POSProductItem = {
      id: 'prod-1',
      name: 'Producto 1',
      sku: 'SKU001',
      description: null,
      price: 50,
      categoryId: null,
      categoryName: null,
      trackInventory: true,
      stockByBranch: { 'branch-1': 10 }
    }

    pos.addProductToCart(product, 'branch-1', 2)

    expect(pos.cart.value).toHaveLength(1)
    expect(pos.cart.value[0]!.subtotal).toBe(100)
  })

  it('valida stock insuficiente al agregar producto', async () => {
    const { usePOS } = await import('../usePOS')
    const pos = usePOS()

    const product: POSProductItem = {
      id: 'prod-1',
      name: 'Producto 1',
      sku: 'SKU001',
      description: null,
      price: 50,
      categoryId: null,
      categoryName: null,
      trackInventory: true,
      stockByBranch: { 'branch-1': 1 }
    }

    expect(() => pos.addProductToCart(product, 'branch-1', 2)).toThrow('Stock insuficiente')
  })

  it('ejecuta checkout y limpia carrito', async () => {
    const { usePOS } = await import('../usePOS')
    const pos = usePOS()

    const product: POSProductItem = {
      id: 'prod-1',
      name: 'Producto 1',
      sku: 'SKU001',
      description: null,
      price: 80,
      categoryId: null,
      categoryName: null,
      trackInventory: false,
      stockByBranch: {}
    }

    pos.addProductToCart(product, 'branch-1', 1)

    mockFetch.mockResolvedValueOnce({
      receipt: {
        transactionId: 'trx-1',
        invoiceNumber: 1001,
        createdAt: new Date().toISOString(),
        branchId: 'branch-1',
        branchName: 'Sucursal 1',
        employeeId: 'user-123',
        employeeName: 'Test User',
        customer: {
          mode: 'walk_in',
          customerId: null,
          fullName: 'Cliente Test',
          phone: '77777777'
        },
        paymentMethod: 'cash',
        totalAmount: 80,
        discountAmount: 0,
        taxAmount: 0,
        finalAmount: 80,
        items: []
      },
      transactionId: 'trx-1'
    })

    const receipt = await pos.checkout({
      branchId: 'branch-1',
      customer: { mode: 'walk_in', fullName: 'Cliente Test', phone: '77777777' },
      paymentMethod: 'cash',
      discount: { type: 'none', value: 0 },
      note: 'venta test'
    })

    expect(receipt.transactionId).toBe('trx-1')
    expect(pos.cart.value).toEqual([])
  })
})
