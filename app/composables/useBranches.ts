import type { Json } from "@/types/database.types";
import type { OrganizationCapabilities } from "@/types/subscription";
import { resolvePlanNumericLimit } from "@/utils/subscription-plan";

export type BranchWeekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface BranchBusinessHour {
  isOpen: boolean;
  open: string;
  close: string;
}

export type BranchBusinessHours = Record<BranchWeekday, BranchBusinessHour>;

export interface BranchSettings {
  businessHours: BranchBusinessHours;
}

export interface BranchOption {
  label: string;
  value: string;
}

export interface BranchStats {
  salesTotal: number;
  salesCount: number;
  employeesCount: number;
  appointmentsCount: number;
  lowStockCount: number;
}

export interface BranchListItem {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  settings: BranchSettings;
  stats: BranchStats;
}

export interface BranchInventoryItem {
  stockId: string;
  productId: string;
  productName: string;
  sku: string | null;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minStockLevel: number;
}

export interface BranchMutationPayload {
  name: string;
  code: string;
  address: string;
  phone: string;
  settings: BranchSettings;
}

export interface BranchTransferPayload {
  sourceBranchId: string;
  destinationBranchId: string;
  productId: string;
  quantity: number;
  note?: string;
}

export interface BranchPlanFeatures {
  featureMultiBranch: boolean;
  featureInventoryTransfer: boolean;
}

export interface BranchesData {
  organizationId: string;
  branches: BranchListItem[];
  capabilities: OrganizationCapabilities | null;
  planFeatures: BranchPlanFeatures;
}

export interface BranchDetailsData {
  organizationId: string;
  branch: BranchListItem;
  destinationBranches: BranchOption[];
  inventory: BranchInventoryItem[];
  capabilities: OrganizationCapabilities | null;
  planFeatures: BranchPlanFeatures;
}

const weekdayOrder: BranchWeekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const createDefaultBusinessHours = (): BranchBusinessHours => ({
  monday: { isOpen: true, open: "09:00", close: "18:00" },
  tuesday: { isOpen: true, open: "09:00", close: "18:00" },
  wednesday: { isOpen: true, open: "09:00", close: "18:00" },
  thursday: { isOpen: true, open: "09:00", close: "18:00" },
  friday: { isOpen: true, open: "09:00", close: "18:00" },
  saturday: { isOpen: true, open: "09:00", close: "14:00" },
  sunday: { isOpen: false, open: "09:00", close: "13:00" },
});

const serializeSettings = (settings: BranchSettings): Json => ({
  businessHours: weekdayOrder.reduce<Record<string, Json>>(
    (accumulator, day) => {
      accumulator[day] = {
        isOpen: settings.businessHours[day].isOpen,
        open: settings.businessHours[day].open,
        close: settings.businessHours[day].close,
      };
      return accumulator;
    },
    {},
  ),
});

export const useBranches = () => {
  const { resolveAccessToken } = useSessionAccess();
  const { profile, ensureContext } = useUserContext();
  const { loadCapabilities, getUpgradeMessage, canCreateResource } =
    useSubscription();

  const getAuthHeaders = async () => {
    const token = await resolveAccessToken();
    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage:
          "La sesión no está disponible para gestionar sucursales.",
      });
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  };

  const getAdminOrganizationId = async (): Promise<string> => {
    const context = await ensureContext({ requireProfile: true });
    const currentProfile = context.profile ?? profile.value;
    if (!currentProfile?.organization_id || currentProfile.role !== "admin") {
      throw createError({
        statusCode: 403,
        statusMessage: "Solo administradores pueden gestionar sucursales.",
      });
    }

    return currentProfile.organization_id;
  };

  const resolvePlanFeatures = (
    loadedCapabilities: OrganizationCapabilities | null,
  ): BranchPlanFeatures => {
    const maxBranches = resolvePlanNumericLimit(
      loadedCapabilities?.planLimits,
      ["branches", "branches.max"],
    ) ?? loadedCapabilities?.maxBranches ?? 1;

    return {
      featureInventoryTransfer: loadedCapabilities?.canTransferStock ?? false,
      featureMultiBranch: maxBranches > 1,
    };
  };

  const loadBranches = async (): Promise<BranchesData> => {
    const organizationId = await getAdminOrganizationId();
    const loadedCapabilities = await loadCapabilities(organizationId);
    const planFeatures = resolvePlanFeatures(loadedCapabilities);

    const {
      branches: branchList,
    } = await $fetch<{
      branches: BranchListItem[];
    }>("/api/admin/branches", {
      headers: await getAuthHeaders(),
    });

    return {
      organizationId,
      branches: branchList,
      capabilities: loadedCapabilities,
      planFeatures,
    };
  };

  const loadBranchDetails = async (
    branchId: string,
  ): Promise<BranchDetailsData> => {
    const organizationId = await getAdminOrganizationId();
    const loadedCapabilities = await loadCapabilities(organizationId);
    const planFeatures = resolvePlanFeatures(loadedCapabilities);

    const {
      branch,
      destinationBranches,
      inventory,
    } = await $fetch<{
      branch: BranchListItem;
      destinationBranches: BranchOption[];
      inventory: BranchInventoryItem[];
    }>(`/api/admin/branches/${branchId}`, {
      headers: await getAuthHeaders(),
    });

    return {
      organizationId,
      branch,
      destinationBranches,
      inventory,
      capabilities: loadedCapabilities,
      planFeatures,
    };
  };

  const createBranch = async (payload: BranchMutationPayload) => {
    return await $fetch("/api/admin/branches", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: {
        ...payload,
        settings: serializeSettings(payload.settings),
      },
    });
  };

  const updateBranch = async (
    branchId: string,
    payload: BranchMutationPayload,
  ) => {
    return await $fetch(`/api/admin/branches/${branchId}`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: {
        ...payload,
        settings: serializeSettings(payload.settings),
      },
    });
  };

  const updateBranchStatus = async (branchId: string, isActive: boolean) => {
    try {
      const result = await $fetch(`/api/admin/branches/${branchId}/status`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: { isActive },
      });
      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido";
      console.error("Failed to update branch status:", error);
      throw new Error(
        `No se pudo actualizar el estado de la sucursal: ${message}`,
      );
    }
  };

  const transferStock = async (payload: BranchTransferPayload) => {
    return await $fetch("/api/admin/branches/transfer-stock", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: {
        ...payload,
        note: payload.note?.trim() ?? "",
      },
    });
  };

  const branchLimitMessage = computed(() => getUpgradeMessage("branch"));

  const canCreateMoreBranches = computed(() => canCreateResource("branch"));

  const getMultiBranchMessage = (data: {
    capabilities: OrganizationCapabilities | null;
    planFeatures: BranchPlanFeatures;
  }) => {
    if (
      (data.capabilities?.currentBranchesCount ?? 0) < 1 ||
      data.planFeatures.featureMultiBranch
    ) {
      return null;
    }

    return "Tu plan actual solo permite operar con una sucursal activa. Actualiza tu suscripción para habilitar multi-sucursal.";
  };

  const getTransferUpgradeMessage = (data: {
    capabilities: OrganizationCapabilities | null;
    planFeatures: BranchPlanFeatures;
  }) => {
    if (
      data.planFeatures.featureInventoryTransfer &&
      data.capabilities?.canTransferStock
    ) {
      return null;
    }

    return "La transferencia de stock entre sucursales requiere un plan con inventario transferible habilitado.";
  };

  return {
    weekdayOrder,
    createDefaultBusinessHours,
    loadBranches,
    loadBranchDetails,
    createBranch,
    updateBranch,
    updateBranchStatus,
    transferStock,
    branchLimitMessage,
    canCreateMoreBranches,
    getMultiBranchMessage,
    getTransferUpgradeMessage,
  };
};
