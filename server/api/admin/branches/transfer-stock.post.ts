import {
  assertStockTransferAllowed,
  getAdminBranchOrThrow,
  readValidatedBranchBody,
  requireBranchAdminContext,
  transferStockSchema,
} from "../../../utils/admin-branches";

import type { Database } from "@/types/database.types";

type InventoryStockRow = Database["public"]["Tables"]["inventory_stock"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];

export default defineEventHandler(async (event) => {
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

  const { data: sourceStock, error: sourceStockError } = await context.adminClient
    .from("inventory_stock")
    .select("id, branch_id, product_id, quantity, reserved_quantity, min_stock_level, updated_at")
    .eq("branch_id", body.sourceBranchId)
    .eq("product_id", body.productId)
    .maybeSingle<InventoryStockRow>();

  if (sourceStockError) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar el inventario origen.",
    });
  }

  if (!sourceStock) {
    throw createError({
      statusCode: 404,
      statusMessage: "La sucursal origen no tiene inventario registrado para ese producto.",
    });
  }

  const sourceQuantity = sourceStock.quantity ?? 0;
  const sourceReserved = sourceStock.reserved_quantity ?? 0;
  const availableQuantity = sourceQuantity - sourceReserved;

  if (availableQuantity < body.quantity) {
    throw createError({
      statusCode: 409,
      statusMessage: `La sucursal origen solo tiene ${availableQuantity} unidad(es) disponibles para transferir.`,
    });
  }

  const { data: destinationStock, error: destinationStockError } = await context.adminClient
    .from("inventory_stock")
    .select("id, branch_id, product_id, quantity, reserved_quantity, min_stock_level, updated_at")
    .eq("branch_id", body.destinationBranchId)
    .eq("product_id", body.productId)
    .maybeSingle<InventoryStockRow>();

  if (destinationStockError) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar el inventario destino.",
    });
  }

  const destinationQuantity = destinationStock?.quantity ?? 0;
  const nextSourceQuantity = sourceQuantity - body.quantity;
  const nextDestinationQuantity = destinationQuantity + body.quantity;

  const { error: sourceUpdateError } = await context.adminClient
    .from("inventory_stock")
    .update({ quantity: nextSourceQuantity })
    .eq("id", sourceStock.id);

  if (sourceUpdateError) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo actualizar el inventario de la sucursal origen.",
    });
  }

  try {
    if (destinationStock) {
      const { error } = await context.adminClient
        .from("inventory_stock")
        .update({ quantity: nextDestinationQuantity })
        .eq("id", destinationStock.id);

      if (error) {
        throw error;
      }
    } else {
      const { error } = await context.adminClient
        .from("inventory_stock")
        .insert({
          branch_id: body.destinationBranchId,
          product_id: body.productId,
          quantity: body.quantity,
          reserved_quantity: 0,
          min_stock_level: sourceStock.min_stock_level ?? 5,
        });

      if (error) {
        throw error;
      }
    }
  } catch (destinationMutationError) {
    await context.adminClient
      .from("inventory_stock")
      .update({ quantity: sourceQuantity })
      .eq("id", sourceStock.id);

    throw createError({
      statusCode: 500,
      statusMessage: destinationMutationError instanceof Error
        ? destinationMutationError.message
        : "No se pudo completar la transferencia de stock.",
    });
  }

  await context.adminClient.from("audit_logs").insert({
    user_id: context.userId,
    action: "UPDATE",
    table_name: "inventory_stock",
    record_id: sourceStock.id,
    old_data: {
      sourceBranchId: body.sourceBranchId,
      destinationBranchId: body.destinationBranchId,
      productId: body.productId,
      sourceQuantity,
      destinationQuantity,
    },
    new_data: {
      sourceBranchId: body.sourceBranchId,
      destinationBranchId: body.destinationBranchId,
      productId: body.productId,
      sourceQuantity: nextSourceQuantity,
      destinationQuantity: nextDestinationQuantity,
    },
    context: {
      event: "BRANCH_STOCK_TRANSFER",
      organization_id: context.organizationId,
      source_branch_id: body.sourceBranchId,
      destination_branch_id: body.destinationBranchId,
      product_id: body.productId,
      product_name: product.name,
      quantity: body.quantity,
      note: body.note.trim() || null,
    },
  });

  return {
    success: true,
    sourceBranchId: body.sourceBranchId,
    destinationBranchId: body.destinationBranchId,
    productId: body.productId,
    transferredQuantity: body.quantity,
  };
});
