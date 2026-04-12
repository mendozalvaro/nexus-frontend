import type { Database } from "@/types/database.types";

export type UserRole = Database["public"]["Enums"]["user_role"];

export interface RoleDefinition {
  key: UserRole;
  label: string;
  homePath: string;
  allowedRoles: UserRole[];
  profilePath: string;
  settingsPath: string;
}

export interface RoleNavigationSeed {
  label: string;
  to: string;
}

export const roleDefinitions: Record<UserRole, RoleDefinition> = {
  admin: {
    key: "admin",
    label: "Administrador",
    homePath: "/dashboard",
    allowedRoles: ["admin"],
    profilePath: "/profile",
    settingsPath: "/settings",
  },
  manager: {
    key: "manager",
    label: "Manager",
    homePath: "/dashboard",
    allowedRoles: ["admin", "manager"],
    profilePath: "/profile",
    settingsPath: "/profile",
  },
  employee: {
    key: "employee",
    label: "Empleado",
    homePath: "/dashboard",
    allowedRoles: ["admin", "manager", "employee"],
    profilePath: "/profile",
    settingsPath: "/profile",
  },
  client: {
    key: "client",
    label: "Cliente",
    homePath: "/client/dashboard",
    allowedRoles: ["client"],
    profilePath: "/client/profile",
    settingsPath: "/client/profile",
  },
};

export const roleNavigationSeeds: Record<UserRole, RoleNavigationSeed[]> = {
  admin: [
    { label: "Dashboard", to: "/dashboard" },
    { label: "Catalogo", to: "/catalogo" },
    { label: "Sucursales", to: "/branches" },
    { label: "Usuarios", to: "/users" },
    { label: "Inventario", to: "/inventory" },
    { label: "Asignacion Servicio", to: "/service-assignment" },
    { label: "Citas", to: "/appointments" },
    { label: "Ventas", to: "/pos" },
    { label: "Configuracion", to: "/settings" },
    { label: "Reportes", to: "/reports" },
  ],
  manager: [
    { label: "Dashboard", to: "/dashboard" },
    { label: "Catalogo", to: "/catalogo" },
    { label: "Usuarios", to: "/users" },
    { label: "Inventario", to: "/inventory" },
    { label: "Asignacion Servicio", to: "/service-assignment" },
    { label: "Citas", to: "/appointments" },
    { label: "Ventas", to: "/pos" },
    { label: "Reportes", to: "/reports" },
  ],
  employee: [
    { label: "Dashboard", to: "/dashboard" },
    { label: "Mi Agenda", to: "/appointments" },
    { label: "Ventas", to: "/pos" },
    { label: "Configuracion", to: "/profile" },
  ],
  client: [
    { label: "Mi portal", to: "/client/dashboard" },
    { label: "Mis citas", to: "/client/appointments" },
    { label: "Reservas", to: "/client/bookings" },
    { label: "Mi perfil", to: "/client/profile" },
  ],
};

export const roleRoutePrefixes: Array<{ prefix: string; role: UserRole }> = [];
