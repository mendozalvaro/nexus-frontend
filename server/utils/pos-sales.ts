import { createError } from "h3";
import { z } from "zod";

import type { Json } from "@/types/database.types";
import type { POSContext } from "./pos";

export const salesOrderItemSchema = z.discriminatedUnion("itemType", [
  z.object({
    itemType: z.literal("product"),
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
  }),
  z.object({
    itemType: z.literal("service"),
    serviceId: z.string().uuid(),
    employeeId: z.string().uuid(),
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    scheduledTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    quantity: z.number().int().positive().default(1),
  }),
]);

export const salesOrderCustomerSchema = z.union([
  z.object({
    mode: z.literal("existing"),
    customerId: z.string().uuid(),
  }),
  z.object({
    mode: z.literal("walk_in"),
    fullName: z.string().trim().min(3),
    phone: z.string().trim().min(7),
  }),
]);

export const salesOrderDiscountSchema = z.object({
  type: z.enum(["none", "percentage", "fixed"]),
  value: z.number().min(0).default(0),
});

export const createSalesOrderSchema = z.object({
  branchId: z.string().uuid(),
  customer: salesOrderCustomerSchema,
  discount: salesOrderDiscountSchema.default({ type: "none", value: 0 }),
  note: z.string().trim().max(240).optional().default(""),
  items: z.array(salesOrderItemSchema).min(1),
  status: z.enum(["draft", "ready_to_charge"]).optional().default("draft"),
});

export const updateSalesOrderSchema = z.object({
  customer: salesOrderCustomerSchema.optional(),
  discount: salesOrderDiscountSchema.optional(),
  note: z.string().trim().max(240).optional(),
  items: z.array(salesOrderItemSchema).min(1).optional(),
  status: z.enum(["draft", "ready_to_charge", "cancelled"]).optional(),
});

export const chargeSalesOrderSchema = z.object({
  salesOrderId: z.string().uuid(),
  paymentMethod: z.enum(["cash", "card", "transfer", "mixed", "digital_wallet"]),
  receiptFormatOverride: z.enum(["thermal", "half_letter"]).optional().nullable(),
});

export type SalesOrderItemInput = z.infer<typeof salesOrderItemSchema>;
export type CreateSalesOrderInput = z.infer<typeof createSalesOrderSchema>;
export type UpdateSalesOrderInput = z.infer<typeof updateSalesOrderSchema>;
export type ChargeSalesOrderInput = z.infer<typeof chargeSalesOrderSchema>;

export const roundCurrency = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export const computeSalesOrderDiscountAmount = (subtotal: number, discount: { type: "none" | "percentage" | "fixed"; value: number }) => {
  if (discount.type === "none" || discount.value <= 0) {
    return 0;
  }
  if (discount.type === "percentage") {
    return roundCurrency(Math.min(subtotal, subtotal * (discount.value / 100)));
  }
  return roundCurrency(Math.min(subtotal, discount.value));
};

export async function nextSalesOrderNumber(context: POSContext) {
  const { data, error } = await (context.adminClient as any).rpc("next_sales_order_number", {
    p_organization_id: context.organizationId,
  });
  if (error || typeof data !== "number") {
    throw createError({ statusCode: 500, statusMessage: "No se pudo generar el número de orden de venta." });
  }
  return data;
}

export async function nextProformaNumber(context: POSContext) {
  const { data, error } = await (context.adminClient as any).rpc("next_proforma_number", {
    p_organization_id: context.organizationId,
  });
  if (error || typeof data !== "number") {
    throw createError({ statusCode: 500, statusMessage: "No se pudo generar el número de proforma." });
  }
  return data;
}

export const assertSalesBranchAccess = (context: POSContext, branchId: string) => {
  if (!context.allowedBranchIds.includes(branchId) && context.role !== "admin") {
    throw createError({ statusCode: 403, statusMessage: "No tienes acceso a esta sucursal para operar ventas." });
  }
};

export const toJson = (value: unknown): Json => value as Json;
