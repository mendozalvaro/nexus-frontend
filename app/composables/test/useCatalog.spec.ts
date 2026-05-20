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

const mockResolveAccessToken = vi.fn().mockResolvedValue('token-123')

mockNuxtImport('useSupabaseClient', () => () => ({ from: vi.fn() }))
mockNuxtImport('useSessionAccess', () => () => ({
  resolveAccessToken: mockResolveAccessToken
}))
mockNuxtImport('useAuth', () => () => ({
  profile: mockProfile,
  fetchProfile: vi.fn().mockResolvedValue(mockProfile.value)
}))

describe('useCatalog', () => {
  beforeEach(() => {
    globalStateMap.clear()
    mockResolveAccessToken.mockResolvedValue('token-123')
    mockProfile.value = {
      id: 'user-123',
      organization_id: 'org-abc',
      role: 'admin'
    }
  })

  it('carga productos con headers de auth', async () => {
    const { useCatalog } = await import('../useCatalog')
    const catalog = useCatalog()

    mockFetch.mockResolvedValueOnce([
      { id: 'prod-1', name: 'Producto 1', sku: 'SKU001', description: null, imageUrl: null, costPrice: 10, salePrice: 20, categoryId: null, categoryName: null, trackInventory: true, isActive: true }
    ])

    const products = await catalog.loadProducts()

    expect(mockFetch).toHaveBeenCalledWith('/api/catalog/products', {
      headers: { Authorization: 'Bearer token-123' }
    })
    expect(products).toHaveLength(1)
    expect(products[0]!.name).toBe('Producto 1')
  })

  it('carga servicios con headers de auth', async () => {
    const { useCatalog } = await import('../useCatalog')
    const catalog = useCatalog()

    mockFetch.mockResolvedValueOnce([
      { id: 'svc-1', name: 'Servicio 1', description: null, imageUrl: null, price: 50, durationMinutes: 30, categoryId: null, categoryName: null, isActive: true }
    ])

    const services = await catalog.loadServices()

    expect(mockFetch).toHaveBeenCalledWith('/api/catalog/services', {
      headers: { Authorization: 'Bearer token-123' }
    })
    expect(services).toHaveLength(1)
    expect(services[0]!.name).toBe('Servicio 1')
  })

  it('carga categorias con headers de auth', async () => {
    const { useCatalog } = await import('../useCatalog')
    const catalog = useCatalog()

    mockFetch.mockResolvedValueOnce([
      { id: 'cat-1', name: 'Categoria 1', type: 'product' as const, parentId: null, parentName: null, isActive: true, linkedCount: 0 }
    ])

    const categories = await catalog.loadCategories()

    expect(mockFetch).toHaveBeenCalledWith('/api/catalog/categories', {
      headers: { Authorization: 'Bearer token-123' }
    })
    expect(categories).toHaveLength(1)
  })

  it('carga catalogo completo y resuelve nombres de categoria', async () => {
    const { useCatalog } = await import('../useCatalog')
    const catalog = useCatalog()

    mockFetch
      .mockResolvedValueOnce([
        { id: 'prod-1', name: 'Producto 1', sku: 'SKU001', description: null, imageUrl: null, costPrice: 10, salePrice: 20, categoryId: 'cat-1', categoryName: null, trackInventory: true, isActive: true }
      ])
      .mockResolvedValueOnce([
        { id: 'svc-1', name: 'Servicio 1', description: null, imageUrl: null, price: 50, durationMinutes: 30, categoryId: 'cat-2', categoryName: null, isActive: true }
      ])
      .mockResolvedValueOnce([
        { id: 'cat-1', name: 'Productos', type: 'product' as const, parentId: null, parentName: null, isActive: true, linkedCount: 0 },
        { id: 'cat-2', name: 'Servicios', type: 'service' as const, parentId: null, parentName: null, isActive: true, linkedCount: 0 }
      ])

    const data = await catalog.loadCatalog()

    expect(data.products).toHaveLength(1)
    expect(data.products[0]!.categoryName).toBe('Productos')
    expect(data.services).toHaveLength(1)
    expect(data.services[0]!.categoryName).toBe('Servicios')
    expect(data.categories).toHaveLength(2)
    expect(data.categories[0]!.linkedCount).toBe(1)
    expect(data.categories[1]!.linkedCount).toBe(1)
  })

  it('crea producto con payload transformado', async () => {
    const { useCatalog } = await import('../useCatalog')
    const catalog = useCatalog()

    mockFetch.mockResolvedValueOnce({ success: true, productId: 'prod-new' })

    const result = await catalog.createProduct({
      name: 'Nuevo Producto',
      sku: 'NEW001',
      description: 'Descripcion',
      imageUrl: null,
      costPrice: 15,
      salePrice: 30,
      categoryId: 'cat-1',
      trackInventory: true
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/catalog/products', {
      method: 'POST',
      headers: { Authorization: 'Bearer token-123' },
      body: {
        name: 'Nuevo Producto',
        sku: 'NEW001',
        description: 'Descripcion',
        imageUrl: '',
        costPrice: 15,
        salePrice: 30,
        categoryId: 'cat-1',
        trackInventory: true
      }
    })
    expect(result.success).toBe(true)
  })

  it('actualiza producto con PATCH', async () => {
    const { useCatalog } = await import('../useCatalog')
    const catalog = useCatalog()

    mockFetch.mockResolvedValueOnce({ success: true, productId: 'prod-1' })

    const result = await catalog.updateProduct('prod-1', {
      name: 'Producto Actualizado',
      sku: 'SKU001',
      description: 'Nueva descripcion',
      imageUrl: null,
      costPrice: 12,
      salePrice: 25,
      categoryId: null,
      trackInventory: false
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/catalog/products/prod-1', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer token-123' },
      body: expect.objectContaining({
        name: 'Producto Actualizado',
        salePrice: 25
      })
    })
    expect(result.success).toBe(true)
  })

  it('actualiza estado de producto', async () => {
    const { useCatalog } = await import('../useCatalog')
    const catalog = useCatalog()

    mockFetch.mockResolvedValueOnce({ success: true, productId: 'prod-1' })

    const result = await catalog.updateProductStatus('prod-1', false)

    expect(mockFetch).toHaveBeenCalledWith('/api/catalog/products/prod-1/status', {
      method: 'POST',
      headers: { Authorization: 'Bearer token-123' },
      body: { isActive: false }
    })
    expect(result.success).toBe(true)
  })

  it('crea servicio con payload transformado', async () => {
    const { useCatalog } = await import('../useCatalog')
    const catalog = useCatalog()

    mockFetch.mockResolvedValueOnce({ success: true, serviceId: 'svc-new' })

    const result = await catalog.createService({
      name: 'Nuevo Servicio',
      description: 'Descripcion del servicio',
      imageUrl: null,
      price: 75,
      durationMinutes: 45,
      categoryId: 'cat-2'
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/catalog/services', {
      method: 'POST',
      headers: { Authorization: 'Bearer token-123' },
      body: {
        name: 'Nuevo Servicio',
        description: 'Descripcion del servicio',
        imageUrl: '',
        price: 75,
        durationMinutes: 45,
        categoryId: 'cat-2'
      }
    })
    expect(result.success).toBe(true)
  })

  it('actualiza estado de servicio', async () => {
    const { useCatalog } = await import('../useCatalog')
    const catalog = useCatalog()

    mockFetch.mockResolvedValueOnce({ success: true, serviceId: 'svc-1' })

    const result = await catalog.updateServiceStatus('svc-1', false)

    expect(mockFetch).toHaveBeenCalledWith('/api/catalog/services/svc-1/status', {
      method: 'POST',
      headers: { Authorization: 'Bearer token-123' },
      body: { isActive: false }
    })
    expect(result.success).toBe(true)
  })

  it('crea categoria', async () => {
    const { useCatalog } = await import('../useCatalog')
    const catalog = useCatalog()

    mockFetch.mockResolvedValueOnce({ success: true, categoryId: 'cat-new' })

    const result = await catalog.createCategory({
      name: 'Nueva Categoria',
      parentId: null,
      type: 'product'
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/catalog/categories', {
      method: 'POST',
      headers: { Authorization: 'Bearer token-123' },
      body: {
        name: 'Nueva Categoria',
        parentId: null,
        type: 'product'
      }
    })
    expect(result.success).toBe(true)
  })

  it('actualiza categoria', async () => {
    const { useCatalog } = await import('../useCatalog')
    const catalog = useCatalog()

    mockFetch.mockResolvedValueOnce({ success: true, categoryId: 'cat-1' })

    const result = await catalog.updateCategory('cat-1', {
      name: 'Categoria Actualizada',
      parentId: null,
      type: 'service'
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/catalog/categories/cat-1', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer token-123' },
      body: expect.objectContaining({
        name: 'Categoria Actualizada'
      })
    })
    expect(result.success).toBe(true)
  })

  it('lanza error 401 si no hay token', async () => {
    mockResolveAccessToken.mockResolvedValue(null)

    const { useCatalog } = await import('../useCatalog')
    const catalog = useCatalog()

    await expect(catalog.loadProducts()).rejects.toThrow('La sesion no esta disponible')
  })

  it('lanza error 403 si no hay organization_id', async () => {
    mockProfile.value = {
      id: 'user-123',
      organization_id: null,
      role: 'admin'
    }

    const { useCatalog } = await import('../useCatalog')
    const catalog = useCatalog()

    await expect(catalog.loadProducts()).rejects.toThrow('No se encontro la organizacion')
  })
})
