import { getQuery } from "h3";

import {
  assertInventoryModuleAccess,
  requireInventoryContext,
} from "../../../utils/inventory";

type TransferStatus = "pending" | "received" | "cancelled";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContext(event);
  await assertInventoryModuleAccess(context, "can_view");

  const query = getQuery(event);
  const branchId = typeof query.branchId === "string" && query.branchId.length > 0 ? query.branchId : null;
  const productId = typeof query.productId === "string" && query.productId.length > 0 ? query.productId : null;
  const status = (typeof query.status === "string" ? query.status : "all") as TransferStatus | "all";

  const { data: transfers, error: transferError } = await context.adminClient
    .from("inventory_transfers")
    .select("*")
    .eq("organization_id", context.organizationId)
    .order("requested_at", { ascending: false })
    .limit(300);

  if (transferError) {
    throw createError({
      statusCode: 500,
      statusMessage: transferError.message,
    });
  }

  const { data: batchTransfers, error: batchTransferError } = await context.adminClient
    .from("inventory_transfer_batches" as never)
    .select("*")
    .eq("organization_id", context.organizationId)
    .order("requested_at", { ascending: false })
    .limit(300);

  if (batchTransferError) {
    throw createError({
      statusCode: 500,
      statusMessage: batchTransferError.message,
    });
  }

  const scoped = (transfers ?? []).filter((row) => {
    if (context.role === "admin") {
      return true;
    }

    return context.allowedBranchIds.includes(row.source_branch_id)
      || context.allowedBranchIds.includes(row.destination_branch_id);
  }).filter((row) => {
    if (status !== "all" && row.status !== status) {
      return false;
    }

    if (branchId && row.source_branch_id !== branchId && row.destination_branch_id !== branchId) {
      return false;
    }

    if (productId && row.product_id !== productId) {
      return false;
    }

    return true;
  });

  const scopedBatches = ((batchTransfers as Array<{
    id: string;
    organization_id: string;
    source_branch_id: string;
    destination_branch_id: string;
    status: TransferStatus;
    observations: string | null;
    internal_note: string | null;
    total_lines: number;
    total_quantity: number;
    requested_by: string | null;
    requested_at: string | null;
    received_by: string | null;
    received_at: string | null;
  }> | null) ?? []).filter((row) => {
    if (context.role === "admin") {
      return true;
    }

    return context.allowedBranchIds.includes(row.source_branch_id)
      || context.allowedBranchIds.includes(row.destination_branch_id);
  }).filter((row) => {
    if (status !== "all" && row.status !== status) {
      return false;
    }

    if (branchId && row.source_branch_id !== branchId && row.destination_branch_id !== branchId) {
      return false;
    }

    return true;
  });

  const scopedBatchIds = scopedBatches.map((row) => row.id);
  const { data: batchLines, error: batchLinesError } = scopedBatchIds.length > 0
    ? await context.adminClient
      .from("inventory_transfer_batch_lines" as never)
      .select("batch_id, product_id")
      .in("batch_id", scopedBatchIds)
      .returns<Array<{ batch_id: string; product_id: string }>>()
    : { data: [], error: null };

  if (batchLinesError) {
    throw createError({
      statusCode: 500,
      statusMessage: batchLinesError.message,
    });
  }

  const batchProductsMap = new Map<string, Set<string>>();
  for (const row of batchLines ?? []) {
    const current = batchProductsMap.get(row.batch_id);
    if (current) {
      current.add(row.product_id);
      continue;
    }

    batchProductsMap.set(row.batch_id, new Set([row.product_id]));
  }

  const filteredBatchRows = scopedBatches.filter((row) => {
    if (!productId) {
      return true;
    }

    return batchProductsMap.get(row.id)?.has(productId) ?? false;
  });

  const branchIds = Array.from(new Set([
    ...scoped.flatMap((row) => [row.source_branch_id, row.destination_branch_id]),
    ...filteredBatchRows.flatMap((row) => [row.source_branch_id, row.destination_branch_id]),
  ]));
  const productIds = Array.from(new Set(scoped.map((row) => row.product_id)));
  const profileIds = Array.from(
    new Set([
      ...scoped.flatMap((row) => [row.requested_by, row.received_by, row.cancelled_by]),
      ...filteredBatchRows.flatMap((row) => [row.requested_by, row.received_by]),
    ].filter((value): value is string => Boolean(value))),
  );

  const [branchesResult, productsResult, profilesResult] = await Promise.all([
    branchIds.length > 0
      ? context.adminClient.from("branches")
          .select("id, name, code")
          .in("id", branchIds)
      : Promise.resolve({ data: [], error: null }),
    productIds.length > 0
      ? context.adminClient.from("products")
          .select("id, name, sku")
          .in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
    profileIds.length > 0
      ? context.adminClient.from("profiles")
          .select("id, full_name")
          .in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const firstError = branchesResult.error ?? productsResult.error ?? profilesResult.error;
  if (firstError) {
    throw createError({
      statusCode: 500,
      statusMessage: firstError.message,
    });
  }

  const branchMap = new Map((branchesResult.data ?? []).map((row) => [row.id, row]));
  const productMap = new Map((productsResult.data ?? []).map((row) => [row.id, row]));
  const profileMap = new Map((profilesResult.data ?? []).map((row) => [row.id, row]));

  const rows = scoped.map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    productId: row.product_id,
    productName: productMap.get(row.product_id)?.name ?? "Producto",
    sku: productMap.get(row.product_id)?.sku ?? null,
    sourceBranchId: row.source_branch_id,
    sourceBranchName: branchMap.get(row.source_branch_id)?.name ?? "Sucursal",
    sourceBranchCode: branchMap.get(row.source_branch_id)?.code ?? "--",
    destinationBranchId: row.destination_branch_id,
    destinationBranchName: branchMap.get(row.destination_branch_id)?.name ?? "Sucursal",
    destinationBranchCode: branchMap.get(row.destination_branch_id)?.code ?? "--",
    quantity: row.quantity,
    status: row.status,
    observations: row.observations,
    internalNote: row.internal_note,
    requestedAt: row.requested_at,
    requestedBy: row.requested_by,
    requestedByName: profileMap.get(row.requested_by)?.full_name ?? null,
    receivedAt: row.received_at,
    receivedBy: row.received_by,
    receivedByName: row.received_by ? profileMap.get(row.received_by)?.full_name ?? null : null,
  }));

  const batchRows = filteredBatchRows.map((row) => ({
    id: row.id,
    isBatch: true,
    totalLines: row.total_lines,
    isBatchReceived: row.status === "received",
    organizationId: row.organization_id,
    productId: row.id,
    productName: `Lote (${row.total_lines} producto${row.total_lines === 1 ? "" : "s"})`,
    sku: null,
    sourceBranchId: row.source_branch_id,
    sourceBranchName: branchMap.get(row.source_branch_id)?.name ?? "Sucursal",
    sourceBranchCode: branchMap.get(row.source_branch_id)?.code ?? "--",
    destinationBranchId: row.destination_branch_id,
    destinationBranchName: branchMap.get(row.destination_branch_id)?.name ?? "Sucursal",
    destinationBranchCode: branchMap.get(row.destination_branch_id)?.code ?? "--",
    quantity: row.total_quantity,
    status: row.status,
    observations: row.observations,
    internalNote: row.internal_note,
    requestedAt: row.requested_at,
    requestedBy: row.requested_by,
    requestedByName: row.requested_by ? profileMap.get(row.requested_by)?.full_name ?? null : null,
    receivedAt: row.received_at,
    receivedBy: row.received_by,
    receivedByName: row.received_by ? profileMap.get(row.received_by)?.full_name ?? null : null,
  }));

  const combinedRows = [...batchRows, ...rows].sort((left, right) => {
    const leftTime = left.requestedAt ? new Date(left.requestedAt).getTime() : 0;
    const rightTime = right.requestedAt ? new Date(right.requestedAt).getTime() : 0;
    return rightTime - leftTime;
  });

  const { data: destinationBranches, error: destinationBranchesError } = await context.adminClient
    .from("branches")
    .select("id, name, code, address, is_active")
    .eq("organization_id", context.organizationId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (destinationBranchesError) {
    throw createError({
      statusCode: 500,
      statusMessage: destinationBranchesError.message,
    });
  }

  return {
    success: true,
    rows: combinedRows,
    destinationBranches: destinationBranches ?? [],
    pendingInboundCount: combinedRows.filter((row) =>
      row.status === "pending"
      && context.allowedBranchIds.includes(row.destinationBranchId)).length,
  };
});
