import {
  assertInventoryBranchAccess,
  assertInventoryModuleAccess,
  assertTransferFeature,
  getInventoryBatchNormalizationWarnings,
  getInventoryBranchOrThrow,
  normalizeInventoryTransferBatchLines,
  readValidatedInventoryBody,
  requireInventoryContext,
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

  return {
    success: true,
    isValid: rows.every((row) => row.isValid),
    errors: rows.filter((row) => !row.isValid),
    rows,
    normalization,
    warnings: getInventoryBatchNormalizationWarnings(normalization),
  };
});
