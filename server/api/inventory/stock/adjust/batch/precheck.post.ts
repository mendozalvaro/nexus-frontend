import {
  assertInventoryBranchAccess,
  assertInventoryModuleAccess,
  getInventoryBatchNormalizationWarnings,
  getInventoryBranchOrThrow,
  normalizeInventoryAdjustmentBatchLines,
  readValidatedInventoryBody,
  runInventoryAdjustBatchPrecheck,
  stockAdjustmentBatchSchema,
} from "../../../../../utils/inventory";
import { requireInventoryContextStrict } from "../../../../../utils/inventory-access";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContextStrict(event, "can_edit");
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

  return {
    success: true,
    isValid: rows.every((row) => row.isValid),
    errors: rows.filter((row) => !row.isValid),
    rows,
    requestedReferenceCode: body.referenceCode.trim() || null,
    normalization,
    warnings: getInventoryBatchNormalizationWarnings(normalization),
  };
});

