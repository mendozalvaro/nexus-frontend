import type { Database } from "@/types/database.types";
import type { POSReceipt } from "@/composables/usePOS";

type PaymentMethod = Database["public"]["Enums"]["payment_method"];

export interface POSChargePayload {
  salesOrderId: string;
  paymentMethod: PaymentMethod;
  receiptFormatOverride?: "thermal" | "half_letter" | null;
}

export const usePOSCharge = () => {
  const { resolveAccessToken } = useSessionAccess();

  const getAuthHeaders = async () => {
    const token = await resolveAccessToken();
    if (!token) {
      throw createError({ statusCode: 401, statusMessage: "Sesión no disponible." });
    }
    return { Authorization: `Bearer ${token}` };
  };

  const listReadyOrders = async () => {
    return $fetch<{ orders: Array<Record<string, unknown>> }>("/api/pos/sales-orders", {
      headers: await getAuthHeaders(),
      query: { status: "ready_to_charge" },
    });
  };

  const charge = async (payload: POSChargePayload) => {
    return $fetch<{ success: boolean; transactionId: string; receipt: POSReceipt }>("/api/pos/charge", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: payload,
    });
  };

  return { listReadyOrders, charge };
};
