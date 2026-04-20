import type { NavigationItem } from "@/types/permissions";

export const PENDING_ALLOWED_PATH_PREFIXES = [
  "/dashboard",
  "/catalogo",
  "/users",
  "/branches",
  "/settings",
  "/inventory",
  "/service-assignment",
  "/profile",
  "/select-branch",
] as const;

export const PENDING_ACTIVATION_PATH = "/dashboard?status=pending";

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    label: "Dashboard",
    icon: "i-heroicons-home",
    to: "/dashboard",
    permission: "profile.view",
    roles: ["admin", "manager", "employee"],
    pendingAccess: "allowed",
  },
  {
    label: "POS",
    icon: "i-heroicons-shopping-cart",
    to: "/pos",
    permission: "pos.view",
    roles: ["admin", "manager", "employee"],
    requiresBranch: true,
    pendingAccess: "activation",
  },
  {
    label: "Catalogo",
    icon: "i-heroicons-rectangle-stack",
    to: "/catalogo",
    permission: "catalog.view",
    roles: ["admin", "manager"],
    pendingAccess: "allowed",
  },
  {
    label: "Inventario",
    icon: "i-heroicons-archive-box",
    to: "/inventory",
    permission: "inventory.view",
    roles: ["admin", "manager"],
    featureFlag: "feature_inventory",
    requiresBranch: true,
    pendingAccess: "allowed",
  },
  {
    label: "Asignacion Servicio",
    icon: "i-heroicons-user-group",
    to: "/service-assignment",
    permission: "service_assignment.view",
    roles: ["admin", "manager"],
    pendingAccess: "allowed",
  },
  {
    label: "Citas",
    icon: "i-heroicons-calendar-days",
    to: "/appointments",
    permission: "appointments.view",
    roles: ["admin", "manager", "employee"],
    pendingAccess: "activation",
  },
  {
    label: "Usuarios",
    icon: "i-heroicons-users",
    to: "/users",
    permission: "users.view",
    roles: ["admin", "manager"],
    pendingAccess: "allowed",
  },
  {
    label: "Sucursales",
    icon: "i-heroicons-building-office-2",
    to: "/branches",
    permission: "branches.view",
    roles: ["admin"],
    featureFlag: "feature_multi_branch",
    pendingAccess: "allowed",
  },
  {
    label: "Reportes",
    icon: "i-heroicons-chart-bar",
    to: "/reports",
    permission: "reports.view",
    roles: ["admin", "manager"],
    pendingAccess: "activation",
  },
  {
    label: "Configuracion",
    icon: "i-heroicons-cog-6-tooth",
    to: "/settings",
    permission: "settings.view",
    roles: ["admin"],
    pendingAccess: "allowed",
  },
  {
    label: "Perfil",
    icon: "i-heroicons-user-circle",
    to: "/profile",
    permission: "profile.view",
    roles: ["admin", "manager", "employee"],
    pendingAccess: "allowed",
  },
];

export const CLIENT_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    label: "Mi portal",
    icon: "i-heroicons-home",
    to: "/client/dashboard",
    permission: "profile.view",
    roles: ["client"],
    pendingAccess: "allowed",
  },
  {
    label: "Mis citas",
    icon: "i-heroicons-calendar-days",
    to: "/client/appointments",
    permission: "appointments.view",
    roles: ["client"],
    pendingAccess: "allowed",
  },
  {
    label: "Reservas",
    icon: "i-heroicons-ticket",
    to: "/client/bookings",
    permission: "appointments.view",
    roles: ["client"],
    pendingAccess: "allowed",
  },
  {
    label: "Mi actividad",
    icon: "i-heroicons-chart-bar",
    to: "/client/reports",
    permission: "reports.view",
    roles: ["client"],
    pendingAccess: "allowed",
  },
  {
    label: "Mi perfil",
    icon: "i-heroicons-user-circle",
    to: "/client/profile",
    permission: "profile.view",
    roles: ["client"],
    pendingAccess: "allowed",
  },
];

export const SYSTEM_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    label: "Resumen",
    icon: "i-heroicons-chart-pie",
    to: "/system",
  },
  {
    label: "Planes y Roles",
    icon: "i-heroicons-shield-check",
    to: "/system/access",
  },
  {
    label: "Validacion de pagos",
    icon: "i-heroicons-credit-card",
    to: "/system/payment-validations",
  },
  {
    label: "Usuarios",
    icon: "i-heroicons-users",
    to: "/system/users",
  },
  {
    label: "Perfil",
    icon: "i-heroicons-user-circle",
    to: "/system/profile",
  },
];
