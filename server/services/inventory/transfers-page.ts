import { createError } from "h3";

import type { InventoryContext } from "../../utils/inventory";
import { getInventoryProductsPage, type InventoryProductsData } from "./products-page";

type TransferStatus = "pending" | "received" | "cancelled";

interface InventoryTransferRowView {
  id: string;
  isBatch?: boolean;
  totalLines?: number;
  isBatchReceived?: boolean;
  organizationId: string;
  productId: string;
  productName: string;
  sku: string | null;
  sourceBranchId: string;
  sourceBranchName: string;
  sourceBranchCode: string;
  destinationBranchId: string;
  destinationBranchName: string;
  destinationBranchCode: string;
  quantity: number;
  status: TransferStatus;
  observations: string | null;
  referenceCode: string | null;
  requestedAt: string | null;
  requestedBy: string | null;
  requestedByName: string | null;
  receivedAt: string | null;
  receivedBy: string | null;
  receivedByName: string | null;
}

interface InventoryBranchOption {
  id: string;
  name: string;
  code: string;
  address: string | null;
  isActive: boolean;
}

export interface InventoryAdjustmentsData {
  organizationId: string;
  role: "admin" | "manager";
  canTransferStock: boolean;
  branches: InventoryBranchOption[];
  destinationBranches: InventoryBranchOption[];
  products: any[];
  transfers: InventoryTransferRowView[];
  pendingInboundCount: number;
  transferEnabled: boolean;
}

const mapBranch = (branch: { id: string; name: string; code: string | null; address: string | null; is_active: boolean }): InventoryBranchOption => ({
  id: branch.id,
  name: branch.name,
  code: branch.code ?? "--",
  address: branch.address,
  isActive: branch.is_active ?? true,
});

export const getInventoryTransfersPage = async (
  context: InventoryContext,
  filters?: { branchId?: string | null; productId?: string | null; status?: TransferStatus | "all" },
  includeProducts: boolean = true,
): Promise<InventoryAdjustmentsData> => {
  const branchId = filters?.branchId ?? null;
  const productId = filters?.productId ?? null;
  const status = filters?.status ?? "all";

  const [branchesResult, transfersResult] = await Promise.all([
    context.adminClient
      .from("branches")
      .select("id, name, code, address, is_active")
      .eq("organization_id", context.organizationId)
      .eq("is_active", true)
      .order("name", { ascending: true })
      .returns<Array<{ id: string; name: string; code: string | null; address: string | null; is_active: boolean }>>(),
    Promise.all([
      context.adminClient
        .from("inventory_transfers")
        .select("*")
        .eq("organization_id", context.organizationId)
        .order("requested_at", { ascending: false })
        .limit(300),
      context.adminClient
        .from("inventory_transfer_batches" as never)
        .select("id, organization_id, source_branch_id, destination_branch_id, status, observations, reference_code, total_lines, total_quantity, requested_by, requested_at, received_by, received_at")
        .eq("organization_id", context.organizationId)
        .order("requested_at", { ascending: false })
        .limit(300),
    ]),
  ]);

  if (branchesResult.error) {
    throw createError({ statusCode: 500, statusMessage: branchesResult.error.message });
  }

  const branches = (branchesResult.data ?? []).map(mapBranch);

  const [transfers, batchTransfers] = transfersResult;

  if (transfers.error) {
    throw createError({ statusCode: 500, statusMessage: transfers.error.message });
  }

  const scopedTransfers = (transfers.data ?? []).filter((row) => {
    if (context.role === "admin") {
      return true;
    }
    return context.allowedBranchIds.includes(row.source_branch_id)
      || context.allowedBranchIds.includes(row.destination_branch_id);
  }).filter((row) => {
    if (status !== "all" && row.status !== status) return false;
    if (branchId && row.source_branch_id !== branchId && row.destination_branch_id !== branchId) return false;
    if (productId && row.product_id !== productId) return false;
    return true;
  });

  const scopedBatches = ((batchTransfers.data ?? []) as Array<{
    id: string;
    organization_id: string;
    source_branch_id: string;
    destination_branch_id: string;
    status: TransferStatus;
    observations: string | null;
    reference_code: string | null;
    total_lines: number;
    total_quantity: number;
    requested_by: string | null;
    requested_at: string | null;
    received_by: string | null;
    received_at: string | null;
  }>).filter((row) => {
    if (context.role === "admin") {
      return true;
    }
    return context.allowedBranchIds.includes(row.source_branch_id)
      || context.allowedBranchIds.includes(row.destination_branch_id);
  }).filter((row) => {
    if (status !== "all" && row.status !== status) return false;
    if (branchId && row.source_branch_id !== branchId && row.destination_branch_id !== branchId) return false;
    return true;
  });

  const scopedBatchIds = scopedBatches.map((row) => row.id);
  const batchLinesResult = scopedBatchIds.length > 0
    ? await context.adminClient
      .from("inventory_transfer_batch_lines" as never)
      .select("batch_id, product_id")
      .in("batch_id", scopedBatchIds)
      .returns<Array<{ batch_id: string; product_id: string }>>()
    : { data: [] as Array<{ batch_id: string; product_id: string }> };

  const batchProductsMap = new Map<string, Set<string>>();
  for (const row of batchLinesResult.data ?? []) {
    if (row.batch_id && row.product_id) {
      const current = batchProductsMap.get(row.batch_id);
      if (current) {
        current.add(row.product_id);
      } else {
        batchProductsMap.set(row.batch_id, new Set([row.product_id]));
      }
    }
  }

  const filteredBatchRows = scopedBatches.filter((row) => {
    if (!productId) return true;
    return batchProductsMap.get(row.id)?.has(productId) ?? false;
  });

  const allBranchIds = Array.from(new Set([
    ...scopedTransfers.flatMap((row) => [row.source_branch_id, row.destination_branch_id]),
    ...filteredBatchRows.flatMap((row) => [row.source_branch_id, row.destination_branch_id]),
  ]));
  const allProductIds = Array.from(new Set(scopedTransfers.map((row) => row.product_id)));
  const allProfileIds = Array.from(new Set([
    ...scopedTransfers.flatMap((row) => [row.requested_by, row.received_by, row.cancelled_by].filter(Boolean)),
    ...filteredBatchRows.flatMap((row) => [row.requested_by, row.received_by].filter(Boolean)),
  ]));

  const [branchesLookup, productsLookup, profilesLookup] = await Promise.all([
    allBranchIds.length > 0
      ? context.adminClient.from("branches").select("id, name, code").in("id", allBranchIds)
      : Promise.resolve({ data: [], error: null }),
    allProductIds.length > 0
      ? context.adminClient.from("products").select("id, name, sku").in("id", allProductIds)
      : Promise.resolve({ data: [], error: null }),
    allProfileIds.length > 0
      ? context.adminClient.from("profiles").select("id, full_name").in("id", allProfileIds.filter((id): id is string => Boolean(id)))
      : Promise.resolve({ data: [], error: null }),
  ]);

  const lookupBranchMap = new Map((branchesLookup.data ?? []).map((b) => [b.id, b]));
  const lookupProductMap = new Map((productsLookup.data ?? []).map((p) => [p.id, p]));
  const lookupProfileMap = new Map((profilesLookup.data ?? []).map((p) => [p.id, p]));

  const transferRows: InventoryTransferRowView[] = scopedTransfers.map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    productId: row.product_id,
    productName: lookupProductMap.get(row.product_id)?.name ?? "Producto",
    sku: lookupProductMap.get(row.product_id)?.sku ?? null,
    sourceBranchId: row.source_branch_id,
    sourceBranchName: lookupBranchMap.get(row.source_branch_id)?.name ?? "Sucursal",
    sourceBranchCode: lookupBranchMap.get(row.source_branch_id)?.code ?? "--",
    destinationBranchId: row.destination_branch_id,
    destinationBranchName: lookupBranchMap.get(row.destination_branch_id)?.name ?? "Sucursal",
    destinationBranchCode: lookupBranchMap.get(row.destination_branch_id)?.code ?? "--",
    quantity: row.quantity,
    status: row.status as TransferStatus,
    observations: row.observations,
    referenceCode: row.reference_code,
    requestedAt: row.requested_at,
    requestedBy: row.requested_by,
    requestedByName: row.requested_by ? lookupProfileMap.get(row.requested_by)?.full_name ?? null : null,
    receivedAt: row.received_at,
    receivedBy: row.received_by,
    receivedByName: row.received_by ? lookupProfileMap.get(row.received_by)?.full_name ?? null : null,
  }));

  const batchRows: InventoryTransferRowView[] = filteredBatchRows.map((row) => ({
    id: row.id,
    isBatch: true,
    totalLines: row.total_lines,
    isBatchReceived: row.status === "received",
    organizationId: row.organization_id,
    productId: row.id,
    productName: `Lote (${row.total_lines} producto${row.total_lines === 1 ? "" : "s"})`,
    sku: null,
    sourceBranchId: row.source_branch_id,
    sourceBranchName: lookupBranchMap.get(row.source_branch_id)?.name ?? "Sucursal",
    sourceBranchCode: lookupBranchMap.get(row.source_branch_id)?.code ?? "--",
    destinationBranchId: row.destination_branch_id,
    destinationBranchName: lookupBranchMap.get(row.destination_branch_id)?.name ?? "Sucursal",
    destinationBranchCode: lookupBranchMap.get(row.destination_branch_id)?.code ?? "--",
    quantity: row.total_quantity,
    status: row.status as TransferStatus,
    observations: row.observations,
    referenceCode: row.reference_code,
    requestedAt: row.requested_at,
    requestedBy: row.requested_by,
    requestedByName: row.requested_by ? lookupProfileMap.get(row.requested_by)?.full_name ?? null : null,
    receivedAt: row.received_at,
    receivedBy: row.received_by,
    receivedByName: row.received_by ? lookupProfileMap.get(row.received_by)?.full_name ?? null : null,
  }));

  const combinedTransfers = [...batchRows, ...transferRows].sort((left, right) => {
    const leftTime = left.requestedAt ? new Date(left.requestedAt).getTime() : 0;
    const rightTime = right.requestedAt ? new Date(right.requestedAt).getTime() : 0;
    return rightTime - leftTime;
  });

  let productsData: InventoryProductsData | null = null;
  if (includeProducts && (context.role === "admin" || context.allowedBranchIds.length > 0)) {
    productsData = await getInventoryProductsPage(context);
  }

  return {
    organizationId: context.organizationId,
    role: context.role,
    canTransferStock: context.canTransferStock,
    branches,
    destinationBranches: branches,
    products: productsData?.products ?? [],
    transfers: combinedTransfers,
    pendingInboundCount: combinedTransfers.filter((row) =>
      row.status === "pending"
      && context.allowedBranchIds.includes(row.destinationBranchId)).length,
    transferEnabled: context.canTransferStock,
  };
};
