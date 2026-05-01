import {
  applyInventoryStockMutation,
  assertInventoryBranchAccess,
  assertInventoryModuleAccess,
  assertTransferFeature,
  generateInventoryDocumentCode,
  getInventoryBranchOrThrow,
  getInventoryProductOrThrow,
  insertInventoryAudit,
  insertInventoryMovement,
  insertInventoryTransfer,
  readValidatedInventoryBody,
  requireInventoryContext,
  stockTransferSchema,
} from "../../../utils/inventory";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContext(event);
  await assertInventoryModuleAccess(context, "can_edit");
  const body = await readValidatedInventoryBody(event, stockTransferSchema);

  assertTransferFeature(context);
  assertInventoryBranchAccess(context, body.sourceBranchId);

  if (body.sourceBranchId === body.destinationBranchId) {
    throw createError({
      statusCode: 409,
      statusMessage: "La sucursal origen y destino no pueden ser la misma.",
    });
  }

  const sourceBranch = await getInventoryBranchOrThrow(context, body.sourceBranchId);
  const destinationBranch = await getInventoryBranchOrThrow(context, body.destinationBranchId);
  const product = await getInventoryProductOrThrow(context, body.productId);
  const movementCode = await generateInventoryDocumentCode(context, "TRA");

  let sourceMutationApplied = false;
  let sourceMutationPrevious = 0;
  let sourceMutationCurrent = 0;

  try {
    const sourceMutation = await applyInventoryStockMutation(context, {
      branchId: body.sourceBranchId,
      productId: body.productId,
      mode: "remove",
      quantity: body.quantity,
      requireAvailable: true,
    });
    sourceMutationApplied = true;
    sourceMutationPrevious = sourceMutation.previousQuantity;
    sourceMutationCurrent = sourceMutation.newQuantity;

    const transfer = await insertInventoryTransfer(context, {
      organization_id: context.organizationId,
      product_id: body.productId,
      source_branch_id: body.sourceBranchId,
      destination_branch_id: body.destinationBranchId,
      quantity: body.quantity,
      status: "pending",
      observations: body.observations.trim(),
      internal_note: movementCode,
      requested_by: context.userId,
    });

    await insertInventoryMovement(context, {
      organization_id: context.organizationId,
      branch_id: body.sourceBranchId,
      product_id: body.productId,
      movement_type: "transfer_out",
      quantity: body.quantity,
      previous_quantity: sourceMutation.previousQuantity,
      new_quantity: sourceMutation.newQuantity,
      reason: body.observations.trim(),
      note: movementCode,
      reference_type: "branch_transfer",
      reference_id: transfer.id,
      source_branch_id: body.sourceBranchId,
      destination_branch_id: body.destinationBranchId,
      created_by: context.userId,
    });

    await insertInventoryAudit(context, {
      recordId: transfer.id,
      event: "INVENTORY_STOCK_TRANSFER_CREATED",
      oldData: {
        sourceBranchId: body.sourceBranchId,
        destinationBranchId: body.destinationBranchId,
        sourceQuantity: sourceMutation.previousQuantity,
      },
      newData: {
        transferId: transfer.id,
        transferStatus: transfer.status,
        sourceBranchId: body.sourceBranchId,
        destinationBranchId: body.destinationBranchId,
        sourceQuantity: sourceMutation.newQuantity,
      },
      extraContext: {
        source_branch_name: sourceBranch.name,
        destination_branch_name: destinationBranch.name,
        product_name: product.name,
        quantity: body.quantity,
        observations: body.observations.trim(),
        internal_note: movementCode,
        movement_code: movementCode,
      },
    });

    return {
      success: true,
      transferId: transfer.id,
      sourceBranchId: body.sourceBranchId,
      destinationBranchId: body.destinationBranchId,
      transferredQuantity: body.quantity,
      status: transfer.status,
      movementCode,
    };
  } catch (error) {
    if (sourceMutationApplied) {
      try {
        await applyInventoryStockMutation(context, {
          branchId: body.sourceBranchId,
          productId: body.productId,
          mode: "add",
          quantity: body.quantity,
        });
      } catch {
        throw createError({
          statusCode: 500,
          statusMessage: "Fallo la transferencia y no se pudo completar el rollback automatico. Requiere revision manual.",
        });
      }
    }

    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error
        ? error.message
        : `No se pudo crear la transferencia pendiente (${sourceMutationPrevious} -> ${sourceMutationCurrent})`,
    });
  }
});
