import { getRouterParam } from "h3";

import {
  assertInventoryModuleAccess,
  insertInventoryAudit,
  requireInventoryContext,
  runInventoryTransferBatchReceive,
} from "../../../../../utils/inventory";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContext(event);
  await assertInventoryModuleAccess(context, "can_edit");

  const batchId = getRouterParam(event, "id");
  if (!batchId) {
    throw createError({
      statusCode: 400,
      statusMessage: "El lote de transferencia no es válido.",
    });
  }

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
    status: "received",
  };
});
