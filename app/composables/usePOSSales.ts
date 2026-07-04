import type { Database } from "@/types/database.types";

type PaymentMethod = Database["public"]["Enums"]["payment_method"];

export type POSOrderStatus = "draft" | "ready_to_charge" | "charged" | "cancelled";

export type POSSalesOrderItemInput =
  | { itemType: "product"; productId: string; quantity: number }
  | { itemType: "service"; serviceId: string; employeeId: string; scheduledDate: string; scheduledTime: string; quantity: 1 };

export type POSSalesOrderCustomerInput =
  | { mode: "existing"; customerId: string }
  | { mode: "walk_in"; fullName: string; phone: string };

export interface POSSalesOrderInput {
  branchId: string;
  customer: POSSalesOrderCustomerInput;
  discount: { type: "none" | "percentage" | "fixed"; value: number };
  note: string;
  items: POSSalesOrderItemInput[];
  status?: "draft" | "ready_to_charge";
}

export interface POSProforma {
  id: string;
  proforma_number: number;
  sales_order_id: string;
  status: string;
  issued_at: string;
  branch_id?: string;
  snapshot?: Record<string, unknown> | null;
}

export interface POSSalesOrder {
  id: string;
  branch_id: string;
  sales_order_number: number;
  customer_mode: "existing" | "walk_in";
  customer_id: string | null;
  customer_full_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  discount_type: "none" | "percentage" | "fixed";
  discount_value: number;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  final_amount: number;
  note: string | null;
  status: POSOrderStatus;
  charged_transaction_id?: string | null;
  charged_at?: string | null;
  created_at?: string | null;
}

export interface POSSalesOrderItem {
  id: string;
  sales_order_id: string;
  item_type: "product" | "service";
  branch_id: string;
  product_id: string | null;
  service_id: string | null;
  employee_id: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  snapshot_data: Record<string, unknown> | null;
}

export const usePOSSales = () => {
  const { resolveAccessToken } = useSessionAccess();

  const getAuthHeaders = async () => {
    const token = await resolveAccessToken();
    if (!token) {
      throw createError({ statusCode: 401, statusMessage: "Sesión no disponible." });
    }
    return { Authorization: `Bearer ${token}` };
  };

  const listOrders = async (status?: POSOrderStatus) => {
    return $fetch<{ orders: POSSalesOrder[] }>("/api/pos/sales-orders", {
      headers: await getAuthHeaders(),
      query: status ? { status } : undefined,
    });
  };

  const getOrder = async (id: string) => {
    return $fetch<{ order: POSSalesOrder; items: POSSalesOrderItem[] }>(`/api/pos/sales-orders/${id}`, {
      headers: await getAuthHeaders(),
    });
  };

  const createOrder = async (input: POSSalesOrderInput) => {
    return $fetch<{ order: POSSalesOrder; items: POSSalesOrderItem[] }>("/api/pos/sales-orders", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: input,
    });
  };

  const updateOrder = async (id: string, patch: Partial<POSSalesOrderInput> & { status?: POSOrderStatus }) => {
    return $fetch<{ order: POSSalesOrder; items: POSSalesOrderItem[] }>(`/api/pos/sales-orders/${id}`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: patch,
    });
  };

  const issueProforma = async (salesOrderId: string) => {
    return $fetch<{ proforma: POSProforma }>(`/api/pos/sales-orders/${salesOrderId}/proforma`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
  };

  const listProformas = async () => {
    return $fetch<{ proformas: POSProforma[] }>("/api/pos/proformas", {
      headers: await getAuthHeaders(),
    });
  };

  const resumeFromProforma = async (proformaId: string) => {
    return $fetch<{ order: POSSalesOrder; items: POSSalesOrderItem[] }>(`/api/pos/proformas/${proformaId}/resume`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
  };

  return {
    listOrders,
    getOrder,
    createOrder,
    updateOrder,
    issueProforma,
    listProformas,
    resumeFromProforma,
  };
};

export type { PaymentMethod };

