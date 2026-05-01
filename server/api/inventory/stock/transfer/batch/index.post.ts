import {
  assertInventoryBranchAccess,
  assertInventoryModuleAccess,
  assertTransferFeature,
  generateInventoryDocumentCode,
  getInventoryBatchNormalizationWarnings,
  getInventoryBranchOrThrow,
  insertInventoryAudit,
  normalizeInventoryTransferBatchLines,
  readValidatedInventoryBody,
  requireInventoryContext,
  runInventoryTransferBatchCreate,
  runInventoryTransferBatchPrecheck,
  stockTransferBatchSchema,
} from "../../../../../utils/inventory";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContext(event);
  await assertInventoryModuleAccess(context, "can_edit");

  const body = await readValidatedInventoryBody(event, stockTransferBatchSchema);

  assertTransferFeature(context);
  assertInventoryBranchAccess(context, body.sourceBranchId);

  if (body.sourceBranchId === body.destinationBranchId) {
    throw createError({
      statusCode: 409,
      statusMessage: "La sucursal origen y destino no pueden ser la misma.",
    });
  }

  await getInventoryBranchOrThrow(context, body.sourceBranchId);
  await getInventoryBranchOrThrow(context, body.destinationBranchId);

  const normalization = normalizeInventoryTransferBatchLines(body.lines);
  const rows = await runInventoryTransferBatchPrecheck(context, {
    sourceBranchId: body.sourceBranchId,
    destinationBranchId: body.destinationBranchId,
    lines: normalization.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
    })),
  });

  const failedRows = rows.filter((row) => !row.isValid);
  if (failedRows.length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: failedRows[0]?.errorMessage ?? "No se pudo validar el lote de transferencia.",
      data: {
        errors: failedRows,
      },
    });
  }

  const movementCode = await generateInventoryDocumentCode(context, "TRA");

  const result = await runInventoryTransferBatchCreate(context, {
    idempotencyKey: body.idempotencyKey,
    sourceBranchId: body.sourceBranchId,
    destinationBranchId: body.destinationBranchId,
    observations: body.observations.trim(),
    internalNote: movementCode,
    lines: normalization.lines,
  });

  await insertInventoryAudit(context, {
    recordId: result.batchId,
    event: "INVENTORY_STOCK_TRANSFER_BATCH_CREATED",
    oldData: null,
    newData: {
      batchId: result.batchId,
      processedCount: result.processedCount,
      idempotent: result.idempotent,
      sourceBranchId: body.sourceBranchId,
      destinationBranchId: body.destinationBranchId,
    },
    extraContext: {
      observations: body.observations.trim(),
      movement_code: movementCode,
      total_lines: normalization.normalizedLines,
      input_lines: normalization.originalLines,
      idempotency_key: body.idempotencyKey,
    },
  });

  return {
    success: true,
    batchId: result.batchId,
    processedCount: result.processedCount,
    idempotent: result.idempotent,
    status: "pending",
    movementCode,
    normalization,
    warnings: getInventoryBatchNormalizationWarnings(normalization),
  };
});
