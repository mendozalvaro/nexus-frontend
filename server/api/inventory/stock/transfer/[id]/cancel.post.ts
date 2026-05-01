import { getRouterParam } from "h3";

import {
  applyInventoryStockMutation,
  assertInventoryModuleAccess,
  getInventoryBranchOrThrow,
  getInventoryProductOrThrow,
  insertInventoryAudit,
  insertInventoryMovement,
  requireInventoryContext,
} from "../../../../../utils/inventory";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContext(event);
  await assertInventoryModuleAccess(context, "can_edit");

  const transferId = getRouterParam(event, "id");
  if (!transferId) {
    throw createError({
      statusCode: 400,
      statusMessage: "La transferencia no es valida.",
    });
  }

  const { data: transfer, error: transferError } = await context.adminClient
    .from("inventory_transfers")
    .select("*")
    .eq("id", transferId)
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (transferError) {
    throw createError({
      statusCode: 500,
      statusMessage: transferError.message,
    });
  }

  if (!transfer) {
    throw createError({
      statusCode: 404,
      statusMessage: "No se encontro la transferencia solicitada.",
    });
  }

  if (transfer.status === "cancelled") {
    return {
      success: true,
      transferId: transfer.id,
      status: "cancelled",
      idempotent: true,
    };
  }

  if (transfer.status !== "pending") {
    throw createError({
      statusCode: 409,
      statusMessage: "Solo se pueden rechazar transferencias pendientes.",
    });
  }

  if (context.role === "manager" && !context.allowedBranchIds.includes(transfer.destination_branch_id)) {
    throw createError({
      statusCode: 403,
      statusMessage: "No tienes permisos para rechazar transferencias en esta sucursal.",
    });
  }

  const sourceBranch = await getInventoryBranchOrThrow(context, transfer.source_branch_id);
  const destinationBranch = await getInventoryBranchOrThrow(context, transfer.destination_branch_id);
  const product = await getInventoryProductOrThrow(context, transfer.product_id);

  const sourceRevert = await applyInventoryStockMutation(context, {
    branchId: transfer.source_branch_id,
    productId: transfer.product_id,
    mode: "add",
    quantity: transfer.quantity,
  });

  const nowIso = new Date().toISOString();
  const { data: cancelledTransfer, error: updateError } = await context.adminClient
    .from("inventory_transfers")
    .update({
      status: "cancelled",
      cancelled_at: nowIso,
      cancelled_by: context.userId,
    })
    .eq("id", transfer.id)
    .eq("status", "pending")
    .select("id, status")
    .maybeSingle();

  if (updateError) {
    try {
      await applyInventoryStockMutation(context, {
        branchId: transfer.source_branch_id,
        productId: transfer.product_id,
        mode: "remove",
        quantity: transfer.quantity,
      });
    } catch {
      throw createError({
        statusCode: 500,
        statusMessage: "Se devolvio stock al origen pero no se pudo confirmar el rechazo. Requiere revision manual.",
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: updateError.message,
    });
  }

  if (!cancelledTransfer) {
    try {
      await applyInventoryStockMutation(context, {
        branchId: transfer.source_branch_id,
        productId: transfer.product_id,
        mode: "remove",
        quantity: transfer.quantity,
      });
    } catch {
      throw createError({
        statusCode: 500,
        statusMessage: "Se detecto rechazo concurrente y fallo el rollback del stock temporal. Requiere revision manual.",
      });
    }

    const { data: latestTransfer, error: latestTransferError } = await context.adminClient
      .from("inventory_transfers")
      .select("status")
      .eq("id", transfer.id)
      .eq("organization_id", context.organizationId)
      .maybeSingle();

    if (latestTransferError) {
      throw createError({
        statusCode: 500,
        statusMessage: latestTransferError.message,
      });
    }

    if (latestTransfer?.status === "cancelled") {
      return {
        success: true,
        transferId: transfer.id,
        status: "cancelled",
        idempotent: true,
      };
    }

    throw createError({
      statusCode: 409,
      statusMessage: "No se pudo completar el rechazo porque la transferencia ya no esta pendiente.",
    });
  }

  await insertInventoryMovement(context, {
    organization_id: context.organizationId,
    branch_id: transfer.source_branch_id,
    product_id: transfer.product_id,
    movement_type: "entry",
    quantity: transfer.quantity,
    previous_quantity: sourceRevert.previousQuantity,
    new_quantity: sourceRevert.newQuantity,
    reason: `Transferencia rechazada: ${transfer.observations ?? "sin observaciones"}`,
    note: transfer.internal_note,
    reference_type: "branch_transfer_cancelled",
    reference_id: transfer.id,
    source_branch_id: transfer.source_branch_id,
    destination_branch_id: transfer.destination_branch_id,
    created_by: context.userId,
  });

  await insertInventoryAudit(context, {
    recordId: transfer.id,
    event: "INVENTORY_STOCK_TRANSFER_CANCELLED",
    oldData: {
      transferStatus: "pending",
      sourceQuantity: sourceRevert.previousQuantity,
    },
    newData: {
      transferStatus: "cancelled",
      sourceQuantity: sourceRevert.newQuantity,
      cancelledBy: context.userId,
    },
    extraContext: {
      source_branch_name: sourceBranch.name,
      destination_branch_name: destinationBranch.name,
      product_name: product.name,
      quantity: transfer.quantity,
      observations: transfer.observations,
      internal_note: transfer.internal_note,
    },
  });

  return {
    success: true,
    transferId: transfer.id,
    status: "cancelled",
  };
});
