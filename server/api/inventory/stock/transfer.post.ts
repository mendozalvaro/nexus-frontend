import {
  applyInventoryStockMutation,
  assertInventoryBranchAccess,
  assertTransferFeature,
  getInventoryBranchOrThrow,
  getInventoryProductOrThrow,
  getInventoryStockOrThrow,
  insertInventoryAudit,
  insertInventoryMovement,
  readValidatedInventoryBody,
  requireInventoryContext,
  stockTransferSchema,
} from "../../../utils/inventory";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContext(event);
  const body = await readValidatedInventoryBody(event, stockTransferSchema);

  assertTransferFeature(context);
  assertInventoryBranchAccess(context, body.sourceBranchId);
  assertInventoryBranchAccess(context, body.destinationBranchId);

  if (body.sourceBranchId === body.destinationBranchId) {
    throw createError({
      statusCode: 409,
      statusMessage: "La sucursal origen y destino no pueden ser la misma.",
    });
  }

  const sourceBranch = await getInventoryBranchOrThrow(context, body.sourceBranchId);
  const destinationBranch = await getInventoryBranchOrThrow(context, body.destinationBranchId);
  const product = await getInventoryProductOrThrow(context, body.productId);
  const destinationStock = await getInventoryStockOrThrow(context, body.destinationBranchId, body.productId);

  const sourceMutation = await applyInventoryStockMutation(context, {
    branchId: body.sourceBranchId,
    productId: body.productId,
    mode: "remove",
    quantity: body.quantity,
    requireAvailable: true,
  });

  try {
    const destinationMutation = await applyInventoryStockMutation(context, {
      branchId: body.destinationBranchId,
      productId: body.productId,
      mode: "add",
      quantity: body.quantity,
      minStockLevel: destinationStock?.min_stock_level ?? null,
    });

    await insertInventoryMovement(context, {
      organization_id: context.organizationId,
      branch_id: body.sourceBranchId,
      product_id: body.productId,
      movement_type: "transfer_out",
      quantity: body.quantity,
      previous_quantity: sourceMutation.previousQuantity,
      new_quantity: sourceMutation.newQuantity,
      reason: body.reason.trim(),
      note: body.note.trim() || null,
      reference_type: "branch_transfer",
      reference_id: sourceMutation.stockId,
      source_branch_id: body.sourceBranchId,
      destination_branch_id: body.destinationBranchId,
      created_by: context.userId,
    });

    await insertInventoryMovement(context, {
      organization_id: context.organizationId,
      branch_id: body.destinationBranchId,
      product_id: body.productId,
      movement_type: "transfer_in",
      quantity: body.quantity,
      previous_quantity: destinationMutation.previousQuantity,
      new_quantity: destinationMutation.newQuantity,
      reason: body.reason.trim(),
      note: body.note.trim() || null,
      reference_type: "branch_transfer",
      reference_id: destinationMutation.stockId,
      source_branch_id: body.sourceBranchId,
      destination_branch_id: body.destinationBranchId,
      created_by: context.userId,
    });

    await insertInventoryAudit(context, {
      recordId: sourceMutation.stockId,
      event: "INVENTORY_STOCK_TRANSFER",
      oldData: {
        sourceBranchId: body.sourceBranchId,
        destinationBranchId: body.destinationBranchId,
        sourceQuantity: sourceMutation.previousQuantity,
        destinationQuantity: destinationMutation.previousQuantity,
      },
      newData: {
        sourceBranchId: body.sourceBranchId,
        destinationBranchId: body.destinationBranchId,
        sourceQuantity: sourceMutation.newQuantity,
        destinationQuantity: destinationMutation.newQuantity,
      },
      extraContext: {
        source_branch_name: sourceBranch.name,
        destination_branch_name: destinationBranch.name,
        product_name: product.name,
        quantity: body.quantity,
        reason: body.reason.trim(),
        note: body.note.trim() || null,
      },
    });
  } catch (error) {
    await applyInventoryStockMutation(context, {
      branchId: body.sourceBranchId,
      productId: body.productId,
      mode: "add",
      quantity: body.quantity,
    });

    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : "No se pudo completar la transferencia de stock.",
    });
  }

  return {
    success: true,
    sourceBranchId: body.sourceBranchId,
    destinationBranchId: body.destinationBranchId,
    transferredQuantity: body.quantity,
  };
});
