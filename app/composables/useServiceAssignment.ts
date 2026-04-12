import type { Database } from "@/types/database.types";

export interface ServiceAssignmentBranch {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
}

export interface ServiceAssignmentUser {
  id: string;
  fullName: string;
  role: Database["public"]["Enums"]["user_role"] | null;
  primaryBranchId: string | null;
}

export interface ServiceAssignmentService {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationMinutes: number;
  categoryId: string | null;
  categoryName: string | null;
  isActive: boolean;
  coveredBranchesCount: number;
  totalBranches: number;
  uncoveredBranchesCount: number;
  coveragePercent: number;
  assignedUsersCount: number;
  missingCoverage: boolean;
}

export interface ServiceAssignmentCoverageItem {
  branchId: string;
  userIds: string[];
}

export interface ServiceAssignmentOverview {
  organizationId: string;
  branches: ServiceAssignmentBranch[];
  services: ServiceAssignmentService[];
  branchUsers: Array<{
    branchId: string;
    users: ServiceAssignmentUser[];
  }>;
  assignments: Array<{
    id: string;
    userId: string;
    branchId: string;
    serviceIds: string[];
  }>;
}

export const useServiceAssignment = () => {
  const { resolveAccessToken } = useSessionAccess();

  const getAuthHeaders = async () => {
    const token = await resolveAccessToken();
    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage: "La sesion no esta disponible para gestionar asignacion de servicio.",
      });
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  };

  const loadOverview = async (): Promise<ServiceAssignmentOverview> => {
    return await $fetch<ServiceAssignmentOverview>("/api/service-assignment/overview", {
      headers: await getAuthHeaders(),
    });
  };

  const updateCoverage = async (serviceId: string, coverage: ServiceAssignmentCoverageItem[]) => {
    return await $fetch<{ success: boolean; serviceId: string }>(`/api/service-assignment/services/${serviceId}/coverage`, {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: { coverage },
    });
  };

  return {
    loadOverview,
    updateCoverage,
  };
};
