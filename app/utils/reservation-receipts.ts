export const normalizeReservationReceiptBase = (receiptNumber?: string | null) => {
  const normalized = receiptNumber?.trim();
  if (!normalized) {
    return null;
  }

  return normalized.replace(/\/\d{2}$/, "");
};

export const formatReservationReceiptNumber = (
  baseNumber?: string | null,
  receiptKind?: "partial" | "final" | null,
  partialIndex?: number | null,
) => {
  const normalizedBase = normalizeReservationReceiptBase(baseNumber);
  if (!normalizedBase) {
    return null;
  }

  if (receiptKind !== "partial") {
    return normalizedBase;
  }

  const normalizedIndex = Math.max(1, partialIndex ?? 1);
  return `${normalizedBase}/${String(normalizedIndex).padStart(2, "0")}`;
};
