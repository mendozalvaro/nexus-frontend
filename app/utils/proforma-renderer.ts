import type { POSProforma, POSSalesOrder, POSSalesOrderItem } from "@/composables/usePOSSales";

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const formatCurrency = (value: number) => `Bs ${value.toFixed(2)}`;

const asRecord = (value: unknown): Record<string, unknown> | null => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
};

const openPrintWindow = (html: string) => {
  const printWindow = window.open("", "_blank", "width=960,height=900");
  if (!printWindow) {
    throw new Error("No se pudo abrir la ventana de impresion.");
  }

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => {
    printWindow.print();
  };
};

export const printProforma = (params: {
  proforma: POSProforma;
  order: POSSalesOrder;
  items: POSSalesOrderItem[];
}) => {
  const rows = params.items.map((item) => {
    const snapshot = asRecord(item.snapshot_data);
    const title = typeof snapshot?.title === "string" ? snapshot.title : (item.item_type === "product" ? "Producto" : "Servicio");
    const subtitle = typeof snapshot?.subtitle === "string" ? snapshot.subtitle : "";

    return `
      <tr>
        <td>
          ${escapeHtml(title)}
          ${subtitle ? `<br><small>${escapeHtml(subtitle)}</small>` : ""}
        </td>
        <td class="right">${item.quantity}</td>
        <td class="right">${formatCurrency(Number(item.unit_price))}</td>
        <td class="right strong">${formatCurrency(Number(item.subtotal))}</td>
      </tr>
    `;
  }).join("");

  const html = `<!DOCTYPE html>
  <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Proforma #${params.proforma.proforma_number}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; padding: 24px; }
        .page { max-width: 860px; margin: 0 auto; }
        .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #cbd5e1; padding-bottom:16px; margin-bottom:24px; }
        .title h1 { margin:0; font-size:30px; }
        .title p { margin:6px 0 0; color:#475569; }
        .meta { text-align:right; font-size:14px; color:#334155; }
        .grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:16px; margin-bottom:20px; }
        .card { border:1px solid #e2e8f0; border-radius:16px; padding:14px 16px; }
        .label { font-size:12px; text-transform:uppercase; letter-spacing:.12em; color:#64748b; }
        .value { margin-top:6px; font-size:16px; font-weight:600; }
        table { width:100%; border-collapse:collapse; margin-top:12px; }
        th, td { padding:12px 8px; border-bottom:1px solid #e2e8f0; vertical-align:top; }
        th { text-align:left; font-size:12px; text-transform:uppercase; letter-spacing:.12em; color:#64748b; }
        .right { text-align:right; }
        .strong { font-weight:700; }
        .summary { margin-top:20px; margin-left:auto; width:min(320px, 100%); border:1px solid #e2e8f0; border-radius:16px; padding:16px; }
        .line { display:flex; justify-content:space-between; margin-bottom:8px; color:#334155; }
        .total { display:flex; justify-content:space-between; font-size:24px; font-weight:700; margin-top:14px; }
        .footer { margin-top:28px; font-size:13px; color:#64748b; text-align:center; }
        small { color:#64748b; }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header">
          <div class="title">
            <h1>Proforma</h1>
            <p>NexusPOS · Documento comercial preliminar</p>
          </div>
          <div class="meta">
            <div><strong>N° ${params.proforma.proforma_number}</strong></div>
            <div>${new Date(params.proforma.issued_at).toLocaleString("es-BO")}</div>
          </div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="label">Cliente</div>
            <div class="value">${escapeHtml(params.order.customer_full_name)}</div>
          </div>
          <div class="card">
            <div class="label">Estado OV</div>
            <div class="value">${escapeHtml(params.order.status)}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Descripcion</th>
              <th class="right">Cant.</th>
              <th class="right">P.Unit</th>
              <th class="right">Subtotal</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="summary">
          <div class="line"><span>Subtotal</span><span>${formatCurrency(Number(params.order.subtotal))}</span></div>
          <div class="line"><span>Descuento</span><span>${formatCurrency(Number(params.order.discount_amount))}</span></div>
          <div class="total"><span>Total</span><span>${formatCurrency(Number(params.order.final_amount))}</span></div>
        </div>

        <div class="footer">
          Esta proforma no constituye comprobante fiscal ni venta final.
        </div>
      </div>
    </body>
  </html>`;

  openPrintWindow(html);
};

