export interface CatalogProductPayload {
  name: string;
  sku: string;
  description: string;
  imageUrl: string | null;
  imageFile?: File | null;
  cropSquare?: boolean;
  costPrice: number;
  salePrice: number;
  categoryId: string | null;
  trackInventory: boolean;
}

export interface CatalogServicePayload {
  name: string;
  description: string;
  imageUrl: string | null;
  imageFile?: File | null;
  cropSquare?: boolean;
  price: number;
  durationMinutes: number;
  categoryId: string | null;
}

export interface CatalogCategoryPayload {
  name: string;
  parentId: string | null;
  type: "product" | "service" | "lodging";
  description?: string;
}

export interface CatalogCategoryItem {
  id: string;
  name: string;
  type: "product" | "service" | "lodging";
  parentId: string | null;
  parentName: string | null;
  description: string | null;
  isActive: boolean;
  linkedCount: number;
}

export interface CatalogProductItem {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  imageUrl: string | null;
  costPrice: number;
  salePrice: number;
  categoryId: string | null;
  categoryName: string | null;
  trackInventory: boolean;
  isActive: boolean;
}

export interface CatalogServiceItem {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  durationMinutes: number;
  categoryId: string | null;
  categoryName: string | null;
  isActive: boolean;
}

export interface CatalogRoomPayload {
  roomNumber: string;
  floor?: number;
  categoryId: string;
  branchId: string;
  basePrice: number;
  notes?: string;
}

export interface CatalogRoomItem {
  id: string;
  roomNumber: string;
  floor: number | null;
  categoryId: string;
  categoryName: string;
  branchId: string;
  branchName: string;
  basePrice: number;
  status: string;
  notes: string | null;
  isActive: boolean;
}

export type CatalogData = {
  products: CatalogProductItem[];
  services: CatalogServiceItem[];
  categories: CatalogCategoryItem[];
};

export type CatalogExportType = "all" | "categories" | "products" | "services";

export const useCatalog = () => {
  const { resolveAccessToken } = useSessionAccess();
  const { profile, fetchProfile } = useAuth();

  const ensureProfile = async () => profile.value ?? await fetchProfile();

  const getAuthHeaders = async () => {
    const token = await resolveAccessToken();
    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage: "La sesion no esta disponible para gestionar catalogo.",
      });
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  };

  const toProductRequest = (payload: CatalogProductPayload) => ({
    name: payload.name,
    sku: payload.sku,
    description: payload.description,
    imageUrl: payload.imageUrl ?? "",
    costPrice: payload.costPrice,
    salePrice: payload.salePrice,
    categoryId: payload.categoryId,
    trackInventory: payload.trackInventory,
  });

  const toServiceRequest = (payload: CatalogServicePayload) => ({
    name: payload.name,
    description: payload.description,
    imageUrl: payload.imageUrl ?? "",
    price: payload.price,
    durationMinutes: payload.durationMinutes,
    categoryId: payload.categoryId,
  });

  const ensureOrganizationId = async () => {
    const currentProfile = await ensureProfile();
    if (!currentProfile?.organization_id) {
      throw createError({
        statusCode: 403,
        statusMessage: "No se encontro la organizacion asociada al catalogo.",
      });
    }

    return currentProfile.organization_id;
  };

  const loadProducts = async (): Promise<CatalogProductItem[]> => {
    await ensureOrganizationId();
    const products = await $fetch<CatalogProductItem[]>("/api/catalog/products", {
      headers: await getAuthHeaders(),
    });
    return products;
  };

  const loadServices = async (): Promise<CatalogServiceItem[]> => {
    await ensureOrganizationId();
    const services = await $fetch<CatalogServiceItem[]>("/api/catalog/services", {
      headers: await getAuthHeaders(),
    });
    return services;
  };

  const loadCategories = async (): Promise<CatalogCategoryItem[]> => {
    await ensureOrganizationId();
    const categories = await $fetch<CatalogCategoryItem[]>("/api/catalog/categories", {
      headers: await getAuthHeaders(),
    });
    return categories;
  };

  const loadCatalog = async (): Promise<CatalogData> => {
    const [products, services, categories] = await Promise.all([
      loadProducts(),
      loadServices(),
      loadCategories(),
    ]);

    const categoryMap = new Map(categories.map((category) => [category.id, category]));
    const productsCountByCategory = new Map<string, number>();
    const servicesCountByCategory = new Map<string, number>();

    for (const product of products) {
      if (product.categoryId) {
        productsCountByCategory.set(product.categoryId, (productsCountByCategory.get(product.categoryId) ?? 0) + 1);
      }
    }

    for (const service of services) {
      if (service.categoryId) {
        servicesCountByCategory.set(service.categoryId, (servicesCountByCategory.get(service.categoryId) ?? 0) + 1);
      }
    }

    return {
      products: products.map((product) => ({
        ...product,
        categoryName: product.categoryId ? (categoryMap.get(product.categoryId)?.name ?? null) : null,
      })),
      services: services.map((service) => ({
        ...service,
        categoryName: service.categoryId ? (categoryMap.get(service.categoryId)?.name ?? null) : null,
      })),
      categories: categories.map((category) => ({
        ...category,
        linkedCount: category.type === "product"
          ? (productsCountByCategory.get(category.id) ?? 0)
          : (servicesCountByCategory.get(category.id) ?? 0),
      })),
    };
  };

  const exportCatalog = async (type: CatalogExportType) => {
    await ensureOrganizationId();
    return await $fetch<string>("/api/catalog/export", {
      headers: await getAuthHeaders(),
      query: { type },
    });
  };

  const createProduct = async (payload: CatalogProductPayload) => {
    return await $fetch<{ success: boolean; productId: string }>("/api/catalog/products", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: toProductRequest(payload),
    });
  };

  const updateProduct = async (productId: string, payload: CatalogProductPayload) => {
    return await $fetch<{ success: boolean; productId: string }>(`/api/catalog/products/${productId}`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: toProductRequest(payload),
    });
  };

  const updateProductStatus = async (productId: string, isActive: boolean) => {
    return await $fetch<{ success: boolean; productId: string }>(`/api/catalog/products/${productId}/status`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: { isActive },
    });
  };

  const createService = async (payload: CatalogServicePayload) => {
    return await $fetch<{ success: boolean; serviceId: string }>("/api/catalog/services", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: toServiceRequest(payload),
    });
  };

  const updateService = async (serviceId: string, payload: CatalogServicePayload) => {
    return await $fetch<{ success: boolean; serviceId: string }>(`/api/catalog/services/${serviceId}`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: toServiceRequest(payload),
    });
  };

  const updateServiceStatus = async (serviceId: string, isActive: boolean) => {
    return await $fetch<{ success: boolean; serviceId: string }>(`/api/catalog/services/${serviceId}/status`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: { isActive },
    });
  };

  const createCategory = async (payload: CatalogCategoryPayload) => {
    return await $fetch<{ success: boolean; categoryId: string }>("/api/catalog/categories", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: payload,
    });
  };

  const updateCategory = async (categoryId: string, payload: CatalogCategoryPayload) => {
    return await $fetch<{ success: boolean; categoryId: string }>(`/api/catalog/categories/${categoryId}`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: payload,
    });
  };

  const updateCategoryStatus = async (categoryId: string, isActive: boolean) => {
    return await $fetch<{ success: boolean; categoryId: string }>(`/api/catalog/categories/${categoryId}/status`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: { isActive },
    });
  };

  const loadLodgingCategories = async (): Promise<CatalogCategoryItem[]> => {
    await ensureOrganizationId();
    return await $fetch<CatalogCategoryItem[]>("/api/catalog/categories", {
      headers: await getAuthHeaders(),
      params: { type: "lodging" },
    });
  };

  const createLodgingCategory = async (payload: CatalogCategoryPayload) => {
    return await $fetch<{ success: boolean; categoryId: string }>("/api/catalog/categories", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: { ...payload, type: "lodging" },
    });
  };

  const loadRooms = async (filters?: { branchId?: string; status?: string }): Promise<CatalogRoomItem[]> => {
    await ensureOrganizationId();
    return await $fetch<CatalogRoomItem[]>("/api/catalog/rooms", {
      headers: await getAuthHeaders(),
      params: filters,
    });
  };

  const loadAvailableRooms = async (filters: { checkIn: string; checkOut: string; branchId?: string }): Promise<CatalogRoomItem[]> => {
    await ensureOrganizationId();
    return await $fetch<CatalogRoomItem[]>("/api/catalog/rooms/available", {
      headers: await getAuthHeaders(),
      params: filters,
    });
  };

  const createRoom = async (payload: CatalogRoomPayload) => {
    return await $fetch<{ success: boolean; roomId: string }>("/api/catalog/rooms", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: payload,
    });
  };

  const updateRoom = async (roomId: string, payload: Partial<CatalogRoomPayload & { status: string }>) => {
    return await $fetch<{ success: boolean; roomId: string }>(`/api/catalog/rooms/${roomId}`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: payload,
    });
  };

  const updateRoomStatus = async (roomId: string, isActive: boolean) => {
    return await $fetch<{ success: boolean; roomId: string }>(`/api/catalog/rooms/${roomId}/status`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: { isActive },
    });
  };

  const deleteRoom = async (roomId: string) => {
    return await $fetch<{ success: boolean; roomId: string }>(`/api/catalog/rooms/${roomId}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
  };

  return {
    loadCatalog,
    exportCatalog,
    loadProducts,
    loadServices,
    loadCategories,
    createProduct,
    updateProduct,
    updateProductStatus,
    createService,
    updateService,
    updateServiceStatus,
    createCategory,
    updateCategory,
    updateCategoryStatus,
    loadLodgingCategories,
    createLodgingCategory,
    loadRooms,
    loadAvailableRooms,
    createRoom,
    updateRoom,
    updateRoomStatus,
    deleteRoom,
  };
};
