import { loadServiceAssignmentOverview, parseServiceSkills, requireServiceAssignmentContext } from "../../utils/service-assignment";

import type { H3Event } from "h3";

export interface ServiceAssignmentBranch {
  id: string;
  name: string;
  code: string;
  address: string | null;
}

export interface ServiceAssignmentUser {
  id: string;
  fullName: string;
  role: string | null;
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

export interface ServiceAssignmentAssignment {
  id: string;
  userId: string;
  branchId: string;
  serviceIds: string[];
}

export interface ServiceAssignmentOverviewResult {
  organizationId: string;
  branches: ServiceAssignmentBranch[];
  services: ServiceAssignmentService[];
  branchUsers: Array<{ branchId: string; users: ServiceAssignmentUser[] }>;
  assignments: ServiceAssignmentAssignment[];
}

export async function getServiceAssignmentOverview(
  event: H3Event,
): Promise<ServiceAssignmentOverviewResult> {
  const context = await requireServiceAssignmentContext(event);
  const { branches, services, categories, users, assignments } = await loadServiceAssignmentOverview(context);
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const totalBranches = branches.length;
  const primaryAssignmentByUserId = new Map<string, string | null>();
  for (const assignment of assignments) {
    if (assignment.is_primary) {
      primaryAssignmentByUserId.set(assignment.user_id, assignment.branch_id);
      continue;
    }

    if (!primaryAssignmentByUserId.has(assignment.user_id)) {
      primaryAssignmentByUserId.set(assignment.user_id, assignment.branch_id);
    }
  }

  const branchUsers = branches.map((branch) => {
    const eligibleUsers = users.filter((user) => {
      return assignments.some((assignment) => assignment.user_id === user.id && assignment.branch_id === branch.id);
    });

    return {
      branchId: branch.id,
      users: eligibleUsers.map((user) => ({
        id: user.id,
        fullName: user.full_name,
        role: user.role,
        primaryBranchId: primaryAssignmentByUserId.get(user.id) ?? null,
      })),
    };
  });

  const servicesView = services.map((service) => {
    const coveredAssignments = assignments.filter((assignment) => parseServiceSkills(assignment.skills).includes(service.id));
    const coveredBranchIds = new Set(coveredAssignments.map((assignment) => assignment.branch_id));
    const coveredBranchesCount = coveredBranchIds.size;
    const uncoveredBranchesCount = Math.max(0, totalBranches - coveredBranchesCount);
    const coveragePercent = totalBranches > 0
      ? Math.round((coveredBranchesCount / totalBranches) * 100)
      : 0;

    return {
      id: service.id,
      name: service.name,
      description: service.description,
      price: Number(service.price),
      durationMinutes: service.duration_minutes,
      categoryId: service.category_id,
      categoryName: service.category_id ? (categoryMap.get(service.category_id)?.name ?? null) : null,
      isActive: service.is_active ?? true,
      coveredBranchesCount,
      totalBranches,
      uncoveredBranchesCount,
      coveragePercent,
      assignedUsersCount: coveredAssignments.length,
      missingCoverage: uncoveredBranchesCount > 0,
    };
  });

  return {
    organizationId: context.organizationId,
    branches: branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      code: branch.code,
      address: branch.address,
    })),
    services: servicesView,
    branchUsers,
    assignments: assignments.map((assignment) => ({
      id: assignment.id,
      userId: assignment.user_id,
      branchId: assignment.branch_id,
      serviceIds: parseServiceSkills(assignment.skills),
    })),
  };
}
