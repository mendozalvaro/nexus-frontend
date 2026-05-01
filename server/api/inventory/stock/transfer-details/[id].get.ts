import { getRouterParam } from "h3";

import {
  assertInventoryModuleAccess,
  requireInventoryContext,
} from "../../../../utils/inventory";

type TransferStatus = "pending" | "received" | "cancelled";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContext(event);
  await assertInventoryModuleAccess(context, "can_view");

  const transferId = getRouterParam(event, "id");
  if (!transferId) {
    throw createError({
      statusCode: 400,
      statusMessage: "La transferencia no es válida.",
    });
  }

  const { data: batchTransfer, error: batchTransferError } = await context.adminClient
    .from("inventory_transfer_batches" as never)
    .select("*")
    .eq("id", transferId)
    .eq("organization_id", context.organizationId)
    .maybeSingle<{
      id: string;
      source_branch_id: string;
      destination_branch_id: string;
      status: string;
      requested_by: string | null;
      requested_at: string | null;
      received_by: string | null;
      received_at: string | null;
      internal_note: string | null;
      observations: string | null;
    }>();

  if (batchTransferError) {
    throw createError({
      statusCode: 500,
      statusMessage: batchTransferError.message,
    });
  }

  if (batchTransfer) {
    if (
      context.role === "manager"
      && !context.allowedBranchIds.includes(batchTransfer.source_branch_id)
      && !context.allowedBranchIds.includes(batchTransfer.destination_branch_id)
    ) {
      throw createError({
        statusCode: 403,
        statusMessage: "No tienes permisos para ver esta transferencia.",
      });
    }

    const { data: lines, error: linesError } = await context.adminClient
      .from("inventory_transfer_batch_lines" as never)
      .select("product_id, quantity")
      .eq("batch_id", batchTransfer.id)
      .returns<Array<{ product_id: string; quantity: number }>>();

    if (linesError) {
      throw createError({
        statusCode: 500,
        statusMessage: linesError.message,
      });
    }

    const productIds = Array.from(new Set((lines ?? []).map((line) => line.product_id)));
    const branchIds = [batchTransfer.source_branch_id, batchTransfer.destination_branch_id];
    const userIds = [batchTransfer.requested_by, batchTransfer.received_by].filter((value): value is string => Boolean(value));

    const [productsResult, branchesResult, profilesResult] = await Promise.all([
      productIds.length > 0
        ? context.adminClient.from("products").select("id, name, sku").in("id", productIds)
        : Promise.resolve({ data: [], error: null }),
      context.adminClient.from("branches").select("id, name, code").in("id", branchIds),
      userIds.length > 0
        ? context.adminClient.from("profiles").select("id, full_name").in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const firstError = productsResult.error ?? branchesResult.error ?? profilesResult.error;
    if (firstError) {
      throw createError({
        statusCode: 500,
        statusMessage: firstError.message,
      });
    }

    const productMap = new Map((productsResult.data ?? []).map((row) => [row.id, row]));
    const branchMap = new Map((branchesResult.data ?? []).map((row) => [row.id, row]));
    const profileMap = new Map((profilesResult.data ?? []).map((row) => [row.id, row]));
    const status = (batchTransfer.status as TransferStatus) ?? "pending";

    return {
      success: true,
      details: {
        id: batchTransfer.id,
        isBatch: true,
        status,
        internalNote: batchTransfer.internal_note,
        observations: batchTransfer.observations,
        origin: {
          branchId: batchTransfer.source_branch_id,
          branchName: branchMap.get(batchTransfer.source_branch_id)?.name ?? "Sucursal",
          branchCode: branchMap.get(batchTransfer.source_branch_id)?.code ?? "--",
          userId: batchTransfer.requested_by,
          userName: batchTransfer.requested_by ? profileMap.get(batchTransfer.requested_by)?.full_name ?? null : null,
          date: batchTransfer.requested_at,
        },
        destination: {
          branchId: batchTransfer.destination_branch_id,
          branchName: branchMap.get(batchTransfer.destination_branch_id)?.name ?? "Sucursal",
          branchCode: branchMap.get(batchTransfer.destination_branch_id)?.code ?? "--",
          userId: batchTransfer.received_by,
          userName: batchTransfer.received_by ? profileMap.get(batchTransfer.received_by)?.full_name ?? null : null,
          date: batchTransfer.received_at,
          pendingReception: status === "pending",
        },
        lines: (lines ?? []).map((line) => ({
          productId: line.product_id,
          productName: productMap.get(line.product_id)?.name ?? "Producto",
          sku: productMap.get(line.product_id)?.sku ?? null,
          quantity: line.quantity,
        })),
      },
    };
  }

  const { data: transfer, error: transferError } = await context.adminClient
    .from("inventory_transfers")
    .select("*")
    .eq("id", transferId)
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (transferError) {
    throw createError({
      statusCode: 500,
      statusMessage: transferError.message,
    });
  }

  if (!transfer) {
    throw createError({
      statusCode: 404,
      statusMessage: "No se encontró la transferencia solicitada.",
    });
  }

  if (
    context.role === "manager"
    && !context.allowedBranchIds.includes(transfer.source_branch_id)
    && !context.allowedBranchIds.includes(transfer.destination_branch_id)
  ) {
    throw createError({
      statusCode: 403,
      statusMessage: "No tienes permisos para ver esta transferencia.",
    });
  }

  const [branchResult, productResult, profileResult] = await Promise.all([
    context.adminClient
      .from("branches")
      .select("id, name, code")
      .in("id", [transfer.source_branch_id, transfer.destination_branch_id]),
    context.adminClient
      .from("products")
      .select("id, name, sku")
      .eq("id", transfer.product_id)
      .maybeSingle(),
    context.adminClient
      .from("profiles")
      .select("id, full_name")
      .in("id", [transfer.requested_by, transfer.received_by].filter((value): value is string => Boolean(value))),
  ]);

  const firstError = branchResult.error ?? productResult.error ?? profileResult.error;
  if (firstError) {
    throw createError({
      statusCode: 500,
      statusMessage: firstError.message,
    });
  }

  const branchMap = new Map((branchResult.data ?? []).map((row) => [row.id, row]));
  const profileMap = new Map((profileResult.data ?? []).map((row) => [row.id, row]));
  const status = (transfer.status as TransferStatus) ?? "pending";

  return {
    success: true,
    details: {
      id: transfer.id,
      isBatch: false,
      status,
      internalNote: transfer.internal_note,
      observations: transfer.observations,
      origin: {
        branchId: transfer.source_branch_id,
        branchName: branchMap.get(transfer.source_branch_id)?.name ?? "Sucursal",
        branchCode: branchMap.get(transfer.source_branch_id)?.code ?? "--",
        userId: transfer.requested_by,
        userName: profileMap.get(transfer.requested_by)?.full_name ?? null,
        date: transfer.requested_at,
      },
      destination: {
        branchId: transfer.destination_branch_id,
        branchName: branchMap.get(transfer.destination_branch_id)?.name ?? "Sucursal",
        branchCode: branchMap.get(transfer.destination_branch_id)?.code ?? "--",
        userId: transfer.received_by,
        userName: transfer.received_by ? profileMap.get(transfer.received_by)?.full_name ?? null : null,
        date: transfer.received_at,
        pendingReception: status === "pending",
      },
      lines: [
        {
          productId: transfer.product_id,
          productName: productResult.data?.name ?? "Producto",
          sku: productResult.data?.sku ?? null,
          quantity: transfer.quantity,
        },
      ],
    },
  };
});
