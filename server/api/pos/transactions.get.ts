import { getQuery } from "h3";

import {
  requirePOSContext,
} from "../../utils/pos";

import type { Database, Json } from "@/types/database.types";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type TransactionItemRow = Database["public"]["Tables"]["transaction_items"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

export default defineEventHandler(async (event) => {
  const context = await requirePOSContext(event);
  const query = getQuery(event);
  const date = typeof query.date === "string" && query.date.trim().length > 0
    ? query.date
    : new Date().toISOString().slice(0, 10);
  const branchId = typeof query.branchId === "string" && query.branchId.trim().length > 0
    ? query.branchId
    : null;

  const startIso = new Date(`${date}T00:00:00`).toISOString();
  const endIso = new Date(`${date}T23:59:59`).toISOString();

  let request = context.adminClient
    .from("transactions")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("type", "sale")
    .gte("created_at", startIso)
    .lte("created_at", endIso)
    .order("created_at", { ascending: false });

  if (context.role !== "admin") {
    request = request.in("branch_id", context.allowedBranchIds);
  }

  if (branchId) {
    request = request.eq("branch_id", branchId);
  }

  const { data: transactions, error: transactionsError } = await request.returns<TransactionRow[]>();

  if (transactionsError) {
    throw createError({
      statusCode: 500,
      statusMessage: transactionsError.message,
    });
  }

  const transactionRows = transactions ?? [];
  const transactionIds = transactionRows.map((transaction) => transaction.id);
  const employeeIds = Array.from(new Set(transactionRows.map((transaction) => transaction.employee_id)));
  const customerIds = Array.from(new Set(transactionRows.map((transaction) => transaction.customer_id).filter((value): value is string => Boolean(value))));
  const branchIds = Array.from(new Set(transactionRows.map((transaction) => transaction.branch_id)));

  const [{ data: items, error: itemsError }, { data: employees, error: employeesError }, { data: customers, error: customersError }, { data: branches, error: branchesError }] = await Promise.all([
    transactionIds.length > 0
      ? context.adminClient
        .from("transaction_items")
        .select("*")
        .in("transaction_id", transactionIds)
        .returns<TransactionItemRow[]>()
      : Promise.resolve({ data: [] as TransactionItemRow[], error: null }),
    employeeIds.length > 0
      ? context.adminClient
        .from("profiles")
        .select("id, full_name")
        .in("id", employeeIds)
        .returns<Array<Pick<ProfileRow, "id" | "full_name">>>()
      : Promise.resolve({ data: [] as Array<Pick<ProfileRow, "id" | "full_name">>, error: null }),
    customerIds.length > 0
      ? context.adminClient
        .from("profiles")
        .select("id, full_name, phone, email")
        .in("id", customerIds)
        .returns<Array<Pick<ProfileRow, "id" | "full_name" | "phone" | "email">>>()
      : Promise.resolve({ data: [] as Array<Pick<ProfileRow, "id" | "full_name" | "phone" | "email">>, error: null }),
    branchIds.length > 0
      ? context.adminClient
        .from("branches")
        .select("id, name")
        .in("id", branchIds)
        .returns<Array<Pick<BranchRow, "id" | "name">>>()
      : Promise.resolve({ data: [] as Array<Pick<BranchRow, "id" | "name">>, error: null }),
  ]);

  const firstError = itemsError ?? employeesError ?? customersError ?? branchesError;
  if (firstError) {
    throw createError({
      statusCode: 500,
      statusMessage: firstError.message,
    });
  }

  const itemsByTransaction = (items ?? []).reduce<Map<string, TransactionItemRow[]>>((accumulator, item) => {
    const row = accumulator.get(item.transaction_id) ?? [];
    row.push(item);
    accumulator.set(item.transaction_id, row);
    return accumulator;
  }, new Map<string, TransactionItemRow[]>());

  const employeeMap = new Map((employees ?? []).map((employee) => [employee.id, employee.full_name]));
  const customerMap = new Map((customers ?? []).map((customer) => [customer.id, customer]));
  const branchMap = new Map((branches ?? []).map((branch) => [branch.id, branch.name]));

  return {
    transactions: transactionRows.map((transaction) => {
      const transactionItems = itemsByTransaction.get(transaction.id) ?? [];
      const snapshotCustomer = (() => {
        const snapshot = transactionItems[0]?.snapshot_data;
        if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
          return null;
        }

        const customerValue = (snapshot as Record<string, Json>).customer;
        if (!customerValue || typeof customerValue !== "object" || Array.isArray(customerValue)) {
          return null;
        }

        const customerRecord = customerValue as Record<string, Json>;
        return {
          fullName: typeof customerRecord.fullName === "string" ? customerRecord.fullName : "Cliente",
          phone: typeof customerRecord.phone === "string" ? customerRecord.phone : null,
        };
      })();

      const linkedCustomer = transaction.customer_id ? customerMap.get(transaction.customer_id) ?? null : null;

      return {
        id: transaction.id,
        invoiceNumber: transaction.invoice_number,
        createdAt: transaction.created_at,
        branchId: transaction.branch_id,
        branchName: branchMap.get(transaction.branch_id) ?? "Sucursal",
        employeeId: transaction.employee_id,
        employeeName: employeeMap.get(transaction.employee_id) ?? "Equipo",
        customerName: linkedCustomer?.full_name ?? snapshotCustomer?.fullName ?? "Cliente walk-in",
        customerPhone: linkedCustomer?.phone ?? snapshotCustomer?.phone ?? null,
        finalAmount: Number(transaction.final_amount),
        paymentMethod: transaction.payment_method ?? "cash",
        status: transaction.status ?? "completed",
        itemsCount: transactionItems.length,
      };
    }),
  };
});
