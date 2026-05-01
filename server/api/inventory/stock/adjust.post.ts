import {
  applyInventoryStockMutation,
  assertInventoryBranchAccess,
  assertInventoryModuleAccess,
  generateInventoryDocumentCode,
  getInventoryBranchOrThrow,
  getInventoryProductOrThrow,
  insertInventoryAudit,
  insertInventoryMovement,
  readValidatedInventoryBody,
  requireInventoryContext,
  stockAdjustmentSchema,
} from "../../../utils/inventory";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContext(event);
  await assertInventoryModuleAccess(context, "can_edit");
  const body = await readValidatedInventoryBody(event, stockAdjustmentSchema);

  assertInventoryBranchAccess(context, body.branchId);
  await getInventoryBranchOrThrow(context, body.branchId);
  const product = await getInventoryProductOrThrow(context, body.productId);

  const stockMutation = await applyInventoryStockMutation(context, {
    branchId: body.branchId,
    productId: body.productId,
    mode: body.mode,
    quantity: body.quantity,
    minStockLevel: body.minStockLevel ?? null,
  });

  const movementType = body.mode === "set" ? "adjustment" : body.mode === "add" ? "entry" : "exit";
  const movementCode = await generateInventoryDocumentCode(
    context,
    body.mode === "add" ? "ING" : body.mode === "remove" ? "SAL" : "AJU",
  );

  await insertInventoryMovement(context, {
    organization_id: context.organizationId,
    branch_id: body.branchId,
    product_id: body.productId,
    movement_type: movementType,
    quantity: body.quantity,
    previous_quantity: stockMutation.previousQuantity,
    new_quantity: stockMutation.newQuantity,
    reason: body.reason.trim(),
    note: movementCode,
    reference_type: "manual_adjustment",
    reference_id: stockMutation.stockId,
    source_branch_id: body.mode === "remove" ? body.branchId : null,
    destination_branch_id: body.mode === "add" ? body.branchId : null,
    created_by: context.userId,
  });

  await insertInventoryAudit(context, {
    recordId: stockMutation.stockId,
    event: "INVENTORY_STOCK_ADJUSTMENT",
    oldData: {
      branchId: body.branchId,
      productId: body.productId,
      previousQuantity: stockMutation.previousQuantity,
    },
    newData: {
      branchId: body.branchId,
      productId: body.productId,
      newQuantity: stockMutation.newQuantity,
      minStockLevel: stockMutation.minStockLevel,
    },
    extraContext: {
      product_name: product.name,
      mode: body.mode,
      quantity: body.quantity,
      reason: body.reason.trim(),
      note: movementCode,
      movement_code: movementCode,
    },
  });

  return {
    success: true,
    stockId: stockMutation.stockId,
    nextQuantity: stockMutation.newQuantity,
    movementCode,
  };
});
