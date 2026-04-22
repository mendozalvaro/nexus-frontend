import { createError } from "h3";
import { z } from "zod";

import type { Database, Json } from "@/types/database.types";

import {
  getCatalogServiceOrThrow,
  readValidatedCatalogBody,
  requireCatalogContext,
} from "./catalog";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["employee_branch_assignments"]["Row"];
type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

export const serviceCoverageSchema = z.object({
  coverage: z.array(z.object({
    branchId: z.string().uuid("La sucursal es invalida."),
    userIds: z.array(z.string().uuid("El usuario es invalido.")).default([]),
  })),
});

export const parseServiceSkills = (value: Json | null): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
};

export const normalizeServiceSkills = (skills: string[]): string[] => {
  return Array.from(new Set(skills.filter(Boolean)));
};

export const requireServiceAssignmentContext = requireCatalogContext;
export const readValidatedServiceCoverageBody = readValidatedCatalogBody;

export const loadServiceAssignmentOverview = async (
  context: Awaited<ReturnType<typeof requireCatalogContext>>,
) => {
  const branchIds = context.allowedBranchIds.length > 0
    ? context.allowedBranchIds
    : ["00000000-0000-0000-0000-000000000000"];

  const [{ data: branches, error: branchesError }, { data: services, error: servicesError }, { data: categories, error: categoriesError }, { data: users, error: usersError }] = await Promise.all([
    context.adminClient
      .from("branches")
      .select("id, name, code, address, is_active")
      .eq("organization_id", context.organizationId)
      .eq("is_active", true)
      .in("id", branchIds)
      .order("name", { ascending: true })
      .returns<Array<Pick<BranchRow, "id" | "name" | "code" | "address" | "is_active">>>(),
    context.adminClient
      .from("services")
      .select("*")
      .eq("organization_id", context.organizationId)
      .order("name", { ascending: true })
      .returns<ServiceRow[]>(),
    context.adminClient
      .from("categories")
      .select("*")
      .eq("organization_id", context.organizationId)
      .eq("type", "service")
      .returns<CategoryRow[]>(),
    context.adminClient
      .from("profiles")
      .select("*")
      .eq("organization_id", context.organizationId)
      .eq("is_active", true)
      .in("role", ["admin", "manager", "employee"])
      .order("full_name", { ascending: true })
      .returns<ProfileRow[]>(),
  ]);

  const firstError = branchesError ?? servicesError ?? categoriesError ?? usersError;
  if (firstError) {
    throw createError({
      statusCode: 500,
      statusMessage: firstError.message,
    });
  }

  const branchRows = branches ?? [];
  const userRows = users ?? [];

  const { data: assignments, error: assignmentsError } = userRows.length > 0 && branchRows.length > 0
    ? await context.adminClient
        .from("employee_branch_assignments")
        .select("*")
        .in("user_id", userRows.map((user) => user.id))
        .in("branch_id", branchRows.map((branch) => branch.id))
        .returns<AssignmentRow[]>()
    : { data: [] as AssignmentRow[], error: null };

  if (assignmentsError) {
    throw createError({
      statusCode: 500,
      statusMessage: assignmentsError.message,
    });
  }

  return {
    branches: branchRows,
    services: services ?? [],
    categories: categories ?? [],
    users: userRows,
    assignments: assignments ?? [],
  };
};

export const assertUserOperatesInBranch = (
  user: ProfileRow,
  branchId: string,
  assignments: AssignmentRow[],
) => {
  const hasAssignment = assignments.some((assignment) => assignment.user_id === user.id && assignment.branch_id === branchId);
  if (!hasAssignment) {
    throw createError({
      statusCode: 409,
      statusMessage: `El usuario ${user.full_name} no opera en la sucursal seleccionada.`,
    });
  }
};

export const replaceServiceCoverage = async (
  context: Awaited<ReturnType<typeof requireCatalogContext>>,
  serviceId: string,
  coverage: Array<{ branchId: string; userIds: string[] }>,
) => {
  await getCatalogServiceOrThrow(context, serviceId);
  const { branches, users, assignments } = await loadServiceAssignmentOverview(context);
  const branchMap = new Map(branches.map((branch) => [branch.id, branch]));
  const userMap = new Map(users.map((user) => [user.id, user]));
  const assignmentMap = new Map(assignments.map((assignment) => [`${assignment.user_id}:${assignment.branch_id}`, assignment]));
  const branchCoverageMap = new Map<string, string[]>();

  for (const item of coverage) {
    if (!branchMap.has(item.branchId)) {
      throw createError({
        statusCode: 403,
        statusMessage: "La sucursal seleccionada no esta disponible para tu alcance.",
      });
    }

    const uniqueUserIds = Array.from(new Set(item.userIds));
    branchCoverageMap.set(item.branchId, uniqueUserIds);

    for (const userId of uniqueUserIds) {
      const user = userMap.get(userId);
      if (!user) {
        throw createError({
          statusCode: 404,
          statusMessage: "Uno de los usuarios seleccionados no esta disponible.",
        });
      }

      assertUserOperatesInBranch(user, item.branchId, assignments);
    }
  }

  for (const branch of branches) {
    const selectedUserIds = branchCoverageMap.get(branch.id) ?? [];
    const eligibleUsers = users.filter((user) => {
      return assignments.some((assignment) => assignment.user_id === user.id && assignment.branch_id === branch.id);
    });

    for (const user of eligibleUsers) {
      const key = `${user.id}:${branch.id}`;
      const assignment = assignmentMap.get(key) ?? null;
      const nextSkills = normalizeServiceSkills([
        ...parseServiceSkills(assignment?.skills ?? null).filter((skill) => skill !== serviceId),
        ...(selectedUserIds.includes(user.id) ? [serviceId] : []),
      ]);

      if (assignment) {
        const { error } = await context.adminClient
          .from("employee_branch_assignments")
          .update({ skills: nextSkills })
          .eq("id", assignment.id);

        if (error) {
          throw createError({
            statusCode: 500,
            statusMessage: error.message,
          });
        }

        continue;
      }

      if (selectedUserIds.includes(user.id)) {
        const { error } = await context.adminClient
          .from("employee_branch_assignments")
          .insert({
            user_id: user.id,
            branch_id: branch.id,
            is_primary: false,
            can_manage_inventory: false,
            can_override_prices: false,
            skills: [serviceId],
          });

        if (error) {
          throw createError({
            statusCode: 500,
            statusMessage: error.message,
          });
        }
      }
    }
  }
};
