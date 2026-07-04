import type { FeatureFlag } from "@/composables/useFeatureFlags";
import type { UserRole } from "@/types/permissions";

export type BusinessType = "product" | "service" | "lodging";

export type ModuleAccessKey =
  | "dashboard"
  | "clients"
  | "users"
  | "branches"
  | "settings"
  | "profile"
  | "pos.sales"
  | "inventory"
  | "appointments"
  | "service_assignment"
  | "reservations"
  | "catalog"
  | "catalog.products"
  | "catalog.services"
  | "catalog.rooms"
  | "reports"
  | "reports.sales"
  | "reports.services"
  | "reports.lodging"
  | "client.dashboard"
  | "client.appointments"
  | "client.bookings"
  | "client.profile";

export interface ModuleAccessDefinition {
  key: ModuleAccessKey;
  label?: string;
  icon?: string;
  to?: string;
  routePrefixes: string[];
  roles: UserRole[];
  allowedBusinessTypes?: BusinessType[];
  requiredPlanPermission?: string;
  featureFlag?: FeatureFlag;
  requiresBranch?: boolean;
  pendingAccess?: "allowed" | "activation";
  requiredAny?: ModuleAccessKey[];
}

export const MODULE_ACCESS_REGISTRY: Record<ModuleAccessKey, ModuleAccessDefinition> = {
  dashboard: {
    key: "dashboard",
    label: "Dashboard",
    icon: "i-heroicons-home",
    to: "/dashboard",
    routePrefixes: ["/dashboard"],
    roles: ["admin", "manager", "employee"],
    pendingAccess: "allowed",
  },
  clients: {
    key: "clients",
    label: "Clientes",
    icon: "i-heroicons-user-group",
    to: "/customers",
    routePrefixes: ["/customers"],
    roles: ["admin", "manager"],
    allowedBusinessTypes: ["product", "service", "lodging"],
    requiredPlanPermission: "clients",
    pendingAccess: "allowed",
  },
  users: {
    key: "users",
    label: "Usuarios",
    icon: "i-heroicons-identification",
    to: "/users",
    routePrefixes: ["/users"],
    roles: ["admin", "manager"],
    requiredPlanPermission: "users",
    pendingAccess: "allowed",
  },
  branches: {
    key: "branches",
    label: "Sucursales",
    icon: "i-heroicons-building-office-2",
    to: "/branches",
    routePrefixes: ["/branches"],
    roles: ["admin"],
    requiredPlanPermission: "branches",
    featureFlag: "feature_multi_branch",
    pendingAccess: "allowed",
  },
  settings: {
    key: "settings",
    label: "Configuracion",
    icon: "i-heroicons-cog-6-tooth",
    to: "/settings",
    routePrefixes: ["/settings"],
    roles: ["admin"],
    requiredPlanPermission: "settings",
    pendingAccess: "allowed",
  },
  profile: {
    key: "profile",
    label: "Perfil",
    icon: "i-heroicons-user-circle",
    to: "/profile",
    routePrefixes: ["/profile", "/select-branch", "/unauthorized"],
    roles: ["admin", "manager", "employee"],
    pendingAccess: "allowed",
  },
  "pos.sales": {
    key: "pos.sales",
    label: "Ventas",
    icon: "i-heroicons-shopping-cart",
    to: "/pos/sell",
    routePrefixes: ["/pos", "/pos/sell", "/pos/charge"],
    roles: ["admin", "manager", "employee"],
    allowedBusinessTypes: ["product"],
    requiredPlanPermission: "pos.sales",
    requiresBranch: true,
    pendingAccess: "activation",
  },
  inventory: {
    key: "inventory",
    label: "Inventario",
    icon: "i-heroicons-archive-box",
    to: "/inventory",
    routePrefixes: ["/inventory"],
    roles: ["admin", "manager"],
    allowedBusinessTypes: ["product"],
    requiredPlanPermission: "inventory",
    featureFlag: "feature_inventory",
    requiresBranch: true,
    pendingAccess: "allowed",
  },
  appointments: {
    key: "appointments",
    label: "Citas",
    icon: "i-heroicons-calendar-days",
    to: "/appointments",
    routePrefixes: ["/appointments"],
    roles: ["admin", "manager", "employee"],
    allowedBusinessTypes: ["service"],
    requiredPlanPermission: "appointments",
    pendingAccess: "activation",
  },
  service_assignment: {
    key: "service_assignment",
    label: "Asignacion Servicio",
    icon: "i-heroicons-clipboard-document-check",
    to: "/service-assignment",
    routePrefixes: ["/service-assignment"],
    roles: ["admin", "manager"],
    allowedBusinessTypes: ["service"],
    requiredPlanPermission: "service_assignment",
    pendingAccess: "allowed",
  },
  reservations: {
    key: "reservations",
    label: "Reservas",
    icon: "i-heroicons-calendar",
    to: "/reservations",
    routePrefixes: ["/reservations"],
    roles: ["admin", "manager", "employee"],
    allowedBusinessTypes: ["lodging"],
    requiredPlanPermission: "reservations",
    featureFlag: "feature_hotel_module",
    pendingAccess: "allowed",
  },
  catalog: {
    key: "catalog",
    label: "Catalogo",
    icon: "i-heroicons-rectangle-stack",
    to: "/catalogo",
    routePrefixes: ["/catalogo"],
    roles: ["admin", "manager"],
    allowedBusinessTypes: ["product", "service", "lodging"],
    pendingAccess: "allowed",
    requiredAny: ["catalog.products", "catalog.services", "catalog.rooms"],
  },
  "catalog.products": {
    key: "catalog.products",
    routePrefixes: ["/catalogo"],
    roles: ["admin", "manager"],
    allowedBusinessTypes: ["product"],
    requiredPlanPermission: "catalog.products",
  },
  "catalog.services": {
    key: "catalog.services",
    routePrefixes: ["/catalogo"],
    roles: ["admin", "manager"],
    allowedBusinessTypes: ["service"],
    requiredPlanPermission: "catalog.services",
  },
  "catalog.rooms": {
    key: "catalog.rooms",
    routePrefixes: ["/catalogo"],
    roles: ["admin", "manager"],
    allowedBusinessTypes: ["lodging"],
    requiredPlanPermission: "catalog.rooms",
    featureFlag: "feature_hotel_module",
  },
  reports: {
    key: "reports",
    label: "Reportes",
    icon: "i-heroicons-chart-bar",
    to: "/reports",
    routePrefixes: ["/reports"],
    roles: ["admin", "manager"],
    allowedBusinessTypes: ["product", "service", "lodging"],
    pendingAccess: "activation",
    requiredAny: ["reports.sales", "reports.services", "reports.lodging"],
  },
  "reports.sales": {
    key: "reports.sales",
    routePrefixes: ["/reports"],
    roles: ["admin", "manager"],
    allowedBusinessTypes: ["product"],
    requiredPlanPermission: "reports.sales",
  },
  "reports.services": {
    key: "reports.services",
    routePrefixes: ["/reports"],
    roles: ["admin", "manager"],
    allowedBusinessTypes: ["service"],
    requiredPlanPermission: "reports.services",
  },
  "reports.lodging": {
    key: "reports.lodging",
    routePrefixes: ["/reports"],
    roles: ["admin", "manager"],
    allowedBusinessTypes: ["lodging"],
    requiredPlanPermission: "reports.lodging",
    featureFlag: "feature_hotel_module",
  },
  "client.dashboard": {
    key: "client.dashboard",
    label: "Mi portal",
    icon: "i-heroicons-home",
    to: "/client/dashboard",
    routePrefixes: ["/client/dashboard", "/client"],
    roles: ["client"],
    pendingAccess: "allowed",
  },
  "client.appointments": {
    key: "client.appointments",
    label: "Mis citas",
    icon: "i-heroicons-calendar-days",
    to: "/client/appointments",
    routePrefixes: ["/client/appointments"],
    roles: ["client"],
    pendingAccess: "allowed",
  },
  "client.bookings": {
    key: "client.bookings",
    label: "Reservas",
    icon: "i-heroicons-ticket",
    to: "/client/bookings",
    routePrefixes: ["/client/bookings", "/client/checkout"],
    roles: ["client"],
    pendingAccess: "allowed",
  },
  "client.profile": {
    key: "client.profile",
    label: "Mi perfil",
    icon: "i-heroicons-user-circle",
    to: "/client/profile",
    routePrefixes: ["/client/profile"],
    roles: ["client"],
    pendingAccess: "allowed",
  },
};

export const TENANT_NAVIGATION_MODULES: ModuleAccessKey[] = [
  "dashboard",
  "pos.sales",
  "catalog",
  "inventory",
  "service_assignment",
  "appointments",
  "reservations",
  "clients",
  "users",
  "branches",
  "reports",
  "settings",
  "profile",
];

export const CLIENT_NAVIGATION_MODULES: ModuleAccessKey[] = [
  "client.dashboard",
  "client.appointments",
  "client.bookings",
  "client.profile",
];

export const MODULE_ACCESS_KEYS = Object.keys(MODULE_ACCESS_REGISTRY) as ModuleAccessKey[];
