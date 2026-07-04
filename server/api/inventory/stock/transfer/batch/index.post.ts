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
  runInventoryTransferBatchCreate,
  runInventoryTransferBatchPrecheck,
  stockTransferBatchSchema,
} from "../../../../../utils/inventory";
import { requireInventoryContextStrict } from "../../../../../utils/inventory-access";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContextStrict(event, "can_edit");
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
    referenceCode: body.referenceCode.trim() || movementCode,
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
      requestedReferenceCode: body.referenceCode.trim() || null,
    },
    extraContext: {
      observations: body.observations.trim(),
      movement_code: movementCode,
      requested_reference_code: body.referenceCode.trim() || null,
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
    requestedReferenceCode: body.referenceCode.trim() || null,
    normalization,
    warnings: getInventoryBatchNormalizationWarnings(normalization),
  };
});

