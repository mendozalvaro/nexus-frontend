import { createError } from "h3";

import type { InventoryContext } from "../../utils/inventory";

import {
  applyInventoryStockMutation,
  getInventoryBranchOrThrow,
  getInventoryProductOrThrow,
  insertInventoryAudit,
  insertInventoryMovement,
} from "../../utils/inventory";

type TransferBatchRow = {
  id: string;
  source_branch_id: string;
  destination_branch_id: string;
  status: "pending" | "received" | "cancelled";
  reference_code: string | null;
  observations: string | null;
};

type TransferBatchLineRow = {
  product_id: string;
  quantity: number;
};

export const cancelInventoryTransfer = async (
  context: InventoryContext,
  transferId: string,
) => {
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
      status: "cancelled" as const,
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
        status: "cancelled" as const,
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
    note: transfer.reference_code,
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
      reference_code: transfer.reference_code,
    },
  });

  return {
    success: true,
    transferId: transfer.id,
    status: "cancelled" as const,
  };
};

export const cancelInventoryTransferBatch = async (
  context: InventoryContext,
  batchId: string,
) => {
  const { data: batch, error: batchError } = await context.adminClient
    .from("inventory_transfer_batches" as never)
    .select("id, source_branch_id, destination_branch_id, status, reference_code, observations")
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
      status: "cancelled" as const,
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
        status: "cancelled" as const,
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
      note: batch.reference_code,
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
      reference_code: batch.reference_code,
      observations: batch.observations,
    },
  });

  return {
    success: true,
    batchId: batch.id,
    processedCount: movementEntries.length,
    status: "cancelled" as const,
  };
};

export const receiveInventoryTransfer = async (
  context: InventoryContext,
  transferId: string,
) => {
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
      status: "received" as const,
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
        status: "received" as const,
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
    note: transfer.reference_code,
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
      reference_code: transfer.reference_code,
    },
  });

  return {
    success: true,
    transferId: transfer.id,
    status: "received" as const,
  };
};

export const receiveInventoryTransferBatch = async (
  context: InventoryContext,
  batchId: string,
) => {
  if (context.role === "manager") {
    const { data: batch, error } = await context.adminClient
      .from("inventory_transfer_batches" as never)
      .select("destination_branch_id")
      .eq("id", batchId)
      .eq("organization_id", context.organizationId)
      .maybeSingle<{ destination_branch_id: string }>();

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message });
    }

    if (!batch) {
      throw createError({
        statusCode: 404,
        statusMessage: "No se encontró el lote de transferencia solicitado.",
      });
    }

    if (!context.allowedBranchIds.includes(batch.destination_branch_id)) {
      throw createError({
        statusCode: 403,
        statusMessage: "No tienes permisos para recepcionar este lote de transferencia.",
      });
    }
  }

  const result = await runInventoryTransferBatchReceive(context, batchId);

  await insertInventoryAudit(context, {
    recordId: result.batchId,
    event: "INVENTORY_STOCK_TRANSFER_BATCH_RECEIVED",
    oldData: {
      status: result.idempotent ? "received" : "pending",
    },
    newData: {
      status: "received",
      processedCount: result.processedCount,
      idempotent: result.idempotent,
    },
  });

  return {
    success: true,
    batchId: result.batchId,
    processedCount: result.processedCount,
    idempotent: result.idempotent,
    status: "received" as const,
  };
};
