import {
  assertInventoryBranchAccess,
  getInventoryBranchOrThrow,
  getInventoryProductOrThrow,
  getInventoryStockOrThrow,
  insertInventoryAudit,
  insertInventoryMovement,
  readValidatedInventoryBody,
  requireInventoryContext,
  stockAdjustmentSchema,
  upsertInventoryStock,
} from "../../../utils/inventory";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContext(event);
  const body = await readValidatedInventoryBody(event, stockAdjustmentSchema);

  assertInventoryBranchAccess(context, body.branchId);
  await getInventoryBranchOrThrow(context, body.branchId);
  const product = await getInventoryProductOrThrow(context, body.productId);

  const currentStock = await getInventoryStockOrThrow(context, body.branchId, body.productId);
  const previousQuantity = currentStock?.quantity ?? 0;

  const nextQuantity = (() => {
    if (body.mode === "set") {
      return body.quantity;
    }

    if (body.mode === "add") {
      return previousQuantity + body.quantity;
    }

    return previousQuantity - body.quantity;
  })();

  if (nextQuantity < 0) {
    throw createError({
      statusCode: 409,
      statusMessage: "El ajuste deja el stock en negativo, lo cual no está permitido.",
    });
  }

  const updatedStock = await upsertInventoryStock(context, {
    branchId: body.branchId,
    productId: body.productId,
    quantity: nextQuantity,
    minStockLevel: body.minStockLevel ?? currentStock?.min_stock_level ?? 5,
  });

  const movementType = body.mode === "set" ? "adjustment" : body.mode === "add" ? "entry" : "exit";

  await insertInventoryMovement(context, {
    organization_id: context.organizationId,
    branch_id: body.branchId,
    product_id: body.productId,
    movement_type: movementType,
    quantity: body.quantity,
    previous_quantity: previousQuantity,
    new_quantity: nextQuantity,
    reason: body.reason.trim(),
    note: body.note.trim() || null,
    reference_type: "manual_adjustment",
    reference_id: updatedStock.id,
    source_branch_id: body.mode === "remove" ? body.branchId : null,
    destination_branch_id: body.mode === "add" ? body.branchId : null,
    created_by: context.userId,
  });

  await insertInventoryAudit(context, {
    recordId: updatedStock.id,
    event: "INVENTORY_STOCK_ADJUSTMENT",
    oldData: {
      branchId: body.branchId,
      productId: body.productId,
      previousQuantity,
    },
    newData: {
      branchId: body.branchId,
      productId: body.productId,
      newQuantity: nextQuantity,
      minStockLevel: updatedStock.min_stock_level,
    },
    extraContext: {
      product_name: product.name,
      mode: body.mode,
      quantity: body.quantity,
      reason: body.reason.trim(),
      note: body.note.trim() || null,
    },
  });

  return {
    success: true,
    stockId: updatedStock.id,
    nextQuantity,
  };
});
