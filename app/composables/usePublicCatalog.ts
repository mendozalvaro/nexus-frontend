import type { PublicCatalogResponse } from "@/types/public-catalog";

export const usePublicCatalog = () => {
  const loadCatalogBySlug = async (slug: string): Promise<PublicCatalogResponse> => {
    const normalizedSlug = slug.trim().toLowerCase();
    if (!normalizedSlug) {
      throw createError({
        statusCode: 400,
        statusMessage: "Slug invalido para catalogo publico.",
      });
    }

    return await $fetch<PublicCatalogResponse>(`/api/public/catalog/${normalizedSlug}`);
  };

  return {
    loadCatalogBySlug,
  };
};
