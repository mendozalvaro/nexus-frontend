import type { Database } from "@/types/database.types";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

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
  type: "product" | "service";
}

export interface CatalogCategoryItem {
  id: string;
  name: string;
  type: "product" | "service";
  parentId: string | null;
  parentName: string | null;
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

export interface CatalogData {
  products: CatalogProductItem[];
  services: CatalogServiceItem[];
  categories: CatalogCategoryItem[];
}

export const useCatalog = () => {
  const supabase = useSupabaseClient<Database>();
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
    const organizationId = await ensureOrganizationId();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true })
      .returns<ProductRow[]>();

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message,
      });
    }

    return (data ?? []).map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      description: product.description,
      imageUrl: product.image_url ?? null,
      costPrice: Number(product.cost_price ?? 0),
      salePrice: Number(product.sale_price),
      categoryId: product.category_id,
      categoryName: null,
      trackInventory: product.track_inventory ?? true,
      isActive: product.is_active ?? true,
    }));
  };

  const loadServices = async (): Promise<CatalogServiceItem[]> => {
    const organizationId = await ensureOrganizationId();
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true })
      .returns<ServiceRow[]>();

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message,
      });
    }

    return (data ?? []).map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      imageUrl: service.image_url ?? null,
      price: Number(service.price),
      durationMinutes: service.duration_minutes,
      categoryId: service.category_id,
      categoryName: null,
      isActive: service.is_active ?? true,
    }));
  };

  const loadCategories = async (): Promise<CatalogCategoryItem[]> => {
    const organizationId = await ensureOrganizationId();
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true })
      .returns<CategoryRow[]>();

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: error.message,
      });
    }

    const categoryMap = new Map((data ?? []).map((category) => [category.id, category]));
    return (data ?? []).map((category) => ({
      id: category.id,
      name: category.name,
      type: category.type as "product" | "service",
      parentId: category.parent_id,
      parentName: category.parent_id ? (categoryMap.get(category.parent_id)?.name ?? null) : null,
      isActive: category.is_active ?? true,
      linkedCount: 0,
    }));
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

  return {
    loadCatalog,
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
  };
};
