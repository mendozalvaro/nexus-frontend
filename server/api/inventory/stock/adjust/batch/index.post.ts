import {
  assertInventoryBranchAccess,
  assertInventoryModuleAccess,
  generateInventoryDocumentCode,
  getInventoryBatchNormalizationWarnings,
  getInventoryBranchOrThrow,
  insertInventoryAudit,
  normalizeInventoryAdjustmentBatchLines,
  readValidatedInventoryBody,
  requireInventoryContext,
  runInventoryAdjustBatchExecute,
  runInventoryAdjustBatchPrecheck,
  stockAdjustmentBatchSchema,
} from "../../../../../utils/inventory";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContext(event);
  await assertInventoryModuleAccess(context, "can_edit");

  const body = await readValidatedInventoryBody(event, stockAdjustmentBatchSchema);

  assertInventoryBranchAccess(context, body.branchId);
  await getInventoryBranchOrThrow(context, body.branchId);

  const normalization = normalizeInventoryAdjustmentBatchLines(body.mode, body.lines);
  const rows = await runInventoryAdjustBatchPrecheck(context, {
    branchId: body.branchId,
    mode: body.mode,
    lines: normalization.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
    })),
  });

  const failedRows = rows.filter((row) => !row.isValid);
  if (failedRows.length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: failedRows[0]?.errorMessage ?? "No se pudo validar el lote de ajuste.",
      data: {
        errors: failedRows,
      },
    });
  }

  const movementCode = await generateInventoryDocumentCode(
    context,
    body.mode === "add" ? "ING" : body.mode === "remove" ? "SAL" : "AJU",
  );

  const result = await runInventoryAdjustBatchExecute(context, {
    idempotencyKey: body.idempotencyKey,
    branchId: body.branchId,
    mode: body.mode,
    reason: body.reason.trim(),
    note: movementCode,
    lines: normalization.lines,
  });

  await insertInventoryAudit(context, {
    recordId: result.batchId,
    event: "INVENTORY_STOCK_ADJUSTMENT_BATCH",
    oldData: null,
    newData: {
      batchId: result.batchId,
      mode: body.mode,
      processedCount: result.processedCount,
      idempotent: result.idempotent,
      branchId: body.branchId,
    },
    extraContext: {
      reason: body.reason.trim(),
      note: body.note.trim() || null,
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
    movementCode,
    normalization,
    warnings: getInventoryBatchNormalizationWarnings(normalization),
  };
});
