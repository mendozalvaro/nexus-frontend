import type { POSReceipt, ReceiptFormat } from "@/composables/usePOS";
import QRCode from "qrcode";

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const getReceiptLabel = (format: ReceiptFormat) => {
  return format === "half_letter" ? "Media carta" : "Termico";
};

const truncateVerificationUrl = (verificationUrl: string) => {
  if (verificationUrl.length <= 88) return verificationUrl;
  return `${verificationUrl.slice(0, 85)}...`;
};

const buildVerificationQrDataUrl = async (verificationUrl: string) => {
  return QRCode.toDataURL(verificationUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 180,
  });
};

export const renderReceiptHtml = (
  receipt: POSReceipt,
  format: ReceiptFormat,
  verificationQrDataUrl: string,
): string => {
  const rows = receipt.items
    .map((item) => {
      return `<tr>
        <td>
          ${escapeHtml(item.title)}
          ${item.subtitle ? `<br><small>${escapeHtml(item.subtitle)}</small>` : ""}
        </td>
        <td class="right">${item.quantity}</td>
        <td class="right">Bs ${item.unitPrice.toFixed(2)}</td>
        <td class="right strong">Bs ${item.subtotal.toFixed(2)}</td>
      </tr>`;
    })
    .join("");

  const discountRow = receipt.discountAmount > 0
    ? `<div class="line"><span>Descuento</span><span>Bs ${receipt.discountAmount.toFixed(2)}</span></div>`
    : `<div class="line"><span>Descuento</span><span>Bs 0.00</span></div>`;

  const verificationShort = truncateVerificationUrl(receipt.verificationUrl);
  const isHalfLetter = format === "half_letter";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Recibo #${receipt.invoiceNumber}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:${isHalfLetter ? "'Segoe UI', Arial, sans-serif" : "'Courier New',monospace"};color:#000;background:#fff}
    .page{${isHalfLetter ? "width:100%;max-width:none;min-height:100%;padding:10mm 10mm 8mm 10mm;margin:0;" : "max-width:320px;padding:14px;margin:0 auto;"}}
    .header{text-align:center;border-bottom:1px dashed #334155;padding-bottom:10px;margin-bottom:10px}
    .header h1{font-size:${isHalfLetter ? "30px" : "18px"};line-height:1.05}
    .header .title{font-size:${isHalfLetter ? "19px" : "13px"};font-weight:600}
    .muted{color:${isHalfLetter ? "#334155" : "#64748b"}}
    .meta-grid{${isHalfLetter ? "display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:10px;" : ""}}
    .meta-card{${isHalfLetter ? "border:1px solid #e2e8f0;border-radius:8px;padding:9px 11px;" : ""}}
    .info{font-size:${isHalfLetter ? "13px" : "12px"};margin-bottom:10px}
    .info .line{display:flex;justify-content:space-between;padding:2px 0}
    table{width:100%;border-collapse:collapse;font-size:${isHalfLetter ? "13px" : "12px"};margin-bottom:10px}
    thead th{padding:6px 0;border-bottom:1.5px solid #334155;font-size:${isHalfLetter ? "12px" : "11px"};text-transform:uppercase;letter-spacing:.02em;text-align:left}
    thead th.right{text-align:right}
    td{padding:5px 0;border-bottom:1px solid #e2e8f0;vertical-align:top}
    td.right{text-align:right}
    .strong{font-weight:700}
    .summary{border-top:1px dashed #334155;padding-top:8px}
    .summary .line{display:flex;justify-content:space-between;font-size:${isHalfLetter ? "13px" : "12px"}}
    .total{display:flex;justify-content:space-between;margin-top:6px;font-size:${isHalfLetter ? "22px" : "18px"};font-weight:700}
    .verify{margin-top:14px;padding-top:10px;border-top:1px dashed #cbd5e1;display:grid;grid-template-columns:${isHalfLetter ? "110px minmax(0,1fr)" : "80px 1fr"};gap:12px;align-items:center}
    .verify img{width:${isHalfLetter ? "100px" : "80px"};height:${isHalfLetter ? "100px" : "80px"};border:1px solid #e2e8f0;padding:3px;background:#fff}
    .verify .url{font-size:${isHalfLetter ? "10px" : "11px"};word-break:break-word;overflow-wrap:anywhere;color:#0f172a;line-height:1.3}
    .footer{text-align:center;font-size:${isHalfLetter ? "12px" : "11px"};color:#334155;margin-top:10px}
    @media print{
      @page{size:${isHalfLetter ? "letter portrait" : "80mm auto"};margin:${isHalfLetter ? "0" : "4mm"}}
      .page{margin:0}
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1>NexusPOS</h1>
      <p class="muted">${escapeHtml(receipt.branchName)}</p>
      <p class="title">Recibo de Venta</p>
    </div>
    <div class="${isHalfLetter ? "meta-grid" : ""}">
      <div class="${isHalfLetter ? "meta-card" : ""}">
        <div class="info">
          <div class="line"><span>Factura #:</span><span>${receipt.invoiceNumber}</span></div>
          <div class="line"><span>Fecha:</span><span>${new Date(receipt.createdAt).toLocaleString("es-BO")}</span></div>
          <div class="line"><span>Formato:</span><span>${getReceiptLabel(format)}</span></div>
        </div>
      </div>
      <div class="${isHalfLetter ? "meta-card" : ""}">
        <div class="info">
          <div class="line"><span>Cliente:</span><span>${escapeHtml(receipt.customer.fullName)}</span></div>
          <div class="line"><span>Telefono:</span><span>${escapeHtml(receipt.customer.phone ?? "-")}</span></div>
          <div class="line"><span>Pago:</span><span>${escapeHtml(receipt.paymentMethod)}</span></div>
        </div>
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
      <div class="line"><span>Subtotal</span><span>Bs ${receipt.totalAmount.toFixed(2)}</span></div>
      ${discountRow}
      <div class="total"><span>Total</span><span>Bs ${receipt.finalAmount.toFixed(2)}</span></div>
    </div>
    <div class="verify">
      <img src="${verificationQrDataUrl}" alt="QR de verificacion" />
      <div>
        <p class="strong">Verificacion</p>
        <p class="url">${escapeHtml(verificationShort)}</p>
      </div>
    </div>
    <div class="footer">
      <p>Gracias por su compra</p>
      <p>NexusPOS - Sistema de ventas</p>
    </div>
  </div>
</body>
</html>`;
};

const openPrintWindow = (html: string) => {
  const printWindow = window.open("", "_blank", "width=900,height=900");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => {
    printWindow.print();
  };
};

const buildPdfFromHtml = async (html: string, fileName: string) => {
  const html2pdf = (await import("html2pdf.js")).default as any;
  const exportWidth = 816;
  const exportHeight = 1056;
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.left = "-99999px";
  frame.style.top = "0";
  frame.style.width = `${exportWidth}px`;
  frame.style.height = `${exportHeight}px`;
  frame.style.border = "0";
  frame.style.pointerEvents = "none";
  frame.setAttribute("aria-hidden", "true");
  document.body.appendChild(frame);

  try {
    const frameDoc = frame.contentDocument;
    if (!frameDoc) {
      throw new Error("No se pudo inicializar el documento de exportacion.");
    }

    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    await new Promise<void>((resolve) => {
      if (frame.contentWindow?.document.readyState === "complete") {
        resolve();
        return;
      }
      frame.onload = () => resolve();
    });

    const images = Array.from(frameDoc.images);
    await Promise.all(
      images.map((image) => new Promise<void>((resolve) => {
        if (image.complete) {
          resolve();
          return;
        }
        image.onload = () => resolve();
        image.onerror = () => resolve();
      })),
    );

    const htmlRoot = frameDoc.documentElement;
    const source = frameDoc.body;
    htmlRoot.style.width = `${exportWidth}px`;
    htmlRoot.style.minWidth = `${exportWidth}px`;
    source.style.width = `${exportWidth}px`;
    source.style.minWidth = `${exportWidth}px`;
    source.style.margin = "0";
    source.style.background = "#ffffff";

    await html2pdf()
      .set({
        margin: 0,
        filename: fileName,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          letterRendering: true,
          width: exportWidth,
          height: exportHeight,
          windowWidth: exportWidth,
          windowHeight: exportHeight,
          scrollX: 0,
          scrollY: 0,
        },
        jsPDF: { unit: "mm", format: "letter", orientation: "portrait" },
      })
      .from(htmlRoot)
      .save();
  } finally {
    frame.remove();
  }
};

const buildReceiptHtml = async (receipt: POSReceipt, format: ReceiptFormat) => {
  const qrDataUrl = await buildVerificationQrDataUrl(receipt.verificationUrl);
  return renderReceiptHtml(receipt, format, qrDataUrl);
};

export const printReceiptByFormat = (receipt: POSReceipt, format: ReceiptFormat) => {
  void (async () => {
    const html = await buildReceiptHtml(receipt, format);
    openPrintWindow(html);
  })();
};

export const downloadReceiptPdf = async (receipt: POSReceipt) => {
  const html = await buildReceiptHtml(receipt, "half_letter");
  const filename = `recibo-${receipt.invoiceNumber}.pdf`;

  try {
    await buildPdfFromHtml(html, filename);
    return;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  try {
    await buildPdfFromHtml(html, filename);
  } catch {
    openPrintWindow(html);
    throw new Error("No se pudo descargar el PDF. Se abrio la vista de impresion como respaldo.");
  }
};
