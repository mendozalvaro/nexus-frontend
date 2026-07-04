import { describe, expect, it } from "vitest";

import type { POSReceipt } from "@/composables/usePOS";
import { renderReceiptHtml } from "@/utils/receipt-renderer";

const baseReceipt: POSReceipt = {
  transactionId: "tx-1",
  invoiceNumber: 32,
  createdAt: new Date("2026-05-31T10:30:00.000Z").toISOString(),
  branchId: "branch-1",
  branchName: "Sucursal Central",
  employeeId: "employee-1",
  employeeName: "Operador QA",
  customer: {
    mode: "walk_in",
    customerId: null,
    fullName: "Cliente QA",
    phone: "76543210",
  },
  paymentMethod: "cash",
  totalAmount: 120,
  discountAmount: 20,
  taxAmount: 0,
  finalAmount: 100,
  formatUsed: "half_letter",
  verificationUrl: "/api/receipts/v/token_largo_de_prueba_que_debe_truncarse_para_evitar_desbordes_en_layout_1234567890123456789012345678901234567890",
  items: [
    {
      id: "line-1",
      itemType: "product",
      title: "Producto de prueba con nombre muy largo para validar salto de linea",
      subtitle: "SKU-001",
      quantity: 2,
      unitPrice: 50,
      subtotal: 100,
      snapshotData: {
        catalogId: "cat-1",
        branchId: "branch-1",
      },
    },
  ],
};

describe("receipt-renderer", () => {
  it("renderiza media carta con tabla, totales y qr embebido", () => {
    const html = renderReceiptHtml(baseReceipt, "half_letter", "data:image/png;base64,abc123");
    expect(html).toContain("Recibo de Venta");
    expect(html).toContain("Producto de prueba");
    expect(html).toContain("Bs 100.00");
    expect(html).toContain("data:image/png;base64,abc123");
  });

  it("trunca url de verificacion larga para mantener layout", () => {
    const html = renderReceiptHtml(baseReceipt, "half_letter", "data:image/png;base64,abc123");
    expect(html).toContain("...");
    expect(html).toContain("Verificacion");
  });

  it("soporta ticket termico sin romper estructura basica", () => {
    const html = renderReceiptHtml(baseReceipt, "thermal", "data:image/png;base64,abc123");
    expect(html).toContain("Termico");
    expect(html).toContain("Cant.");
    expect(html).toContain("Subtotal");
  });
});
