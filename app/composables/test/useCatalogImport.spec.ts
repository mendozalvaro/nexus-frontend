import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { globalStateMap } from '../../../test/setup'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

mockNuxtImport('useSupabaseClient', () => () => ({ from: vi.fn() }))

describe('useCatalogImport', () => {
  beforeEach(() => {
    globalStateMap.clear()
    mockFetch.mockClear()
  })

  it('inicializa en estado base', async () => {
    const { useCatalogImport } = await import('../useCatalogImport')
    const importer = useCatalogImport()

    expect(importer.step.value).toBe('select')
    expect(importer.entityType.value).toBe('products')
    expect(importer.duplicateStrategy.value).toBe('skip')
    expect(importer.parsedData.value).toBe(null)
    expect(importer.previewResult.value).toBe(null)
    expect(importer.importSummary.value).toBe(null)
    expect(importer.loading.value).toBe(false)
    expect(importer.error.value).toBe(null)
  })

  it('resetea estado a valores iniciales', async () => {
    const { useCatalogImport } = await import('../useCatalogImport')
    const importer = useCatalogImport()

    importer.step.value = 'summary'
    importer.entityType.value = 'services'
    importer.error.value = 'Error previo'

    importer.reset()

    expect(importer.step.value).toBe('select')
    expect(importer.entityType.value).toBe('products')
    expect(importer.error.value).toBe(null)
    expect(importer.importSummary.value).toBe(null)
  })

  it('solicita preview y actualiza estado', async () => {
    const { useCatalogImport } = await import('../useCatalogImport')
    const importer = useCatalogImport()

    importer.parsedData.value = {
      headers: ['name', 'sku'],
      rows: [{ name: 'Test', sku: 'T001' }],
      rawRows: [['name', 'sku'], ['Test', 'T001']]
    }

    mockFetch.mockResolvedValueOnce({
      preview: {
        validRows: 1,
        invalidRows: 0,
        duplicates: [],
        validationErrors: []
      }
    })

    await importer.requestPreview()

    expect(mockFetch).toHaveBeenCalledWith('/api/catalog/import', {
      method: 'POST',
      body: {
        entityType: 'products',
        rows: [{ name: 'Test', sku: 'T001' }],
        duplicateStrategy: 'skip',
        mode: 'preview'
      }
    })
    expect(importer.previewResult.value?.validRows).toBe(1)
    expect(importer.step.value).toBe('preview')
  })

  it('muestra error si no hay datos para preview', async () => {
    const { useCatalogImport } = await import('../useCatalogImport')
    const importer = useCatalogImport()

    importer.parsedData.value = null

    await importer.requestPreview()

    expect(importer.error.value).toBe('No hay datos para previsualizar.')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('maneja error de API en preview', async () => {
    const { useCatalogImport } = await import('../useCatalogImport')
    const importer = useCatalogImport()

    importer.parsedData.value = {
      headers: ['name'],
      rows: [{ name: 'Test' }],
      rawRows: [['name'], ['Test']]
    }

    mockFetch.mockRejectedValueOnce(new Error('API Error'))

    await importer.requestPreview()

    expect(importer.error.value).toBe('API Error')
    expect(importer.loading.value).toBe(false)
  })

  it('ejecuta importacion y genera resumen', async () => {
    const { useCatalogImport } = await import('../useCatalogImport')
    const importer = useCatalogImport()

    importer.parsedData.value = {
      headers: ['name', 'sku'],
      rows: [
        { name: 'Producto 1', sku: 'P001' },
        { name: 'Producto 2', sku: 'P002' }
      ],
      rawRows: [['name', 'sku'], ['Producto 1', 'P001'], ['Producto 2', 'P002']]
    }

    mockFetch.mockResolvedValueOnce({
      result: {
        created: 2,
        updated: 0,
        skipped: 0,
        errors: []
      }
    })

    await importer.executeImport()

    expect(mockFetch).toHaveBeenCalledWith('/api/catalog/import', {
      method: 'POST',
      body: {
        entityType: 'products',
        rows: [
          { name: 'Producto 1', sku: 'P001' },
          { name: 'Producto 2', sku: 'P002' }
        ],
        duplicateStrategy: 'skip',
        mode: 'execute'
      }
    })
    expect(importer.importSummary.value?.result.created).toBe(2)
    expect(importer.importSummary.value?.totalRows).toBe(2)
    expect(importer.step.value).toBe('summary')
  })

  it('muestra error si no hay datos para importar', async () => {
    const { useCatalogImport } = await import('../useCatalogImport')
    const importer = useCatalogImport()

    importer.parsedData.value = null

    await importer.executeImport()

    expect(importer.error.value).toBe('No hay datos para importar.')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('maneja error de API en importacion', async () => {
    const { useCatalogImport } = await import('../useCatalogImport')
    const importer = useCatalogImport()

    importer.parsedData.value = {
      headers: ['name'],
      rows: [{ name: 'Test' }],
      rawRows: [['name'], ['Test']]
    }

    mockFetch.mockRejectedValueOnce(new Error('Import failed'))

    await importer.executeImport()

    expect(importer.error.value).toBe('Import failed')
    expect(importer.loading.value).toBe(false)
  })
})
