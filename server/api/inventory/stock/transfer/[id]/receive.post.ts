import { getRouterParam } from "h3";

import {
  applyInventoryStockMutation,
  assertInventoryModuleAccess,
  getInventoryBranchOrThrow,
  getInventoryProductOrThrow,
  getInventoryStockOrThrow,
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
      statusMessage: "La transferencia no es válida.",
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
      statusMessage: "No se encontró la transferencia solicitada.",
    });
  }

  if (transfer.status === "received") {
    return {
      success: true,
      transferId: transfer.id,
      status: transfer.status,
      idempotent: true,
    };
  }

  if (transfer.status !== "pending") {
    throw createError({
      statusCode: 409,
      statusMessage: "Solo se pueden recepcionar transferencias pendientes.",
    });
  }

  if (context.role === "manager" && !context.allowedBranchIds.includes(transfer.destination_branch_id)) {
    throw createError({
      statusCode: 403,
      statusMessage: "No tienes permisos para recepcionar transferencias en esta sucursal.",
    });
  }

  const destinationBranch = await getInventoryBranchOrThrow(context, transfer.destination_branch_id);
  const sourceBranch = await getInventoryBranchOrThrow(context, transfer.source_branch_id);
  const product = await getInventoryProductOrThrow(context, transfer.product_id);
  const destinationStock = await getInventoryStockOrThrow(context, transfer.destination_branch_id, transfer.product_id);

  // Apply stock first, then atomically claim the pending transfer. If claim fails,
  // rollback this credit so concurrent receives cannot duplicate stock.
  const destinationMutation = await applyInventoryStockMutation(context, {
    branchId: transfer.destination_branch_id,
    productId: transfer.product_id,
    mode: "add",
    quantity: transfer.quantity,
    minStockLevel: destinationStock?.min_stock_level ?? null,
  });

  const nowIso = new Date().toISOString();
  const { data: receivedTransfer, error: updateError } = await context.adminClient
    .from("inventory_transfers")
    .update({
      status: "received",
      received_at: nowIso,
      received_by: context.userId,
    })
    .eq("id", transfer.id)
    .eq("status", "pending")
    .select("id, status")
    .maybeSingle();

  if (updateError) {
    try {
      await applyInventoryStockMutation(context, {
        branchId: transfer.destination_branch_id,
        productId: transfer.product_id,
        mode: "remove",
        quantity: transfer.quantity,
      });
    } catch {
      throw createError({
        statusCode: 500,
        statusMessage: "Se acreditó stock en destino pero no se pudo confirmar la recepción. Requiere revisión manual.",
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: updateError.message,
    });
  }

  if (!receivedTransfer) {
    try {
      await applyInventoryStockMutation(context, {
        branchId: transfer.destination_branch_id,
        productId: transfer.product_id,
        mode: "remove",
        quantity: transfer.quantity,
      });
    } catch {
      throw createError({
        statusCode: 500,
        statusMessage: "Se detectó recepción concurrente y falló el rollback del stock temporal. Requiere revisión manual.",
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

    if (latestTransfer?.status === "received") {
      return {
        success: true,
        transferId: transfer.id,
        status: "received",
        idempotent: true,
      };
    }

    throw createError({
      statusCode: 409,
      statusMessage: "No se pudo completar la recepción porque la transferencia ya no está pendiente.",
    });
  }

  await insertInventoryMovement(context, {
    organization_id: context.organizationId,
    branch_id: transfer.destination_branch_id,
    product_id: transfer.product_id,
    movement_type: "transfer_in",
    quantity: transfer.quantity,
    previous_quantity: destinationMutation.previousQuantity,
    new_quantity: destinationMutation.newQuantity,
    reason: transfer.observations,
    note: transfer.internal_note,
    reference_type: "branch_transfer_reception",
    reference_id: transfer.id,
    source_branch_id: transfer.source_branch_id,
    destination_branch_id: transfer.destination_branch_id,
    created_by: context.userId,
  });

  await insertInventoryAudit(context, {
    recordId: transfer.id,
    event: "INVENTORY_STOCK_TRANSFER_RECEIVED",
    oldData: {
      transferStatus: "pending",
      destinationQuantity: destinationMutation.previousQuantity,
    },
    newData: {
      transferStatus: "received",
      destinationQuantity: destinationMutation.newQuantity,
      receivedBy: context.userId,
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
    status: "received",
  };
});
