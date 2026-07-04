import type {
  StorefrontBusinessType,
  StorefrontColorPreset,
  StorefrontColorPresetKey,
  StorefrontSettings,
  StorefrontTemplateDefinition,
  StorefrontTemplateKey,
} from "@/types/storefront";

export const STOREFRONT_COLOR_PRESETS: StorefrontColorPreset[] = [
  { key: "neutral", label: "Neutro", primary: "#111827", secondary: "#F3F4F6", accent: "#2563EB" },
  { key: "warm", label: "Calido", primary: "#7C2D12", secondary: "#FFF7ED", accent: "#EA580C" },
  { key: "natural", label: "Natural", primary: "#14532D", secondary: "#F0FDF4", accent: "#16A34A" },
  { key: "premium", label: "Premium", primary: "#3B0764", secondary: "#FAF5FF", accent: "#A855F7" },
  { key: "industrial", label: "Industrial", primary: "#1F2937", secondary: "#E5E7EB", accent: "#F59E0B" },
  { key: "marine", label: "Marina", primary: "#0C4A6E", secondary: "#F0F9FF", accent: "#0284C7" },
];

export const STOREFRONT_TEMPLATES: StorefrontTemplateDefinition[] = [
  {
    key: "product-grocery",
    businessType: "product",
    label: "Abarrotes",
    shortLabel: "Abarrotes",
    sectionTitle: "Productos",
    description: "Catalogo directo para tienda de barrio, viveres y consumo rapido.",
    eyebrow: "Tienda cercana",
    heroTitle: "Lo esencial para el dia a dia, claro y rapido de encontrar.",
    heroSubtitle: "Presenta tus productos activos con una vitrina simple, precios visibles y navegacion directa.",
    design: {
      pattern: "Product Demo + Features",
      styleName: "Vibrant & Block-based",
      styleKeywords: ["bold", "energetic", "block layout", "high contrast", "modern"],
      effects: ["animated patterns", "bold hover shift", "large sections (48px+ gap)", "shadow cards"],
      headingFont: "'Rubik', sans-serif",
      bodyFont: "'Nunito Sans', sans-serif",
      recommendedColors: { primary: "#2563EB", secondary: "#3B82F6", accent: "#F97316", background: "#F8FAFC", text: "#1E293B" },
      defaultHeroImage: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&q=80",
    },
  },
  {
    key: "product-fashion",
    businessType: "product",
    label: "Ropa",
    shortLabel: "Ropa",
    sectionTitle: "Prendas",
    description: "Visual mas editorial para boutiques, moda y accesorios.",
    eyebrow: "Coleccion destacada",
    heroTitle: "Tu catalogo con una presencia mas visual y comercial.",
    heroSubtitle: "Ideal para marcas de moda, accesorios o productos con alto peso visual.",
    design: {
      pattern: "Portfolio Grid",
      styleName: "Liquid Glass",
      styleKeywords: ["editorial", "masonry", "gallery", "dark accent", "elegant"],
      effects: ["morphing elements (SVG/CSS)", "fluid animations (400-600ms)", "dynamic blur", "hover scale(1.02)"],
      headingFont: "'Playfair Display', serif",
      bodyFont: "'Inter', sans-serif",
      recommendedColors: { primary: "#18181B", secondary: "#FAFAFA", accent: "#F8FAFC", background: "#FAFAFA", text: "#09090B" },
      defaultHeroImage: "https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=1200&q=80",
    },
  },
  {
    key: "product-parts",
    businessType: "product",
    label: "Repuestos",
    shortLabel: "Repuestos",
    sectionTitle: "Repuestos y Articulos",
    description: "Enfoque funcional para repuestos, ferreteria y stock tecnico.",
    eyebrow: "Catalogo tecnico",
    heroTitle: "Encuentra repuestos y lineas activas sin perder tiempo.",
    heroSubtitle: "Pensado para catalogos de referencia, busqueda rapida y comunicacion comercial clara.",
    design: {
      pattern: "Functional Catalog + Quick Search",
      styleName: "Industrial & Precise",
      styleKeywords: ["functional", "industrial", "precise", "clean grid", "data-dense"],
      effects: ["flat cards with borders", "hover border highlight", "compact spacing", "monospace data"],
      headingFont: "'Rubik', sans-serif",
      bodyFont: "'Nunito Sans', sans-serif",
      recommendedColors: { primary: "#475569", secondary: "#CBD5E1", accent: "#F97316", background: "#F8FAFC", text: "#1E293B" },
      defaultHeroImage: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=80",
    },
  },
  {
    key: "service-salon",
    businessType: "service",
    label: "Salon",
    shortLabel: "Salon",
    sectionTitle: "Servicios",
    description: "Plantilla suave para belleza, spa y bienestar.",
    eyebrow: "Experiencia de servicio",
    heroTitle: "Muestra tus servicios con una identidad cercana y cuidada.",
    heroSubtitle: "Perfecta para salones, barberias, estetica y servicios orientados a experiencia.",
    design: {
      pattern: "Hero-Centric + Social Proof",
      styleName: "Soft UI Evolution",
      styleKeywords: ["soft UI", "pink", "rounded", "asymmetric", "elegant", "wellness"],
      effects: ["improved shadows (soft)", "rounded corners (24px)", "subtle glass overlay", "calm transitions (250ms)"],
      headingFont: "'Playfair Display', serif",
      bodyFont: "'Inter', sans-serif",
      recommendedColors: { primary: "#EC4899", secondary: "#FDF2F8", accent: "#8B5CF6", background: "#FFF5F9", text: "#831843" },
      defaultHeroImage: "https://images.unsplash.com/photo-1560750588-73207b1ef5b8?w=1200&q=80",
    },
  },
  {
    key: "service-clinic",
    businessType: "service",
    label: "Consultorio",
    shortLabel: "Consultorio",
    sectionTitle: "Especialidades",
    description: "Plantilla limpia para atencion profesional y confianza.",
    eyebrow: "Atencion profesional",
    heroTitle: "Comunica tus servicios y especialidades de forma clara.",
    heroSubtitle: "Util para consultorios, centros medicos y servicios donde prima claridad y confianza.",
    design: {
      pattern: "Trust & Authority + Conversion",
      styleName: "Accessible & Ethical",
      styleKeywords: ["high contrast", "clean", "professional", "WCAG compliant", "accessible"],
      effects: ["clear focus rings", "44px touch targets", "large text (16px+)", "reduced motion safe"],
      headingFont: "'Figtree', sans-serif",
      bodyFont: "'Noto Sans', sans-serif",
      recommendedColors: { primary: "#0E7490", secondary: "#CFFAFE", accent: "#10B981", background: "#F0FDFA", text: "#134E4A" },
      defaultHeroImage: "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=1200&q=80",
    },
  },
  {
    key: "service-technical",
    businessType: "service",
    label: "Tecnico",
    shortLabel: "Tecnico",
    sectionTitle: "Servicios Tecnicos",
    description: "Enfoque practico para talleres, soporte y asistencia tecnica.",
    eyebrow: "Servicio especializado",
    heroTitle: "Haz visible lo que ofreces y como ayudas a resolverlo.",
    heroSubtitle: "Funciona para talleres, soporte tecnico y servicios de instalacion o mantenimiento.",
    design: {
      pattern: "Conversion-Optimized + Trust",
      styleName: "Professional & Precise",
      styleKeywords: ["professional", "technical", "navy", "clean data", "monospace"],
      effects: ["improved shadows", "modern (200-300ms)", "focus visible", "WCAG AA+"],
      headingFont: "'Fira Code', monospace",
      bodyFont: "'Fira Sans', sans-serif",
      recommendedColors: { primary: "#1E293B", secondary: "#475569", accent: "#0284C7", background: "#F8FAFC", text: "#0F172A" },
      defaultHeroImage: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=1200&q=80",
    },
  },
  {
    key: "lodging-hostal",
    businessType: "lodging",
    label: "Hostal",
    shortLabel: "Hostal",
    sectionTitle: "Habitaciones",
    description: "Plantilla calida y accesible para hostales y hospedajes simples.",
    eyebrow: "Hospedaje accesible",
    heroTitle: "Presenta habitaciones y tarifas con una experiencia directa.",
    heroSubtitle: "Ideal para hostales, residenciales y operaciones practicas con foco en disponibilidad.",
    design: {
      pattern: "Storytelling + Social Proof",
      styleName: "Warm & Welcoming",
      styleKeywords: ["warm", "friendly", "simple", "accessible", "rounded"],
      effects: ["improved shadows", "rounded corners (16px)", "warm color accents", "calm transitions"],
      headingFont: "'Inter', sans-serif",
      bodyFont: "'Inter', sans-serif",
      recommendedColors: { primary: "#2563EB", secondary: "#3B82F6", accent: "#F59E0B", background: "#FFFBEB", text: "#1E293B" },
      defaultHeroImage: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80",
    },
  },
  {
    key: "lodging-hotel",
    businessType: "lodging",
    label: "Hotel",
    shortLabel: "Hotel",
    sectionTitle: "Habitaciones y Suites",
    description: "Visual mas premium para hoteles y alojamientos formales.",
    eyebrow: "Estadia destacada",
    heroTitle: "Convierte tu inventario de habitaciones en una vitrina cuidada.",
    heroSubtitle: "Pensada para hoteles, suites y alojamientos que necesitan una presencia mas elegante.",
    design: {
      pattern: "Video-First Hero",
      styleName: "Liquid Glass",
      styleKeywords: ["premium", "glass", "navy gold", "sophisticated", "luxury", "backdrop-blur"],
      effects: ["morphing elements (SVG/CSS)", "fluid animations (400-600ms)", "dynamic backdrop-blur", "glass overlay"],
      headingFont: "'Bodoni Moda', serif",
      bodyFont: "'Jost', sans-serif",
      recommendedColors: { primary: "#1E3A8A", secondary: "#DBEAFE", accent: "#CA8A04", background: "#F8FAFC", text: "#1E3A8A" },
      defaultHeroImage: "https://images.unsplash.com/photo-1587061949408-3530b8dfc6bb?w=1200&q=80",
    },
  },
  {
    key: "lodging-cabin",
    businessType: "lodging",
    label: "Cabana",
    shortLabel: "Cabana",
    sectionTitle: "Cabanas",
    description: "Estetica natural para cabanas, eco-lodges y estancias.",
    eyebrow: "Descanso y entorno",
    heroTitle: "Muestra tus habitaciones o cabanas con un tono mas natural.",
    heroSubtitle: "Util para experiencias de descanso, turismo y alojamiento con personalidad propia.",
    design: {
      pattern: "Trust & Authority + Data",
      styleName: "Organic Biophilic",
      styleKeywords: ["nature", "organic shapes", "green", "rounded", "flowing", "earthy"],
      effects: ["rounded corners (16-24px)", "organic curves (border-radius variations)", "natural shadows", "flowing SVG shapes"],
      headingFont: "'Cabin', sans-serif",
      bodyFont: "'Cabin', sans-serif",
      recommendedColors: { primary: "#0D9488", secondary: "#CCFBF1", accent: "#22C55E", background: "#ECFEFF", text: "#134E4A" },
      defaultHeroImage: "https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=1200&q=80",
    },
  },
];

export const getStorefrontColorPreset = (key: StorefrontColorPresetKey): StorefrontColorPreset =>
  STOREFRONT_COLOR_PRESETS.find((preset) => preset.key === key) ?? STOREFRONT_COLOR_PRESETS[0]!;

export const getStorefrontTemplate = (key: StorefrontTemplateKey): StorefrontTemplateDefinition =>
  STOREFRONT_TEMPLATES.find((template) => template.key === key) ?? STOREFRONT_TEMPLATES[0]!;

export const getTemplatesForBusinessType = (
  businessType: StorefrontBusinessType,
): StorefrontTemplateDefinition[] => STOREFRONT_TEMPLATES.filter((template) => template.businessType === businessType);

export const getDefaultTemplateKey = (businessType: StorefrontBusinessType): StorefrontTemplateKey =>
  getTemplatesForBusinessType(businessType)[0]?.key ?? "product-grocery";

export const getInitialsPlaceholder = (name: string, bgColor: string): string => {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <rect width="400" height="300" fill="${bgColor}"/>
    <text x="200" y="160" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif" font-size="72" font-weight="600" fill="white" fill-opacity="0.7">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

export const createDefaultStorefrontSettings = (
  organizationId: string,
  slug: string,
  businessType: StorefrontBusinessType,
): StorefrontSettings => {
  const colorPreset = getStorefrontColorPreset("neutral");

  return {
    organizationId,
    slug,
    businessType,
    templateKey: getDefaultTemplateKey(businessType),
    colorPresetKey: colorPreset.key,
    primaryColor: colorPreset.primary,
    secondaryColor: colorPreset.secondary,
    accentColor: colorPreset.accent,
    companyDescription: null,
    heroImageUrl: null,
    isPublished: false,
    updatedAt: null,
  };
};
