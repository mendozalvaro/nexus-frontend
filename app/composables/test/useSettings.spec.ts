import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { globalStateMap } from '../../../test/setup'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

mockNuxtImport('useSupabaseClient', () => () => ({ from: vi.fn() }))
mockNuxtImport('useGlobalOrganization', () => () => ({
  refreshOrganization: vi.fn().mockResolvedValue(undefined)
}))
mockNuxtImport('useSubscription', () => () => ({
  loadCapabilities: vi.fn().mockResolvedValue(undefined),
  capabilities: { currentPlan: 'pro' }
}))

describe('useSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalStateMap.clear()
  })

  it('inicializa estado en null/false', async () => {
    const { useSettings } = await import('../useSettings')
    const settings = useSettings()

    expect(settings.organization.value).toBe(null)
    expect(settings.subscription.value).toBe(null)
    expect(settings.siatConfig.value).toBe(null)
    expect(settings.orgLoading.value).toBe(false)
    expect(settings.mutationLoading.value).toBe(false)
    expect(settings.error.value).toBe(null)
  })

  it('carga organizacion', async () => {
    const { useSettings } = await import('../useSettings')
    const settings = useSettings()

    mockFetch.mockResolvedValueOnce({
      id: 'org-1',
      name: 'Mi Empresa',
      slug: 'mi-empresa',
      timezone: 'America/La_Paz',
      currency_code: 'BOB',
      country: 'BO',
      business_type: 'hybrid',
      address: 'Calle 123',
      logo_url: null,
      is_active: true,
      updated_at: '2026-05-19'
    })

    await settings.loadOrganization()

    expect(mockFetch).toHaveBeenCalledWith('/api/organization')
    expect(settings.organization.value?.name).toBe('Mi Empresa')
    expect(settings.orgLoading.value).toBe(false)
  })

  it('carga suscripcion', async () => {
    const { useSettings } = await import('../useSettings')
    const settings = useSettings()

    mockFetch.mockResolvedValueOnce({
      id: 'sub-1',
      billing_mode: 'monthly',
      payment_method: 'tarjeta',
      status: 'active',
      current_period_start: '2026-05-01',
      current_period_end: '2026-06-01',
      cancel_at_period_end: false,
      invoice_name: 'Mi Empresa SRL',
      doc_type: 'nit',
      doc_number: '123456789',
      updated_at: '2026-05-19'
    })

    await settings.loadSubscription()

    expect(mockFetch).toHaveBeenCalledWith('/api/subscription')
    expect(settings.subscription.value?.status).toBe('active')
    expect(settings.subLoading.value).toBe(false)
  })

  it('carga configuracion SIAT', async () => {
    const { useSettings } = await import('../useSettings')
    const settings = useSettings()

    mockFetch.mockResolvedValueOnce({
      id: 'siat-1',
      razon_social: 'Mi Empresa SRL',
      nit: '123456789',
      regimen_tributario: 'general',
      actividad_economica: 'Peluqueria',
      sucursal_siat: '001',
      direccion_matriz: 'Calle 123',
      codigo_autorizacion: 'ABC123',
      punto_venta: '001',
      sistema_facturacion: 'propio',
      codigo_sistema: 'SYS001',
      resolucion_numero: 'RES001',
      is_active: true,
      last_sync_at: '2026-05-19',
      created_at: '2026-01-01',
      updated_at: '2026-05-19'
    })

    await settings.loadSiatConfig()

    expect(mockFetch).toHaveBeenCalledWith('/api/siat')
    expect(settings.siatConfig.value?.nit).toBe('123456789')
    expect(settings.siatLoading.value).toBe(false)
  })

  it('actualiza organizacion', async () => {
    const { useSettings } = await import('../useSettings')
    const settings = useSettings()

    mockFetch.mockResolvedValueOnce({
      id: 'org-1',
      name: 'Empresa Actualizada',
      slug: 'empresa-actualizada',
      timezone: 'America/La_Paz',
      currency_code: 'BOB',
      country: 'BO',
      business_type: 'services',
      address: null,
      logo_url: null,
      is_active: true,
      updated_at: '2026-05-19'
    })

    const result = await settings.updateOrganization({
      name: 'Empresa Actualizada',
      business_type: 'services'
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/settings/organization', {
      method: 'PATCH',
      body: {
        name: 'Empresa Actualizada',
        business_type: 'services'
      }
    })
    expect(result.name).toBe('Empresa Actualizada')
    expect(settings.organization.value?.name).toBe('Empresa Actualizada')
  })

  it('actualiza suscripcion', async () => {
    const { useSettings } = await import('../useSettings')
    const settings = useSettings()

    mockFetch.mockResolvedValueOnce({
      id: 'sub-1',
      billing_mode: 'annual',
      payment_method: 'transferencia',
      status: 'active',
      current_period_start: '2026-05-01',
      current_period_end: '2027-05-01',
      cancel_at_period_end: false,
      invoice_name: null,
      doc_type: null,
      doc_number: null,
      updated_at: '2026-05-19'
    })

    const result = await settings.updateSubscription({
      billing_mode: 'annual',
      payment_method: 'transferencia'
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/settings/subscription', {
      method: 'PATCH',
      body: {
        billing_mode: 'annual',
        payment_method: 'transferencia'
      }
    })
    expect(result.billing_mode).toBe('annual')
  })

  it('actualiza datos de facturacion', async () => {
    const { useSettings } = await import('../useSettings')
    const settings = useSettings()

    settings.subscription.value = {
      id: 'sub-1',
      billing_mode: 'monthly',
      payment_method: 'tarjeta',
      status: 'active',
      current_period_start: '2026-05-01',
      current_period_end: '2026-06-01',
      cancel_at_period_end: false,
      invoice_name: null,
      doc_type: null,
      doc_number: null,
      updated_at: '2026-05-19'
    }

    mockFetch.mockResolvedValueOnce({
      invoice_name: 'Mi Empresa SRL',
      doc_type: 'nit',
      doc_number: '123456789'
    })

    await settings.updateBillingData({
      invoice_name: 'Mi Empresa SRL',
      doc_type: 'nit',
      doc_number: '123456789'
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/subscription/billing-data', {
      method: 'PATCH',
      body: {
        invoice_name: 'Mi Empresa SRL',
        doc_type: 'nit',
        doc_number: '123456789'
      }
    })
    expect(settings.subscription.value?.invoice_name).toBe('Mi Empresa SRL')
  })

  it('actualiza configuracion SIAT', async () => {
    const { useSettings } = await import('../useSettings')
    const settings = useSettings()

    mockFetch.mockResolvedValueOnce({
      id: 'siat-1',
      razon_social: 'Nueva Razon',
      nit: '987654321',
      regimen_tributario: 'simplificado',
      actividad_economica: null,
      sucursal_siat: null,
      direccion_matriz: null,
      codigo_autorizacion: null,
      punto_venta: null,
      sistema_facturacion: null,
      codigo_sistema: null,
      resolucion_numero: null,
      is_active: true,
      last_sync_at: null,
      created_at: '2026-01-01',
      updated_at: '2026-05-19'
    })

    const result = await settings.updateSiatConfig({
      razon_social: 'Nueva Razon',
      nit: '987654321',
      regimen_tributario: 'simplificado'
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/siat', {
      method: 'PATCH',
      body: {
        razon_social: 'Nueva Razon',
        nit: '987654321',
        regimen_tributario: 'simplificado'
      }
    })
    expect(result.razon_social).toBe('Nueva Razon')
  })

  it('desactiva organizacion', async () => {
    const { useSettings } = await import('../useSettings')
    const settings = useSettings()

    mockFetch.mockResolvedValueOnce({
      id: 'org-1',
      name: 'Mi Empresa',
      slug: 'mi-empresa',
      timezone: null,
      currency_code: null,
      country: null,
      business_type: null,
      address: null,
      logo_url: null,
      is_active: false,
      updated_at: '2026-05-19'
    })

    const result = await settings.deactivateOrganization()

    expect(mockFetch).toHaveBeenCalledWith('/api/settings/organization', {
      method: 'PATCH',
      body: { is_active: false }
    })
    expect(result.is_active).toBe(false)
  })

  it('maneja error al cargar organizacion', async () => {
    const { useSettings } = await import('../useSettings')
    const settings = useSettings()

    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    await settings.loadOrganization()

    expect(settings.error.value).toBe('Network error')
    expect(settings.orgLoading.value).toBe(false)
  })

  it('maneja error al actualizar organizacion', async () => {
    const { useSettings } = await import('../useSettings')
    const settings = useSettings()

    mockFetch.mockRejectedValueOnce(new Error('Update failed'))

    await expect(settings.updateOrganization({ name: 'New' })).rejects.toThrow()
    expect(settings.error.value).toBe('Update failed')
  })
})
