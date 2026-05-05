import {} from './useInventory';

export const useUtilsInventory = () => {
  const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-BO", {
      style: "currency",
      currency: "BOB",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDateTime = (value: string | null, timeZone: string = localTimeZone) => {
    if (!value) {
      return "Sin registro";
    }

    return new Intl.DateTimeFormat("es-BO", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    }).format(new Date(value));
  };

  const getMovementLabel = (value: "entry" | "exit" | "adjustment" | "transfer_in" | "transfer_out"): string => {
    const labels: Record<string, string> = {
      entry: "Entrada",
      exit: "Salida",
      adjustment: "Ajuste",
      transfer_in: "Transferencia entrada",
      transfer_out: "Transferencia salida",
    };
    return labels[value] || value;
  };

  const getMovementColor = (value: "entry" | "exit" | "adjustment" | "transfer_in" | "transfer_out"): "success" | "warning" | "error" | "primary" | "neutral" => {
    const colors: Record<string, "success" | "warning" | "error" | "primary" | "neutral"> = {
      entry: "success",
      exit: "error",
      adjustment: "warning",
      transfer_in: "primary",
      transfer_out: "primary",
    };
    return colors[value] || "neutral";
  };

  const getStockTone = (quantity: number, minStock: number | null): "success" | "warning" | "error" => {
    if (minStock === null) return "success";
    if (quantity === 0) return "error";
    if (quantity <= minStock) return "warning";
    return "success";
  };

  const normalizeInventoryAdjustmentBatchPayload = (
    branchId: string,
    mode: "set" | "add" | "remove",
    lines: Array<{ productId: string; quantity: number }>,
    existingStock?: Map<string, { quantity: number; minStock: number | null }>
  ) => {
    const normalizedLines: Array<{
      productId: string;
      quantity: number;
      currentQuantity: number;
      minStockLevel: number | null;
    }> = [];
    const warnings: string[] = [];
    const seenProducts = new Set<string>();

    for (const line of lines) {
      if (seenProducts.has(line.productId)) {
        warnings.push(`Producto ${line.productId} duplicado en lineas`);
        continue;
      }
      seenProducts.add(line.productId);

      const stock = existingStock?.get(line.productId);
      const currentQty = stock?.quantity ?? 0;
      const minStock = stock?.minStock ?? null;

      normalizedLines.push({
        productId: line.productId,
        quantity: line.quantity,
        currentQuantity: currentQty,
        minStockLevel: minStock,
      });
    }

    return {
      normalized: {
        idempotencyKey: crypto.randomUUID(),
        branchId,
        mode,
        reason: "batch_adjustment",
        lines: normalizedLines,
      },
      warnings,
    };
  };

  const normalizeInventoryTransferBatchPayload = (
    sourceBranchId: string,
    destinationBranchId: string,
    lines: Array<{ productId: string; quantity: number }>,
    existingStock?: Map<string, number>
  ) => {
    const normalizedLines: Array<{
      productId: string;
      quantity: number;
      currentQuantity: number;
    }> = [];
    const warnings: string[] = [];
    const seenProducts = new Set<string>();

    for (const line of lines) {
      if (seenProducts.has(line.productId)) {
        warnings.push(`Producto ${line.productId} duplicado en lineas`);
        continue;
      }
      seenProducts.add(line.productId);

      const currentQty = existingStock?.get(line.productId) ?? 0;

      if (line.quantity > currentQty) {
        warnings.push(`Cantidad ${line.quantity} mayor que stock actual ${currentQty}`);
      }

      normalizedLines.push({
        productId: line.productId,
        quantity: line.quantity,
        currentQuantity: currentQty,
      });
    }

    return {
      normalized: {
        idempotencyKey: crypto.randomUUID(),
        sourceBranchId,
        destinationBranchId,
        lines: normalizedLines,
      },
      warnings,
    };
  };

  return {
    localTimeZone,
    formatCurrency,
    formatDateTime,
    getMovementLabel,
    getMovementColor,
    getStockTone,
    normalizeInventoryAdjustmentBatchPayload,
    normalizeInventoryTransferBatchPayload,
  };
};