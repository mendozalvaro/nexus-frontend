import {
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
  upsertInventoryStock,
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
  const sourceStock = await getInventoryStockOrThrow(context, body.sourceBranchId, body.productId);

  if (!sourceStock) {
    throw createError({
      statusCode: 404,
      statusMessage: "La sucursal origen no tiene stock registrado para ese producto.",
    });
  }

  const sourcePreviousQuantity = sourceStock.quantity ?? 0;
  const sourceReserved = sourceStock.reserved_quantity ?? 0;
  const sourceAvailableQuantity = sourcePreviousQuantity - sourceReserved;

  if (sourceAvailableQuantity < body.quantity) {
    throw createError({
      statusCode: 409,
      statusMessage: `La sucursal origen solo tiene ${sourceAvailableQuantity} unidad(es) disponibles.`,
    });
  }

  const destinationStock = await getInventoryStockOrThrow(context, body.destinationBranchId, body.productId);
  const destinationPreviousQuantity = destinationStock?.quantity ?? 0;
  const nextSourceQuantity = sourcePreviousQuantity - body.quantity;
  const nextDestinationQuantity = destinationPreviousQuantity + body.quantity;

  const updatedSourceStock = await upsertInventoryStock(context, {
    branchId: body.sourceBranchId,
    productId: body.productId,
    quantity: nextSourceQuantity,
    minStockLevel: sourceStock.min_stock_level ?? 5,
  });

  try {
    const updatedDestinationStock = await upsertInventoryStock(context, {
      branchId: body.destinationBranchId,
      productId: body.productId,
      quantity: nextDestinationQuantity,
      minStockLevel: destinationStock?.min_stock_level ?? sourceStock.min_stock_level ?? 5,
    });

    await insertInventoryMovement(context, {
      organization_id: context.organizationId,
      branch_id: body.sourceBranchId,
      product_id: body.productId,
      movement_type: "transfer_out",
      quantity: body.quantity,
      previous_quantity: sourcePreviousQuantity,
      new_quantity: nextSourceQuantity,
      reason: body.reason.trim(),
      note: body.note.trim() || null,
      reference_type: "branch_transfer",
      reference_id: updatedSourceStock.id,
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
      previous_quantity: destinationPreviousQuantity,
      new_quantity: nextDestinationQuantity,
      reason: body.reason.trim(),
      note: body.note.trim() || null,
      reference_type: "branch_transfer",
      reference_id: updatedDestinationStock.id,
      source_branch_id: body.sourceBranchId,
      destination_branch_id: body.destinationBranchId,
      created_by: context.userId,
    });

    await insertInventoryAudit(context, {
      recordId: updatedSourceStock.id,
      event: "INVENTORY_STOCK_TRANSFER",
      oldData: {
        sourceBranchId: body.sourceBranchId,
        destinationBranchId: body.destinationBranchId,
        sourceQuantity: sourcePreviousQuantity,
        destinationQuantity: destinationPreviousQuantity,
      },
      newData: {
        sourceBranchId: body.sourceBranchId,
        destinationBranchId: body.destinationBranchId,
        sourceQuantity: nextSourceQuantity,
        destinationQuantity: nextDestinationQuantity,
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
    await upsertInventoryStock(context, {
      branchId: body.sourceBranchId,
      productId: body.productId,
      quantity: sourcePreviousQuantity,
      minStockLevel: sourceStock.min_stock_level ?? 5,
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
