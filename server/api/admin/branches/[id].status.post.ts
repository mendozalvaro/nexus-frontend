import { createError } from "h3";

import {
  branchStatusSchema,
  ensureAtLeastOneActiveBranch,
  getAdminBranchOrThrow,
  readValidatedBranchBody,
  requireBranchAdminContext,
} from "../../../utils/admin-branches";

export default defineEventHandler(async (event) => {
  try {
    const context = await requireBranchAdminContext(event);
    const branchId = getRouterParam(event, "id");

    if (!branchId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Debes indicar la sucursal a actualizar.",
      });
    }

    const body = await readValidatedBranchBody(event, branchStatusSchema);
    const branch = await getAdminBranchOrThrow(
      context.adminClient,
      context.organizationId,
      branchId,
    );

    if (branch.is_active === body.isActive) {
      return {
        success: true,
        branchId,
        message: "El estado de la sucursal ya es el solicitado.",
      };
    }

    await ensureAtLeastOneActiveBranch(
      context.adminClient,
      context.organizationId,
      branchId,
      body.isActive,
    );

    const { error, data } = await context.adminClient
      .from("branches")
      .update({ is_active: body.isActive })
      .eq("organization_id", context.organizationId)
      .eq("id", branchId)
      .select("id, name, is_active")
      .single();

    if (error) {
      console.error("Error updating branch status:", error);
      throw createError({
        statusCode: 500,
        statusMessage: `No se pudo actualizar el estado de la sucursal: ${error.message}`,
      });
    }

    return {
      success: true,
      branchId,
      updatedBranch: data,
      message: `Sucursal ${body.isActive ? "activada" : "desactivada"} correctamente.`,
    };
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      throw err;
    }
    console.error("Unexpected error in branch status update:", err);
    throw createError({
      statusCode: 500,
      statusMessage: "Error inesperado al actualizar el estado de la sucursal.",
    });
  }
});
