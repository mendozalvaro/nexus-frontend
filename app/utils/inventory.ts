import { z } from "zod";

export interface InventoryBatchLine {
  productId: string;
  quantity: number;
  minStockLevel?: number | null;
}

export interface InventoryAdjustmentBatchLine extends InventoryBatchLine {
  currentQuantity: number;
  minStockLevel: number | null;
}

export interface InventoryBatchNormalization<TLine> {
  originalLines: number;
  normalizedLines: number;
  mergedProducts: number;
  lines: TLine[];
}

export interface InventoryBatchApiMeta<TLine> {
  normalization?: InventoryBatchNormalization<TLine>;
  warnings?: string[];
}

export interface InventoryBatchValidationError {
  lineIndex: number;
  productId: string | null;
  quantity: number;
  isValid: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  currentQuantity: number | null;
  nextQuantity: number | null;
}

const hasDefinedMinStock = (value: number | null | undefined): value is number =>
  value !== null && value !== undefined;

const buildBatchNormalizationWarnings = (
  originalLines: number,
  normalizedLines: number,
  mergedProducts: number,
): string[] => {
  if (mergedProducts <= 0 || normalizedLines >= originalLines) {
    return [];
  }

  return [
    `Se consolidaron ${originalLines - normalizedLines} línea(s) repetidas en ${mergedProducts} producto(s).`,
  ];
};

export const normalizeInventoryAdjustmentBatchLines = (
  mode: "set" | "add" | "remove",
  lines: InventoryBatchLine[],
): InventoryBatchNormalization<InventoryBatchLine> => {
  const normalizedMap = new Map<string, InventoryBatchLine>();
  const occurrences = new Map<string, number>();

  for (const line of lines) {
    occurrences.set(line.productId, (occurrences.get(line.productId) ?? 0) + 1);
    const existing = normalizedMap.get(line.productId);

    if (!existing) {
      normalizedMap.set(line.productId, {
        productId: line.productId,
        quantity: line.quantity,
        minStockLevel: line.minStockLevel ?? null,
      });
      continue;
    }

    if (mode === "set") {
      existing.quantity = line.quantity;
    } else {
      existing.quantity += line.quantity;
    }

    if (hasDefinedMinStock(line.minStockLevel)) {
      existing.minStockLevel = line.minStockLevel;
    }
  }

  const normalizedLines = Array.from(normalizedMap.values());
  const mergedProducts = Array.from(occurrences.values()).filter((count) => count > 1).length;

  return {
    originalLines: lines.length,
    normalizedLines: normalizedLines.length,
    mergedProducts,
    lines: normalizedLines,
  };
};

export interface InventoryTransferBatchLine {
  productId: string;
  quantity: number;
}

export const normalizeInventoryTransferBatchLines = (
  lines: InventoryTransferBatchLine[],
): InventoryBatchNormalization<InventoryTransferBatchLine> => {
  const normalizedMap = new Map<string, InventoryTransferBatchLine>();
  const occurrences = new Map<string, number>();

  for (const line of lines) {
    occurrences.set(line.productId, (occurrences.get(line.productId) ?? 0) + 1);
    const existing = normalizedMap.get(line.productId);

    if (!existing) {
      normalizedMap.set(line.productId, {
        productId: line.productId,
        quantity: line.quantity,
      });
      continue;
    }

    existing.quantity += line.quantity;
  }

  const normalizedLines = Array.from(normalizedMap.values());
  const mergedProducts = Array.from(occurrences.values()).filter((count) => count > 1).length;

  return {
    originalLines: lines.length,
    normalizedLines: normalizedLines.length,
    mergedProducts,
    lines: normalizedLines,
  };
};

export type InventoryAdjustmentBatchPayload = {
  idempotencyKey: string;
  branchId: string;
  mode: "set" | "add" | "remove";
  reason: string;
  referenceCode?: string;
  note?: string;
  lines: InventoryBatchLine[];
};

export type InventoryAdjustmentMode = "set" | "add" | "remove";

export interface InventoryMovementFormLine {
  id: string;
  productId: string;
  quantity: number;
  minStockLevel: number | null;
}

export interface InventoryMovementFormState {
  branchId: string;
  mode: InventoryAdjustmentMode;
  reason: string;
  referenceCode: string;
  lines: InventoryMovementFormLine[];
}

export interface InventoryMovementWarningState {
  active: boolean;
  message: string;
}

export interface InventoryTransferFormLine {
  id: string;
  productId: string;
  quantity: number;
}

export interface InventoryTransferFormState {
  sourceBranchId: string;
  destinationBranchId: string;
  observations: string;
  generatedCode: string;
  lines: InventoryTransferFormLine[];
}

export interface InventoryTransferWarningState {
  active: boolean;
  message: string;
}

export type InventoryTransferBatchPayload = {
  idempotencyKey: string;
  sourceBranchId: string;
  destinationBranchId: string;
  observations: string;
  referenceCode?: string;
  lines: InventoryTransferBatchLine[];
};

export const normalizeInventoryAdjustmentBatchPayload = (
  payload: InventoryAdjustmentBatchPayload,
): {
  payload: InventoryAdjustmentBatchPayload;
  normalization: InventoryBatchNormalization<InventoryBatchLine>;
  warnings: string[];
} => {
  const normalization = normalizeInventoryAdjustmentBatchLines(payload.mode, payload.lines);

  return {
    payload: {
      ...payload,
      lines: normalization.lines,
    },
    normalization,
    warnings: buildBatchNormalizationWarnings(
      normalization.originalLines,
      normalization.normalizedLines,
      normalization.mergedProducts,
    ),
  };
};

export const buildInventoryMovementSchema = (
  products: InventoryProductRowView[],
) =>
  z.object({
    branchId: z.string().trim().min(1, "Selecciona una sucursal."),
    mode: z.enum(["set", "add", "remove"] satisfies InventoryAdjustmentMode[]),
    reason: z.string().trim().min(3, "Ingresa un motivo para el movimiento."),
    referenceCode: z.string(),
    lines: z.array(z.object({
      id: z.string(),
      productId: z.string().trim().min(1, "Selecciona un producto."),
      quantity: z.coerce.number().int("La cantidad debe ser entera.").positive("La cantidad debe ser mayor a cero."),
      minStockLevel: z.union([z.number().int("El mínimo debe ser entero.").min(0, "El mínimo no puede ser negativo."), z.null()]),
    })).min(1, "Agrega al menos un producto al movimiento."),
  }).superRefine((value, context) => {
    const seenProducts = new Map<string, number>();

    value.lines.forEach((line, index) => {
      const product = products.find((item) => item.id === line.productId);

      if (!product) {
        context.addIssue({
          code: "custom",
          path: ["lines", index, "productId"],
          message: "Selecciona un producto válido.",
        });
        return;
      }

      const firstIndex = seenProducts.get(line.productId);
      if (firstIndex !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["lines", index, "productId"],
          message: "Este producto ya fue agregado en otra línea.",
        });
        return;
      }

      seenProducts.set(line.productId, index);

      if (value.mode !== "remove") {
        return;
      }

      const stockInfo = product.stockByBranch.find((stock) => stock.branchId === value.branchId) ?? null;
      if (stockInfo && line.quantity > stockInfo.quantity) {
        context.addIssue({
          code: "custom",
          path: ["lines", index, "quantity"],
          message: "La cantidad supera el stock disponible para esta sucursal.",
        });
      }
    });
  });

export const normalizeInventoryTransferBatchPayload = (
  payload: InventoryTransferBatchPayload,
): {
  payload: InventoryTransferBatchPayload;
  normalization: InventoryBatchNormalization<InventoryTransferBatchLine>;
  warnings: string[];
} => {
  const normalization = normalizeInventoryTransferBatchLines(payload.lines);

  return {
    payload: {
      ...payload,
      lines: normalization.lines,
    },
    normalization,
    warnings: buildBatchNormalizationWarnings(
      normalization.originalLines,
      normalization.normalizedLines,
      normalization.mergedProducts,
    ),
  };
};

export const buildInventoryTransferSchema = (
  products: InventoryProductRowView[],
) =>
  z.object({
    sourceBranchId: z.string().trim().min(1, "Selecciona la sucursal origen."),
    destinationBranchId: z.string().trim().min(1, "Selecciona la sucursal destino."),
    observations: z.string().trim().min(3, "Ingresa las observaciones de la transferencia."),
    generatedCode: z.string(),
    lines: z.array(z.object({
      id: z.string(),
      productId: z.string().trim().min(1, "Selecciona un producto."),
      quantity: z.coerce.number().int("La cantidad debe ser entera.").positive("La cantidad debe ser mayor a cero."),
    })).min(1, "Agrega al menos un producto a la transferencia."),
  }).superRefine((value, context) => {
    if (value.sourceBranchId && value.destinationBranchId && value.sourceBranchId === value.destinationBranchId) {
      context.addIssue({
        code: "custom",
        path: ["destinationBranchId"],
        message: "La sucursal destino debe ser distinta de la sucursal origen.",
      });
    }

    const seenProducts = new Map<string, number>();

    value.lines.forEach((line, index) => {
      const product = products.find((item) => item.id === line.productId);

      if (!product) {
        context.addIssue({
          code: "custom",
          path: ["lines", index, "productId"],
          message: "Selecciona un producto válido.",
        });
        return;
      }

      const firstIndex = seenProducts.get(line.productId);
      if (firstIndex !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["lines", index, "productId"],
          message: "Este producto ya fue agregado en otra línea.",
        });
        return;
      }

      seenProducts.set(line.productId, index);

      const stockInfo = product.stockByBranch.find((stock) => stock.branchId === value.sourceBranchId) ?? null;
      if (!stockInfo) {
        context.addIssue({
          code: "custom",
          path: ["lines", index, "productId"],
          message: "El producto no tiene stock configurado en la sucursal origen.",
        });
        return;
      }

      if (line.quantity > stockInfo.availableQuantity) {
        context.addIssue({
          code: "custom",
          path: ["lines", index, "quantity"],
          message: "La cantidad supera el stock disponible en la sucursal origen.",
        });
      }
    });
  });

export type MovementType = "entry" | "exit" | "adjustment" | "transfer_in" | "transfer_out";

export const movementLabels: Record<MovementType, string> = {
  adjustment: "Ajuste",
  entry: "Entrada",
  exit: "Salida",
  transfer_in: "Transferencia recibida",
  transfer_out: "Transferencia enviada",
};
// Additional types for inventory management
export type InventoryRole = "admin" | "manager";

export interface InventoryBranchOption {
  id: string;
  name: string;
  code: string;
  address: string | null;
  isActive: boolean;
}

export interface InventoryCategoryItem {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  isActive: boolean;
  productsCount: number;
}

export interface InventoryProductStockItem {
  stockId: string | null;
  branchId: string;
  branchName: string;
  branchCode: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minStockLevel: number;
  isLowStock: boolean;
  updatedAt: string | null;
}

export interface InventoryLowStockItem {
  productId: string;
  productName: string;
  sku: string | null;
  branchId: string;
  branchName: string;
  branchCode: string;
  quantity: number;
  minStockLevel: number;
  availableQuantity: number;
}

export interface InventoryOverviewMetrics {
  totalProducts: number;
  activeProducts: number;
  totalCategories: number;
  activeCategories: number;
  totalUnits: number;
  lowStockItems: number;
  movementsToday: number;
}

export interface InventoryProductsData {
  organizationId: string;
  role: InventoryRole;
  canTransferStock: boolean;
  branches: InventoryBranchOption[];
  categories: InventoryCategoryItem[];
  products: InventoryProductRowView[];
  lowStock: InventoryLowStockItem[];
  transferEnabled: boolean;
}

export interface InventoryAdjustmentsData {
  organizationId: string;
  role: InventoryRole;
  canTransferStock: boolean;
  branches: InventoryBranchOption[];
  destinationBranches: InventoryBranchOption[];
  products: InventoryProductRowView[];
  transfers: InventoryTransferRowView[];
  pendingInboundCount: number;
  transferEnabled: boolean;
}

export interface InventoryCategoryPayload {
  name: string;
  parentId: string | null;
}

export interface InventoryProductPayload {
  name: string;
  sku: string;
  description: string;
  costPrice: number;
  salePrice: number;
  categoryId: string | null;
  trackInventory: boolean;
}

export interface InventoryAdjustmentPayload {
  branchId: string;
  productId: string;
  mode: "set" | "add" | "remove";
  quantity: number;
  minStockLevel?: number | null;
  reason: string;
  note?: string;
}

export interface InventoryTransferPayload {
  sourceBranchId: string;
  destinationBranchId: string;
  productId: string;
  quantity: number;
  observations: string;
  referenceCode?: string;
}

export interface InventoryTransferFilters {
  branchId: string | null;
  productId: string | null;
  status: "all" | "pending" | "received" | "cancelled";
}

export interface InventoryTransferDetailLine {
  productId: string;
  productName: string;
  sku: string | null;
  quantity: number;
}

export interface InventoryProductRowView {
  id: string;
  organizationId: string;
  name: string;
  sku: string | null;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  costPrice: number;
  salePrice: number;
  trackInventory: boolean;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  stockByBranch: InventoryProductStockItem[];
  totalQuantity: number;
  totalReservedQuantity: number;
  totalAvailableQuantity: number;
  lowStockBranchesCount: number;
}

export interface InventoryMovementRowView {
  id: string;
  organizationId: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  productId: string;
  productName: string;
  sku: string | null;
  movementType: "entry" | "exit" | "adjustment" | "transfer_in" | "transfer_out";
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  referenceCode: string | null;
  reason: string | null;
  note: string | null;
  referenceType: string | null;
  referenceId: string | null;
  sourceBranchId: string | null;
  sourceBranchName: string | null;
  destinationBranchId: string | null;
  destinationBranchName: string | null;
  createdAt: string | null;
  createdBy: string | null;
  createdByName: string | null;
}

export interface InventoryTransferRowView {
  id: string;
  isBatch?: boolean;
  totalLines?: number;
  isBatchReceived?: boolean;
  organizationId: string;
  productId: string;
  productName: string;
  sku: string | null;
  sourceBranchId: string;
  sourceBranchName: string;
  sourceBranchCode: string;
  destinationBranchId: string;
  destinationBranchName: string;
  destinationBranchCode: string;
  quantity: number;
  status: "pending" | "received" | "cancelled";
  observations: string | null;
  referenceCode: string | null;
  requestedAt: string | null;
  requestedBy: string | null;
  requestedByName: string | null;
  receivedAt: string | null;
  receivedBy: string | null;
  receivedByName: string | null;
}

export interface InventoryTransferDetailData {
  id: string;
  isBatch: boolean;
  status: "pending" | "received" | "cancelled";
  referenceCode: string | null;
  observations: string | null;
  origin: {
    branchId: string;
    branchName: string;
    branchCode: string;
    userId: string | null;
    userName: string | null;
    date: string | null;
  };
  destination: {
    branchId: string;
    branchName: string;
    branchCode: string;
    userId: string | null;
    userName: string | null;
    date: string | null;
    pendingReception: boolean;
  };
  lines: InventoryTransferDetailLine[];
}

export interface InventoryHistoryData {
  organizationId: string;
  role: InventoryRole;
  canTransferStock: boolean;
  branches: InventoryBranchOption[];
  products: InventoryProductRowView[];
  movements: InventoryMovementRowView[];
}

export interface InventoryOverviewData {
  organizationId: string;
  role: InventoryRole;
  canTransferStock: boolean;
  branches: InventoryBranchOption[];
  categories: InventoryCategoryItem[];
  products: InventoryProductRowView[];
  lowStock: InventoryLowStockItem[];
  recentMovements: InventoryMovementRowView[];
  transferEnabled: boolean;
  metrics: InventoryOverviewMetrics;
}

export interface InventoryMovementFilters {
  branchId: string | null;
  productId: string | null;
  movementType: "entry" | "exit" | "adjustment" | "transfer_in" | "transfer_out" | "all";
  dateFrom: string | null;
  dateTo: string | null;
}

export const getInventoryProductById = (
  products: InventoryProductRowView[],
  productId: string,
): InventoryProductRowView | null => {
  return products.find((product) => product.id === productId) ?? null;
};

export const getInventoryLineStockInfo = (
  line: Pick<InventoryMovementFormLine, "productId" | "minStockLevel">,
  branchId: string,
  products: InventoryProductRowView[],
): InventoryProductStockItem | null => {
  const product = getInventoryProductById(products, line.productId);
  if (!product || !branchId) {
    return null;
  }

  return product.stockByBranch.find((stock) => stock.branchId === branchId) ?? null;
};

export const getInventoryCurrentQuantity = (
  line: Pick<InventoryMovementFormLine, "productId" | "minStockLevel">,
  branchId: string,
  products: InventoryProductRowView[],
): number => {
  return getInventoryLineStockInfo(line, branchId, products)?.quantity ?? -1;
};

export const getInventoryTransferCurrentQuantity = (
  line: Pick<InventoryTransferFormLine, "productId">,
  branchId: string,
  products: InventoryProductRowView[],
): number => {
  const product = getInventoryProductById(products, line.productId);
  if (!product || !branchId) {
    return -1;
  }

  return product.stockByBranch.find((stock) => stock.branchId === branchId)?.availableQuantity ?? -1;
};

export const getInventoryResolvedMinStockLevel = (
  line: Pick<InventoryMovementFormLine, "productId" | "minStockLevel">,
  branchId: string,
  products: InventoryProductRowView[],
): number => {
  const stockInfo = getInventoryLineStockInfo(line, branchId, products);
  return line.minStockLevel ?? stockInfo?.minStockLevel ?? 0;
};

export const getInventoryMovementWarning = (
  line: Pick<InventoryMovementFormLine, "productId" | "quantity" | "minStockLevel">,
  mode: InventoryAdjustmentMode,
  branchId: string,
  products: InventoryProductRowView[],
): InventoryMovementWarningState => {
  if (!line.productId) {
    return { active: false, message: "" };
  }

  const currentQuantity = getInventoryCurrentQuantity(line, branchId, products);
  if (currentQuantity === -1) {
    return { active: false, message: "" };
  }

  const minStockLevel = getInventoryResolvedMinStockLevel(line, branchId, products);

  if (mode === "set" && line.quantity < minStockLevel) {
    return { active: true, message: "Estás estableciendo la cantidad por debajo del nivel mínimo." };
  }

  if (mode === "add" && currentQuantity + line.quantity < minStockLevel) {
    return { active: true, message: "El resultado seguirá por debajo del nivel mínimo." };
  }

  return { active: false, message: "" };
};

export const getInventoryTransferWarning = (
  line: Pick<InventoryTransferFormLine, "productId" | "quantity">,
  branchId: string,
  products: InventoryProductRowView[],
): InventoryTransferWarningState => {
  if (!line.productId) {
    return { active: false, message: "" };
  }

  const product = getInventoryProductById(products, line.productId);
  if (!product || !branchId) {
    return { active: false, message: "" };
  }

  const stockInfo = product.stockByBranch.find((stock) => stock.branchId === branchId) ?? null;
  if (!stockInfo) {
    return { active: false, message: "" };
  }

  const remaining = stockInfo.availableQuantity - line.quantity;
  if (remaining < 0) {
    return { active: true, message: "La cantidad excede el stock disponible en origen." };
  }

  if (remaining === 0) {
    return { active: true, message: "Esta transferencia dejará el producto sin stock disponible en origen." };
  }

  if (remaining < stockInfo.minStockLevel) {
    return { active: true, message: "El stock restante quedará por debajo del mínimo configurado en origen." };
  }

  return { active: false, message: "" };
};

export const getMovementLabel = (movementType: MovementType): string => {
  return movementLabels[movementType];
};

export const getMovementColor = (movementType: MovementType): "success" | "warning" | "error" | "primary" | "neutral" => {
  switch (movementType) {
    case "entry":
    case "transfer_in":
      return "success";
    case "exit":
    case "transfer_out":
      return "warning";
    case "adjustment":
      return "primary";
    default:
      return "neutral";
  }
};

export const getStockTone = (quantity: number, minStockLevel: number): "success" | "warning" | "error" | "neutral" => {
  if (quantity <= 0) {
    return "error";
  }

  if (quantity <= minStockLevel) {
    return "warning";
  }

  return "success";
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
    minimumFractionDigits: 2,
  }).format(value);
};

export const formatDateTime = (value: string | null, timeZone?: string): string => {
  if (!value) {
    return "Sin registro";
  }

  return new Intl.DateTimeFormat("es-BO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  }).format(new Date(value));
};

export const getTodayLocalDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};


