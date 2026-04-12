export interface LandingNavigationItem {
  label: string
  id: string
}

export interface LandingFeatureItem {
  icon: string
  title: string
  description: string
}

export interface LandingStepItem {
  icon: string
  title: string
  description: string
}

export interface LandingPricingPlan {
  id: string
  name: string
  monthlyPrice: number
  description: string
  highlighted?: boolean
  badge?: string
  features: string[]
}

export interface LandingTestimonial {
  name: string
  role: string
  company: string
  quote: string
  initials: string
}

export interface LandingFAQItem {
  label: string
  content: string
  icon: string
}

export interface LandingFooterLink {
  label: string
  to?: string
  href?: string
  id?: string
}

export interface LandingFooterColumn {
  title: string
  links: LandingFooterLink[]
}

const navigation: LandingNavigationItem[] = [
  { label: "Features", id: "features" },
  { label: "Precios", id: "pricing" },
  { label: "Testimonios", id: "testimonials" },
  { label: "FAQ", id: "faq" },
]

const trustBadges = [
  "Sin tarjeta requerida",
  "14 dias gratis",
  "Cancela cuando quieras",
] as const

const features: LandingFeatureItem[] = [
  {
    icon: "i-lucide-calendar-range",
    title: "Agenda Inteligente",
    description: "Gestion de citas con deteccion de solapamientos y recordatorios automaticos.",
  },
  {
    icon: "i-lucide-shopping-cart",
    title: "POS Hibrido",
    description: "Vende productos y servicios en la misma transaccion, con control de stock en tiempo real.",
  },
  {
    icon: "i-lucide-building-2",
    title: "Multi-Sucursal",
    description: "Controla multiples ubicaciones desde un solo panel, con permisos granulares por rol.",
  },
  {
    icon: "i-lucide-chart-column-big",
    title: "Reportes en Tiempo Real",
    description: "Toma decisiones basadas en datos con dashboards personalizables y exportacion CSV.",
  },
  {
    icon: "i-lucide-shield-check",
    title: "Seguridad Empresarial",
    description: "Auditoria forense automatica, RLS a nivel de base de datos y mejores practicas listas para produccion.",
  },
  {
    icon: "i-lucide-sparkles",
    title: "Experiencia Cliente",
    description: "Portal web para que tus clientes reserven citas y compren productos 24/7.",
  },
]

const steps: LandingStepItem[] = [
  {
    icon: "i-lucide-user-plus",
    title: "Registra tu cuenta",
    description: "Crea tu organizacion en menos de 2 minutos. Sin tarjeta de credito.",
  },
  {
    icon: "i-lucide-sliders-horizontal",
    title: "Configura tu negocio",
    description: "Agrega servicios, productos, empleados y sucursales. Importa tus datos si lo necesitas.",
  },
  {
    icon: "i-lucide-rocket",
    title: "Listo para operar",
    description: "Comienza a vender, agendar y crecer. Actualiza o cancela cuando quieras.",
  },
]

const pricingPlans: LandingPricingPlan[] = [
  {
    id: "emprende",
    name: "Emprende",
    monthlyPrice: 20,
    description: "Ideal para negocios que estan digitalizando su primera operacion.",
    features: [
      "1 sucursal",
      "5 usuarios",
      "Citas y POS basico",
      "Inventario local",
      "Soporte por email",
    ],
  },
  {
    id: "crecimiento",
    name: "Crecimiento",
    monthlyPrice: 65,
    description: "La opcion recomendada para equipos que ya venden en varias lineas o sedes.",
    highlighted: true,
    badge: "Mas popular",
    features: [
      "5 sucursales",
      "Usuarios ilimitados",
      "Rol Manager",
      "Transferencias de stock",
      "Reportes comparativos",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: 200,
    description: "Para operaciones complejas que necesitan control avanzado, marca propia y soporte premium.",
    features: [
      "Sucursales ilimitadas",
      "API access",
      "White-label",
      "Forensic export",
      "Soporte prioritario",
    ],
  },
]

const testimonials: LandingTestimonial[] = [
  {
    name: "Valeria Guzman",
    role: "Directora Operativa",
    company: "Aura Studio Spa",
    quote: "Pasamos de manejar agenda y caja por separado a tener toda la operacion en una sola vista.",
    initials: "VG",
  },
  {
    name: "Mateo Salinas",
    role: "Founder",
    company: "Bicicentro Norte",
    quote: "El mix entre productos y servicios era un caos. Con NexusPOS ahora cobramos talleres y repuestos sin friccion.",
    initials: "MS",
  },
  {
    name: "Daniela Paredes",
    role: "Gerente General",
    company: "Casa Canela Beauty",
    quote: "La visibilidad por sucursal y los permisos por rol nos dieron orden desde la primera semana.",
    initials: "DP",
  },
  {
    name: "Renzo Quiroga",
    role: "Administrador",
    company: "PetLab Boutique",
    quote: "La auditoria automatica nos ayudo a cerrar caja con mas confianza y menos discusiones internas.",
    initials: "RQ",
  },
  {
    name: "Andrea Tellez",
    role: "Coordinadora Comercial",
    company: "Clinica Armonia",
    quote: "Las citas, ventas y stock viven en el mismo flujo. Eso cambio por completo nuestra atencion diaria.",
    initials: "AT",
  },
  {
    name: "Sebastian Rojas",
    role: "Owner",
    company: "Taller Urbano Store",
    quote: "Pudimos abrir una segunda sede sin duplicar herramientas ni perder control operativo.",
    initials: "SR",
  },
]

const faqItems: LandingFAQItem[] = [
  {
    label: "Necesito tarjeta de credito para la prueba?",
    content: "No. Puedes activar tu prueba de 14 dias sin registrar una tarjeta. Queremos que pruebes el flujo completo antes de comprometerte.",
    icon: "i-lucide-credit-card",
  },
  {
    label: "Puedo migrar mis datos desde otro sistema?",
    content: "Si. Te ayudamos a importar catalogos, clientes y configuraciones base para que el arranque sea mas rapido y ordenado.",
    icon: "i-lucide-arrow-right-left",
  },
  {
    label: "Que pasa si supero el limite de mi plan?",
    content: "Puedes cambiar de plan en cualquier momento. Si alcanzas un limite relevante, te avisaremos antes para que escales sin interrupciones.",
    icon: "i-lucide-trending-up",
  },
  {
    label: "Como funciona la facturacion?",
    content: "La facturacion es recurrente y transparente. Puedes elegir entre modalidad mensual o anual, revisar el estado desde tu cuenta y cancelar cuando quieras.",
    icon: "i-lucide-receipt",
  },
  {
    label: "Puedo cambiar de plan en cualquier momento?",
    content: "Si. Puedes subir o bajar de plan segun la etapa de tu negocio. Los cambios se reflejan desde el siguiente ciclo o de forma proporcional cuando aplique.",
    icon: "i-lucide-refresh-cw",
  },
  {
    label: "Ofrecen descuentos para organizaciones sin fines de lucro?",
    content: "Si. Tenemos condiciones preferenciales para proyectos sociales y organizaciones con impacto comunitario. Nuestro equipo comercial puede evaluarlo contigo.",
    icon: "i-lucide-heart-handshake",
  },
  {
    label: "Como se manejan los backups y la seguridad de mis datos?",
    content: "Aplicamos controles de acceso por rol, auditoria forense, politicas de seguridad en base de datos y estrategias de respaldo acordes a una operacion SaaS moderna.",
    icon: "i-lucide-shield",
  },
  {
    label: "Que metodos de pago aceptan?",
    content: "Aceptamos los medios de pago mas comunes para suscripciones empresariales. Si necesitas facturacion especial o acuerdos corporativos, podemos coordinarlo.",
    icon: "i-lucide-wallet",
  },
]

const footerColumns: LandingFooterColumn[] = [
  {
    title: "Producto",
    links: [
      { label: "Features", id: "features" },
      { label: "Precios", id: "pricing" },
      { label: "Changelog", href: "#" },
      { label: "Roadmap", href: "#" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { label: "Sobre nosotros", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Carreras", href: "#" },
      { label: "Contacto", href: "mailto:hola@nexuspos.app" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terminos", to: "/terms" },
      { label: "Privacidad", to: "/privacy" },
      { label: "Cookies", href: "#" },
      { label: "Seguridad", href: "#" },
    ],
  },
  {
    title: "Recursos",
    links: [
      { label: "FAQ", id: "faq" },
      { label: "Testimonios", id: "testimonials" },
      { label: "Demo", id: "product-tour" },
      { label: "Prueba gratis", to: "/auth/register" },
    ],
  },
]

/**
 * Centraliza la data y las interacciones de la landing para mantener consistencia
 * entre secciones, navegacion y cambios de tema.
 */
export const useLanding = () => {
  const colorMode = useColorMode()

  const toggleTheme = () => {
    colorMode.preference = colorMode.value === "dark" ? "light" : "dark"
  }

  /**
   * Hace scroll suave hacia una seccion si estamos en cliente y el elemento existe.
   */
  const scrollToSection = (id: string) => {
    if (!import.meta.client) {
      return
    }

    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const goToTop = () => {
    if (!import.meta.client) {
      return
    }

    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const navigateToAuth = (path: string) => navigateTo(path)

  return {
    colorMode,
    navigation,
    trustBadges,
    features,
    steps,
    pricingPlans,
    testimonials,
    faqItems,
    footerColumns,
    toggleTheme,
    scrollToSection,
    goToTop,
    navigateToAuth,
  }
}
