import { randomUUID } from "node:crypto";

import {
  assertStockTransferAllowed,
  getAdminBranchOrThrow,
  readValidatedBranchBody,
  requireBranchAdminContext,
  transferStockSchema,
} from "../../../utils/admin-branches";
import {
  generateInventoryDocumentCode,
  runInventoryTransferBatchCreate,
  runInventoryTransferBatchReceive,
} from "../../../utils/inventory";

import type { Database } from "@/types/database.types";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];

export default defineEventHandler(async (event) => {
  // Legacy compatibility endpoint: delegates to inventory batch engine (create + immediate receive).
  const context = await requireBranchAdminContext(event);
  const body = await readValidatedBranchBody(event, transferStockSchema);

  assertStockTransferAllowed(context);

  const sourceBranch = await getAdminBranchOrThrow(context.adminClient, context.organizationId, body.sourceBranchId);
  const destinationBranch = await getAdminBranchOrThrow(context.adminClient, context.organizationId, body.destinationBranchId);

  if ((sourceBranch.is_active ?? true) === false || (destinationBranch.is_active ?? true) === false) {
    throw createError({
      statusCode: 409,
      statusMessage: "Solo puedes transferir stock entre sucursales activas.",
    });
  }

  const { data: product, error: productError } = await context.adminClient
    .from("products")
    .select("id, organization_id, name, sku, is_active")
    .eq("organization_id", context.organizationId)
    .eq("id", body.productId)
    .maybeSingle<Pick<ProductRow, "id" | "organization_id" | "name" | "sku" | "is_active">>();

  if (productError) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar el producto a transferir.",
    });
  }

  if (!product || product.is_active === false) {
    throw createError({
      statusCode: 404,
      statusMessage: "El producto seleccionado no está disponible para transferencias.",
    });
  }

  const idempotencyKey = `branch-transfer:${context.organizationId}:${context.userId}:${randomUUID()}`;
  const observations = body.note.trim().length >= 3
    ? body.note.trim()
    : "Transferencia operativa desde sucursales";

  const movementCode = await generateInventoryDocumentCode(
    {
      adminClient: context.adminClient,
      organizationId: context.organizationId,
    },
    "TRA",
  );

  const createResult = await runInventoryTransferBatchCreate(
    {
      adminClient: context.adminClient,
      organizationId: context.organizationId,
      userId: context.userId,
    },
    {
      idempotencyKey,
      sourceBranchId: body.sourceBranchId,
      destinationBranchId: body.destinationBranchId,
      observations,
      internalNote: movementCode,
      lines: [{ productId: body.productId, quantity: body.quantity }],
    },
  );

  await runInventoryTransferBatchReceive(
    {
      adminClient: context.adminClient,
      organizationId: context.organizationId,
      userId: context.userId,
    },
    createResult.batchId,
  );

  await context.adminClient.from("audit_logs").insert({
    user_id: context.userId,
    action: "UPDATE",
    table_name: "inventory_stock",
    record_id: createResult.batchId,
    old_data: {
      sourceBranchId: body.sourceBranchId,
      destinationBranchId: body.destinationBranchId,
      productId: body.productId,
    },
    new_data: {
      sourceBranchId: body.sourceBranchId,
      destinationBranchId: body.destinationBranchId,
      productId: body.productId,
      processedCount: createResult.processedCount,
    },
    context: {
      event: "BRANCH_STOCK_TRANSFER_VIA_BATCH",
      organization_id: context.organizationId,
      source_branch_id: body.sourceBranchId,
      destination_branch_id: body.destinationBranchId,
      product_id: body.productId,
      product_name: product.name,
      quantity: body.quantity,
      note: body.note.trim() || null,
      movement_code: movementCode,
      transfer_batch_id: createResult.batchId,
    },
  });

  return {
    success: true,
    sourceBranchId: body.sourceBranchId,
    destinationBranchId: body.destinationBranchId,
    productId: body.productId,
    transferredQuantity: body.quantity,
    movementCode,
  };
});
