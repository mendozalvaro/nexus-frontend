import { getRouterParam } from "h3";

import {
  applyInventoryStockMutation,
  assertInventoryModuleAccess,
  insertInventoryAudit,
  insertInventoryMovement,
  requireInventoryContext,
} from "../../../../../utils/inventory";

type TransferBatchRow = {
  id: string;
  source_branch_id: string;
  destination_branch_id: string;
  status: "pending" | "received" | "cancelled";
  internal_note: string | null;
  observations: string | null;
};

type TransferBatchLineRow = {
  product_id: string;
  quantity: number;
};

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContext(event);
  await assertInventoryModuleAccess(context, "can_edit");

  const batchId = getRouterParam(event, "id");
  if (!batchId) {
    throw createError({
      statusCode: 400,
      statusMessage: "El lote de transferencia no es valido.",
    });
  }

  const { data: batch, error: batchError } = await context.adminClient
    .from("inventory_transfer_batches" as never)
    .select("id, source_branch_id, destination_branch_id, status, internal_note, observations")
    .eq("id", batchId)
    .eq("organization_id", context.organizationId)
    .maybeSingle<TransferBatchRow>();

  if (batchError) {
    throw createError({
      statusCode: 500,
      statusMessage: batchError.message,
    });
  }

  if (!batch) {
    throw createError({
      statusCode: 404,
      statusMessage: "No se encontro el lote de transferencia solicitado.",
    });
  }

  if (batch.status === "cancelled") {
    return {
      success: true,
      batchId: batch.id,
      processedCount: 0,
      idempotent: true,
      status: "cancelled",
    };
  }

  if (batch.status !== "pending") {
    throw createError({
      statusCode: 409,
      statusMessage: "Solo se pueden rechazar lotes de transferencia pendientes.",
    });
  }

  if (context.role === "manager" && !context.allowedBranchIds.includes(batch.destination_branch_id)) {
    throw createError({
      statusCode: 403,
      statusMessage: "No tienes permisos para rechazar este lote de transferencia.",
    });
  }

  const { data: lines, error: linesError } = await context.adminClient
    .from("inventory_transfer_batch_lines" as never)
    .select("product_id, quantity")
    .eq("batch_id", batch.id)
    .returns<TransferBatchLineRow[]>();

  if (linesError) {
    throw createError({
      statusCode: 500,
      statusMessage: linesError.message,
    });
  }

  const transferLines = lines ?? [];
  if (transferLines.length === 0) {
    throw createError({
      statusCode: 409,
      statusMessage: "El lote no contiene lineas para rechazar.",
    });
  }

  const appliedReverts: Array<{ productId: string; quantity: number }> = [];
  const movementEntries: Array<{
    productId: string;
    quantity: number;
    previousQuantity: number;
    newQuantity: number;
  }> = [];

  try {
    for (const line of transferLines) {
      const mutation = await applyInventoryStockMutation(context, {
        branchId: batch.source_branch_id,
        productId: line.product_id,
        mode: "add",
        quantity: line.quantity,
      });

      appliedReverts.push({
        productId: line.product_id,
        quantity: line.quantity,
      });

      movementEntries.push({
        productId: line.product_id,
        quantity: line.quantity,
        previousQuantity: mutation.previousQuantity,
        newQuantity: mutation.newQuantity,
      });
    }
  } catch (error) {
    for (const revert of appliedReverts.reverse()) {
      try {
        await applyInventoryStockMutation(context, {
          branchId: batch.source_branch_id,
          productId: revert.productId,
          mode: "remove",
          quantity: revert.quantity,
        });
      } catch {
        throw createError({
          statusCode: 500,
          statusMessage: "Fallo el rechazo del lote y no se pudo completar el rollback del stock. Requiere revision manual.",
        });
      }
    }

    throw error;
  }

  const { data: cancelledBatch, error: updateBatchError } = await context.adminClient
    .from("inventory_transfer_batches" as never)
    .update({
      status: "cancelled",
    } as never)
    .eq("id", batch.id)
    .eq("status", "pending")
    .select("id, status")
    .maybeSingle<{ id: string; status: "pending" | "received" | "cancelled" }>();

  if (updateBatchError) {
    for (const revert of appliedReverts.reverse()) {
      await applyInventoryStockMutation(context, {
        branchId: batch.source_branch_id,
        productId: revert.productId,
        mode: "remove",
        quantity: revert.quantity,
      });
    }

    throw createError({
      statusCode: 500,
      statusMessage: updateBatchError.message,
    });
  }

  if (!cancelledBatch) {
    for (const revert of appliedReverts.reverse()) {
      await applyInventoryStockMutation(context, {
        branchId: batch.source_branch_id,
        productId: revert.productId,
        mode: "remove",
        quantity: revert.quantity,
      });
    }

    const { data: latestBatch, error: latestBatchError } = await context.adminClient
      .from("inventory_transfer_batches" as never)
      .select("status")
      .eq("id", batch.id)
      .eq("organization_id", context.organizationId)
      .maybeSingle<{ status: "pending" | "received" | "cancelled" }>();

    if (latestBatchError) {
      throw createError({
        statusCode: 500,
        statusMessage: latestBatchError.message,
      });
    }

    if (latestBatch?.status === "cancelled") {
      return {
        success: true,
        batchId: batch.id,
        processedCount: 0,
        idempotent: true,
        status: "cancelled",
      };
    }

    throw createError({
      statusCode: 409,
      statusMessage: "No se pudo completar el rechazo porque el lote ya no esta pendiente.",
    });
  }

  const { error: updateLinesError } = await context.adminClient
    .from("inventory_transfer_batch_lines" as never)
    .update({ status: "cancelled" } as never)
    .eq("batch_id", batch.id)
    .eq("status", "pending");

  if (updateLinesError) {
    throw createError({
      statusCode: 500,
      statusMessage: updateLinesError.message,
    });
  }

  for (const movement of movementEntries) {
    await insertInventoryMovement(context, {
      organization_id: context.organizationId,
      branch_id: batch.source_branch_id,
      product_id: movement.productId,
      movement_type: "entry",
      quantity: movement.quantity,
      previous_quantity: movement.previousQuantity,
      new_quantity: movement.newQuantity,
      reason: `Transferencia en lote rechazada: ${batch.observations ?? "sin observaciones"}`,
      note: batch.internal_note,
      reference_type: "branch_transfer_batch_cancelled",
      reference_id: batch.id,
      source_branch_id: batch.source_branch_id,
      destination_branch_id: batch.destination_branch_id,
      created_by: context.userId,
    });
  }

  await insertInventoryAudit(context, {
    recordId: batch.id,
    event: "INVENTORY_STOCK_TRANSFER_BATCH_CANCELLED",
    oldData: {
      status: "pending",
    },
    newData: {
      status: "cancelled",
      processedCount: movementEntries.length,
      cancelledBy: context.userId,
    },
    extraContext: {
      sourceBranchId: batch.source_branch_id,
      destinationBranchId: batch.destination_branch_id,
      internal_note: batch.internal_note,
      observations: batch.observations,
    },
  });

  return {
    success: true,
    batchId: batch.id,
    processedCount: movementEntries.length,
    status: "cancelled",
  };
});
