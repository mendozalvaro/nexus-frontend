import type { PublicStorefrontResponse } from "@/types/storefront";

export const usePublicStorefront = () => {
  const loadStorefrontBySlug = async (slug: string): Promise<PublicStorefrontResponse> => {
    const normalizedSlug = slug.trim().toLowerCase();
    if (!normalizedSlug) {
      throw createError({
        statusCode: 400,
        statusMessage: "Slug invalido para tienda virtual.",
      });
    }

    return await $fetch<PublicStorefrontResponse>(`/api/public/storefront/${normalizedSlug}`);
  };

  return {
    loadStorefrontBySlug,
  };
};
