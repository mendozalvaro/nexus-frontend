import { createClient } from "@supabase/supabase-js";
import { createError } from "h3";

import type { Database } from "@/types/database.types";

import type { ReportsResolvedContext, ReportBranchOption, ReportEmployeeOption, ReportCategoryOption } from "./context";

import type { H3Event } from "h3";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type TransactionItemRow = Database["public"]["Tables"]["transaction_items"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type InventoryStockRow = Database["public"]["Tables"]["inventory_stock"]["Row"];
type InventoryMovementRow = Database["public"]["Tables"]["inventory_movements"]["Row"];

const startOfDayIso = (value: string) => new Date(`${value}T00:00:00`).toISOString();
const endOfDayIso = (value: string) => new Date(`${value}T23:59:59.999`).toISOString();

const getSupabaseServerConfig = (event: H3Event) => {
  const config = useRuntimeConfig(event);
  const url = process.env.NUXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = config.supabaseServiceRoleKey as string | undefined;

  if (!url || !anonKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "La configuracion publica de Supabase esta incompleta.",
    });
  }

  if (!serviceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "Falta NUXT_SUPABASE_SERVICE_ROLE_KEY para generar reportes desde el servidor.",
    });
  }

  return { url, anonKey, serviceRoleKey };
};

const sumValues = (values: number[]) => values.reduce((sum, value) => sum + value, 0);
const titleCase = (value: string | null | undefined, fallback: string) => {
  if (!value) {
    return fallback;
  }

  return value
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB", maximumFractionDigits: 2 }).format(amount);
const formatInteger = (value: number) => new Intl.NumberFormat("es-BO").format(value);

export interface ReportsProductsResult {
  kpis: Array<{ label: string; value: string; tone?: string; meta?: string }>;
  topProducts: Array<{ label: string; value: number; meta?: string }>;
  rotation: Array<{ label: string; value: number; meta?: string }>;
  lowStock: Array<{ label: string; value: number; meta?: string }>;
  movementSummary: Array<{ label: string; value: number }>;
  tableRows: Array<Record<string, string | number>>;
  filterOptions: {
    branches: ReportBranchOption[];
    employees: ReportEmployeeOption[];
    productCategories: ReportCategoryOption[];
    serviceCategories: ReportCategoryOption[];
    paymentMethods: Array<{ label: string; value: string }>;
  };
}

export async function getReportsProducts(
  event: H3Event,
  context: ReportsResolvedContext,
  filters: { startDate: string; endDate: string; branchIds: string[]; employeeId: string | null; paymentMethod: string; categoryIds: string[] },
  filterOptions: ReportsProductsResult["filterOptions"],
): Promise<ReportsProductsResult> {
  const { url, serviceRoleKey } = getSupabaseServerConfig(event);
  const adminClient = createClient<Database, "public">(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const scopedBranchIds = (context.role === "manager"
    ? context.branchIds
    : filters.branchIds.length === 0
      ? context.branchIds
      : context.branchIds.filter((branchId) => filters.branchIds.includes(branchId))) as readonly string[];

  let transactionQuery = adminClient
    .from("transactions")
    .select("id, branch_id, employee_id, created_at, final_amount, payment_method, status, type")
    .eq("organization_id", context.organizationId)
    .in("branch_id", scopedBranchIds)
    .gte("created_at", startOfDayIso(filters.startDate))
    .lte("created_at", endOfDayIso(filters.endDate))
    .order("created_at", { ascending: false });

  if (filters.employeeId) {
    transactionQuery = transactionQuery.eq("employee_id", filters.employeeId);
  }

  if (filters.paymentMethod !== "all") {
    transactionQuery = transactionQuery.eq("payment_method", filters.paymentMethod as any);
  }

  const { data: transactions, error: transactionsError } = await transactionQuery.returns<Pick<TransactionRow, "id" | "branch_id" | "employee_id" | "created_at" | "final_amount" | "payment_method" | "status" | "type">[]>();

  if (transactionsError) {
    throw createError({ statusCode: 500, statusMessage: transactionsError.message });
  }

  const completedTransactions = (transactions ?? []).filter((t) => t.type === "sale" && t.status === "completed");
  const transactionIds = completedTransactions.map((t) => t.id);

  let productItems: Pick<TransactionItemRow, "id" | "transaction_id" | "item_type" | "product_id" | "service_id" | "quantity" | "subtotal" | "unit_price">[] = [];
  if (transactionIds.length > 0) {
    const { data: items, error: itemsError } = await adminClient
      .from("transaction_items")
      .select("id, transaction_id, item_type, product_id, service_id, quantity, subtotal, unit_price")
      .in("transaction_id", transactionIds)
      .returns<Pick<TransactionItemRow, "id" | "transaction_id" | "item_type" | "product_id" | "service_id" | "quantity" | "subtotal" | "unit_price">[]>();

    if (itemsError) {
      throw createError({ statusCode: 500, statusMessage: itemsError.message });
    }

    productItems = (items ?? []).filter((item) => item.item_type === "product" && item.product_id);
  }

  const productIds = Array.from(new Set(productItems.map((item) => item.product_id).filter((v): v is string => Boolean(v))));
  let productsById = new Map<string, ProductRow>();
  if (productIds.length > 0) {
    const { data: products, error: productsError } = await adminClient
      .from("products")
      .select("*")
      .eq("organization_id", context.organizationId)
      .in("id", productIds)
      .returns<ProductRow[]>();

    if (productsError) {
      throw createError({ statusCode: 500, statusMessage: productsError.message });
    }

    productsById = new Map((products ?? []).map((p) => [p.id, p]));
  }

  const filteredProductItems = productItems.filter((item) => {
    const product = item.product_id ? productsById.get(item.product_id) : null;
    if (!product) {
      return false;
    }

    if (filters.categoryIds.length > 0 && !filters.categoryIds.includes(product.category_id ?? "")) {
      return false;
    }

    return true;
  });

  const topProducts = Array.from(filteredProductItems.reduce<Map<string, { quantity: number; revenue: number }>>((acc, item) => {
    const productId = item.product_id ?? "";
    const current = acc.get(productId) ?? { quantity: 0, revenue: 0 };
    current.quantity += item.quantity;
    current.revenue += item.subtotal;
    acc.set(productId, current);
    return acc;
  }, new Map())).map(([productId, metrics]) => ({
    label: productsById.get(productId)?.name ?? "Producto",
    value: metrics.quantity,
    meta: formatCurrency(metrics.revenue),
  })).sort((a, b) => b.value - a.value).slice(0, 10);

  const { data: stockRows, error: stockError } = await adminClient
    .from("inventory_stock")
    .select("branch_id, product_id, quantity, min_stock_level")
    .in("branch_id", scopedBranchIds)
    .returns<Pick<InventoryStockRow, "branch_id" | "product_id" | "quantity" | "min_stock_level">[]>();

  if (stockError) {
    throw createError({ statusCode: 500, statusMessage: stockError.message });
  }

  const stockByProduct = (stockRows ?? []).reduce<Map<string, { quantity: number; minStockLevel: number }>>((acc, row) => {
    const current = acc.get(row.product_id) ?? { quantity: 0, minStockLevel: 0 };
    current.quantity += row.quantity ?? 0;
    current.minStockLevel += row.min_stock_level ?? 0;
    acc.set(row.product_id, current);
    return acc;
  }, new Map());

  const rotation = Array.from(stockByProduct.entries()).map(([productId, stock]) => {
    const soldUnits = filteredProductItems
      .filter((item) => item.product_id === productId)
      .reduce((sum, item) => sum + item.quantity, 0);
    return {
      label: productsById.get(productId)?.name ?? "Producto",
      value: stock.quantity > 0 ? Number((soldUnits / stock.quantity).toFixed(2)) : soldUnits,
      meta: `${formatInteger(stock.quantity)} uds en stock`,
    };
  }).sort((a, b) => b.value - a.value).slice(0, 8);

  const lowStock = Array.from(stockByProduct.entries())
    .map(([productId, stock]) => {
      const product = productsById.get(productId);
      if (!product || stock.quantity > stock.minStockLevel) {
        return null;
      }

      return {
        label: product.name,
        value: stock.quantity,
        meta: `Minimo ${formatInteger(stock.minStockLevel)}`,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.value - b.value)
    .slice(0, 8);

  const { data: movementRows, error: movementError } = await adminClient
    .from("inventory_movements")
    .select("movement_type, quantity, product_id, created_at")
    .eq("organization_id", context.organizationId)
    .in("branch_id", scopedBranchIds)
    .gte("created_at", startOfDayIso(filters.startDate))
    .lte("created_at", endOfDayIso(filters.endDate))
    .returns<Pick<InventoryMovementRow, "movement_type" | "quantity" | "product_id" | "created_at">[]>();

  if (movementError) {
    throw createError({ statusCode: 500, statusMessage: movementError.message });
  }

  return {
    kpis: [
      { label: "Unidades vendidas", value: formatInteger(sumValues(filteredProductItems.map((item) => item.quantity))), tone: "primary" },
      { label: "Ingresos por productos", value: formatCurrency(sumValues(filteredProductItems.map((item) => item.subtotal))), tone: "success" },
      { label: "Rotacion lider", value: rotation[0] ? `${rotation[0].value}x` : "0x", tone: "warning", meta: rotation[0]?.label ?? "Sin datos" },
      { label: "Alertas de stock", value: formatInteger(lowStock.length), tone: "error" },
    ],
    topProducts,
    rotation,
    lowStock,
    movementSummary: Array.from((movementRows ?? []).reduce<Map<string, number>>((acc, row) => {
      acc.set(row.movement_type, (acc.get(row.movement_type) ?? 0) + row.quantity);
      return acc;
    }, new Map())).map(([label, value]) => ({
      label: titleCase(label, "Movimiento"),
      value,
    })),
    tableRows: topProducts.map((product) => ({
      Producto: product.label,
      Unidades: formatInteger(product.value),
      Ingresos: product.meta ?? formatCurrency(0),
    })),
    filterOptions,
  };
}

