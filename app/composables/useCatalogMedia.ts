import type { Database } from "@/types/database.types";

type CatalogImageKind = "product" | "service";

const CATALOG_MEDIA_BUCKET = "organization-assets";
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_OPTIMIZE_MAX_WIDTH = 1440;
const IMAGE_OPTIMIZE_MAX_HEIGHT = 1440;
const IMAGE_OPTIMIZE_QUALITY = 0.82;
const BRAND_PLACEHOLDER_URL: Record<CatalogImageKind, string> = {
  product: "/images/placeholders/catalog-product.svg",
  service: "/images/placeholders/catalog-service.svg",
};

const getFileExtension = (file: File): string => {
  if (file.type === "image/png") {
    return "png";
  }

  if (file.type === "image/webp") {
    return "webp";
  }

  return "jpg";
};

const getOptimizedDimensions = (width: number, height: number) => {
  if (width <= IMAGE_OPTIMIZE_MAX_WIDTH && height <= IMAGE_OPTIMIZE_MAX_HEIGHT) {
    return { width, height };
  }

  const scale = Math.min(
    IMAGE_OPTIMIZE_MAX_WIDTH / width,
    IMAGE_OPTIMIZE_MAX_HEIGHT / height,
  );

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const getSquareCropArea = (width: number, height: number) => {
  const size = Math.min(width, height);
  const offsetX = Math.max(0, Math.floor((width - size) / 2));
  const offsetY = Math.max(0, Math.floor((height - size) / 2));

  return {
    sx: offsetX,
    sy: offsetY,
    sw: size,
    sh: size,
  };
};

const loadImageElement = async (file: File): Promise<HTMLImageElement> => {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada."));
    });

    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export const useCatalogMedia = () => {
  const supabase = useSupabaseClient<Database>();
  const { user, profile, fetchProfile } = useAuth();
  const tenantLogoUrl = useState<string | null>("catalog:tenant-logo-url", () => null);
  const tenantLoaded = useState<boolean>("catalog:tenant-loaded", () => false);

  const ensureTenantContext = async () => {
    if (tenantLoaded.value) {
      return;
    }

    const currentProfile = profile.value ?? await fetchProfile();
    if (!currentProfile?.organization_id) {
      tenantLoaded.value = true;
      return;
    }

    const { data } = await supabase
      .from("organizations")
      .select("logo_url")
      .eq("id", currentProfile.organization_id)
      .maybeSingle();

    tenantLogoUrl.value = data?.logo_url ?? null;
    tenantLoaded.value = true;
  };

  const validateCatalogImage = (file: File) => {
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw createError({
        statusCode: 400,
        statusMessage: "La imagen supera el limite de 2MB.",
      });
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      throw createError({
        statusCode: 400,
        statusMessage: "Formato no permitido. Usa JPG, PNG o WebP.",
      });
    }
  };

  const optimizeImageForUploadWithOptions = async (
    file: File,
    options: { cropSquare?: boolean } = {},
  ): Promise<File> => {
    if (!import.meta.client) {
      return file;
    }

    const image = await loadImageElement(file);
    const naturalWidth = image.naturalWidth || image.width;
    const naturalHeight = image.naturalHeight || image.height;
    const cropArea = options.cropSquare
      ? getSquareCropArea(naturalWidth, naturalHeight)
      : {
          sx: 0,
          sy: 0,
          sw: naturalWidth,
          sh: naturalHeight,
        };
    const { width, height } = getOptimizedDimensions(cropArea.sw, cropArea.sh);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    context.drawImage(
      image,
      cropArea.sx,
      cropArea.sy,
      cropArea.sw,
      cropArea.sh,
      0,
      0,
      width,
      height,
    );

    const optimizedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", IMAGE_OPTIMIZE_QUALITY);
    });

    if (!optimizedBlob) {
      return file;
    }

    if (optimizedBlob.size >= file.size && !options.cropSquare) {
      return file;
    }

    const baseName = file.name.replace(/\.[^/.]+$/, "");
    return new File([optimizedBlob], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });
  };

  const uploadCatalogImage = async (
    file: File,
    kind: CatalogImageKind,
    options: { cropSquare?: boolean } = {},
  ): Promise<string> => {
    validateCatalogImage(file);
    const optimizedFile = await optimizeImageForUploadWithOptions(file, options);
    validateCatalogImage(optimizedFile);

    const currentProfile = profile.value ?? await fetchProfile();
    if (!user.value?.id || !currentProfile?.organization_id) {
      throw createError({
        statusCode: 401,
        statusMessage: "No se pudo validar la sesion para subir la imagen.",
      });
    }

    const extension = getFileExtension(optimizedFile);
    const fileName = `${crypto.randomUUID()}.${extension}`;
    const storagePath = `${user.value.id}/${currentProfile.organization_id}/catalog/${kind}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(CATALOG_MEDIA_BUCKET)
      .upload(storagePath, optimizedFile, {
        upsert: false,
        contentType: optimizedFile.type,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from(CATALOG_MEDIA_BUCKET)
      .getPublicUrl(storagePath);

    return data.publicUrl;
  };

  const resolveCatalogImage = (
    imageUrl: string | null | undefined,
    kind: CatalogImageKind,
  ): string => {
    if (imageUrl && imageUrl.trim()) {
      return imageUrl;
    }

    if (tenantLogoUrl.value && tenantLogoUrl.value.trim()) {
      return tenantLogoUrl.value;
    }

    return BRAND_PLACEHOLDER_URL[kind];
  };

  return {
    ensureTenantContext,
    uploadCatalogImage,
    resolveCatalogImage,
  };
};
