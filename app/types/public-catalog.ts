export interface PublicCatalogMarketingData {
  heroTitle: string;
  heroSubtitle: string;
  about: string;
  whatsapp: string;
  instagram: string;
  city: string;
  shippingMessage: string;
  seasonalNote: string;
}

export interface PublicCatalogProduct {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  salePrice: number;
  categoryId: string | null;
  categoryName: string | null;
  categoryGroupId: string | null;
  categoryGroupName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
}

export interface PublicCatalogCategory {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  parentName: string | null;
}

export interface PublicCatalogResponse {
  organization: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    address: string | null;
    currencyCode: string | null;
    country: string | null;
  };
  marketing: PublicCatalogMarketingData;
  categories: PublicCatalogCategory[];
  products: PublicCatalogProduct[];
}
