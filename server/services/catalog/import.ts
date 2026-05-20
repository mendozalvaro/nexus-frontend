import type { TenantContext } from "../../utils/tenant-context";

export type ImportEntityType = "categories" | "products" | "services";
export type DuplicateStrategy = "upsert" | "skip";

export interface ImportRow<T = Record<string, unknown>> {
  data: T;
  rowIndex: number;
}

export interface ImportValidationError {
  rowIndex: number;
  field: string;
  message: string;
}

export interface ImportDuplicateInfo {
  rowIndex: number;
  identifier: string;
  existingId: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: ImportValidationError[];
}

export interface ImportPreviewResult {
  validRows: number;
  invalidRows: number;
  duplicates: ImportDuplicateInfo[];
  validationErrors: ImportValidationError[];
}

const parseNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const parseBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value.toLowerCase() === "true" || value === "1" || value === "yes";
  }
  if (typeof value === "number") return value !== 0;
  return false;
};

const sanitizeText = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  return String(value ?? "").trim();
};

const normalizeKey = (value: string): string => sanitizeText(value).toLowerCase();

const validateCategoryRow = (
  row: Record<string, unknown>,
  index: number,
  existingCategories: Map<string, string>,
): { errors: ImportValidationError[]; duplicates: ImportDuplicateInfo[] } => {
  const errors: ImportValidationError[] = [];
  const duplicates: ImportDuplicateInfo[] = [];

  const name = sanitizeText(row.name);
  const type = sanitizeText(row.type).toLowerCase();

  if (!name) {
    errors.push({ rowIndex: index, field: "name", message: "El nombre es obligatorio." });
  }

  if (type !== "product" && type !== "service") {
    errors.push({ rowIndex: index, field: "type", message: "El tipo debe ser 'product' o 'service'." });
  }

  if (name && type) {
    const key = `${normalizeKey(name)}:${type}`;
    if (existingCategories.has(key)) {
      duplicates.push({
        rowIndex: index,
        identifier: name,
        existingId: existingCategories.get(key)!,
      });
    }
  }

  return { errors, duplicates };
};

const validateProductRow = (
  row: Record<string, unknown>,
  index: number,
  existingSkus: Map<string, string>,
  existingNames: Map<string, string>,
): { errors: ImportValidationError[]; duplicates: ImportDuplicateInfo[] } => {
  const errors: ImportValidationError[] = [];
  const duplicates: ImportDuplicateInfo[] = [];

  const name = sanitizeText(row.name);
  const sku = sanitizeText(row.sku);
  const salePrice = parseNumber(row.sale_price ?? row.salePrice);
  const costPrice = parseNumber(row.cost_price ?? row.costPrice);

  if (!name) {
    errors.push({ rowIndex: index, field: "name", message: "El nombre es obligatorio." });
  }

  if (salePrice === null) {
    errors.push({ rowIndex: index, field: "sale_price", message: "El precio de venta es obligatorio y debe ser un numero." });
  } else if (salePrice < 0) {
    errors.push({ rowIndex: index, field: "sale_price", message: "El precio de venta no puede ser negativo." });
  }

  if (costPrice !== null && costPrice < 0) {
    errors.push({ rowIndex: index, field: "cost_price", message: "El precio de costo no puede ser negativo." });
  }

  if (costPrice !== null && salePrice !== null && costPrice > salePrice) {
    errors.push({ rowIndex: index, field: "cost_price", message: "El precio de costo no puede ser mayor al precio de venta." });
  }

  if (sku && existingSkus.has(sku)) {
    duplicates.push({ rowIndex: index, identifier: sku, existingId: existingSkus.get(sku)! });
  }

  if (name && !sku && existingNames.has(name)) {
    duplicates.push({ rowIndex: index, identifier: name, existingId: existingNames.get(name)! });
  }

  return { errors, duplicates };
};

const validateServiceRow = (
  row: Record<string, unknown>,
  index: number,
  existingNames: Map<string, string>,
): { errors: ImportValidationError[]; duplicates: ImportDuplicateInfo[] } => {
  const errors: ImportValidationError[] = [];
  const duplicates: ImportDuplicateInfo[] = [];

  const name = sanitizeText(row.name);
  const price = parseNumber(row.price);
  const duration = parseNumber(row.duration_minutes ?? row.durationMinutes);

  if (!name) {
    errors.push({ rowIndex: index, field: "name", message: "El nombre es obligatorio." });
  }

  if (price === null) {
    errors.push({ rowIndex: index, field: "price", message: "El precio es obligatorio y debe ser un numero." });
  } else if (price < 0) {
    errors.push({ rowIndex: index, field: "price", message: "El precio no puede ser negativo." });
  }

  if (duration === null) {
    errors.push({ rowIndex: index, field: "duration_minutes", message: "La duracion es obligatoria y debe ser un numero." });
  } else if (duration < 5) {
    errors.push({ rowIndex: index, field: "duration_minutes", message: "La duracion minima es de 5 minutos." });
  }

  if (name && existingNames.has(name)) {
    duplicates.push({ rowIndex: index, identifier: name, existingId: existingNames.get(name)! });
  }

  return { errors, duplicates };
};

export const previewImport = async (
  context: TenantContext,
  entityType: ImportEntityType,
  rows: Record<string, unknown>[],
): Promise<ImportPreviewResult> => {
  const allErrors: ImportValidationError[] = [];
  const allDuplicates: ImportDuplicateInfo[] = [];

  if (entityType === "categories") {
    const { data: existing } = await context.adminClient
      .from("categories")
      .select("id, name, type")
      .eq("organization_id", context.organizationId);

    const existingMap = new Map<string, string>();
    for (const cat of existing ?? []) {
      existingMap.set(`${normalizeKey(cat.name)}:${cat.type}`, cat.id);
    }

    for (let i = 0; i < rows.length; i++) {
      const { errors, duplicates } = validateCategoryRow(rows[i]!, i + 2, existingMap);
      allErrors.push(...errors);
      allDuplicates.push(...duplicates);
    }
  }

  if (entityType === "products") {
    const { data: existing } = await context.adminClient
      .from("products")
      .select("id, name, sku")
      .eq("organization_id", context.organizationId);

    const skuMap = new Map<string, string>();
    const nameMap = new Map<string, string>();
    for (const p of existing ?? []) {
      if (p.sku) skuMap.set(p.sku, p.id);
      nameMap.set(p.name, p.id);
    }

    for (let i = 0; i < rows.length; i++) {
      const { errors, duplicates } = validateProductRow(rows[i]!, i + 2, skuMap, nameMap);
      allErrors.push(...errors);
      allDuplicates.push(...duplicates);
    }
  }

  if (entityType === "services") {
    const { data: existing } = await context.adminClient
      .from("services")
      .select("id, name")
      .eq("organization_id", context.organizationId);

    const nameMap = new Map<string, string>();
    for (const s of existing ?? []) {
      nameMap.set(s.name, s.id);
    }

    for (let i = 0; i < rows.length; i++) {
      const { errors, duplicates } = validateServiceRow(rows[i]!, i + 2, nameMap);
      allErrors.push(...errors);
      allDuplicates.push(...duplicates);
    }
  }

  const duplicateRowIndices = new Set(allDuplicates.map((d) => d.rowIndex));
  const invalidRowIndices = new Set(allErrors.map((e) => e.rowIndex));
  const excludedRows = new Set([...duplicateRowIndices, ...invalidRowIndices]);

  return {
    validRows: rows.length - excludedRows.size,
    invalidRows: invalidRowIndices.size,
    duplicates: allDuplicates,
    validationErrors: allErrors,
  };
};

export const executeImport = async (
  context: TenantContext,
  entityType: ImportEntityType,
  rows: Record<string, unknown>[],
  duplicateStrategy: DuplicateStrategy,
): Promise<ImportResult> => {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  if (entityType === "categories") {
    const { data: existing } = await context.adminClient
      .from("categories")
      .select("id, name, type")
      .eq("organization_id", context.organizationId);

    const existingMap = new Map<string, { id: string; name: string; type: string }>();
    for (const cat of existing ?? []) {
      existingMap.set(`${cat.name.toLowerCase()}:${cat.type}`, cat);
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const name = sanitizeText(row.name);
      const type = sanitizeText(row.type).toLowerCase() as "product" | "service";
      const parentName = sanitizeText(row.parent_name ?? row.parentName);

      if (!name || (type !== "product" && type !== "service")) {
        result.errors.push({
          rowIndex: i + 2,
          field: name ? "type" : "name",
          message: name ? "Tipo invalido." : "Nombre obligatorio.",
        });
        continue;
      }

      const key = `${normalizeKey(name)}:${type}`;
      const existing = existingMap.get(key);

      if (existing) {
        if (duplicateStrategy === "skip") {
          result.skipped++;
          continue;
        }

        let parentId: string | null = null;
        if (parentName) {
          const { data: parentCat } = await context.adminClient
            .from("categories")
            .select("id")
            .eq("organization_id", context.organizationId)
            .eq("name", parentName)
            .eq("type", type)
            .maybeSingle();
          parentId = parentCat?.id ?? null;
        }

        const { error } = await context.adminClient
          .from("categories")
          .update({ name, type, parent_id: parentId })
          .eq("id", existing.id);

        if (error) {
          result.errors.push({ rowIndex: i + 2, field: "name", message: error.message });
        } else {
          result.updated++;
        }
      } else {
        let parentId: string | null = null;
        if (parentName) {
          const { data: parentCat } = await context.adminClient
            .from("categories")
            .select("id")
            .eq("organization_id", context.organizationId)
            .eq("name", parentName)
            .eq("type", type)
            .maybeSingle();
          parentId = parentCat?.id ?? null;
        }

        const { data: insertedCategory, error } = await context.adminClient
          .from("categories")
          .insert({
            organization_id: context.organizationId,
            name,
            type,
            parent_id: parentId,
          })
          .select("id")
          .maybeSingle<{ id: string }>();

        if (error) {
          result.errors.push({ rowIndex: i + 2, field: "name", message: error.message });
        } else {
          result.created++;
          if (insertedCategory?.id) {
            existingMap.set(key, { id: insertedCategory.id, name, type });
          }
        }
      }
    }
  }

  if (entityType === "products") {
    const { data: existingProducts } = await context.adminClient
      .from("products")
      .select("id, name, sku")
      .eq("organization_id", context.organizationId);

    const { data: categories } = await context.adminClient
      .from("categories")
      .select("id, name")
      .eq("organization_id", context.organizationId)
      .eq("type", "product");

    const skuMap = new Map<string, string>();
    const nameMap = new Map<string, string>();
    const catMap = new Map<string, string>();

    for (const p of existingProducts ?? []) {
      if (p.sku) skuMap.set(p.sku, p.id);
      nameMap.set(p.name, p.id);
    }
    for (const c of categories ?? []) {
      catMap.set(c.name.toLowerCase(), c.id);
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const name = sanitizeText(row.name);
      const sku = sanitizeText(row.sku);
      const salePrice = parseNumber(row.sale_price ?? row.salePrice);
      const costPrice = parseNumber(row.cost_price ?? row.costPrice) ?? 0;
      const description = sanitizeText(row.description);
      const categoryName = sanitizeText(row.category_name ?? row.categoryName);
      const trackInventory = parseBoolean(row.track_inventory ?? row.trackInventory);

      if (!name || salePrice === null) {
        result.errors.push({
          rowIndex: i + 2,
          field: name ? "sale_price" : "name",
          message: name ? "Precio de venta obligatorio." : "Nombre obligatorio.",
        });
        continue;
      }

      let categoryId: string | null = null;
      if (categoryName) {
        categoryId = catMap.get(categoryName.toLowerCase()) ?? null;
      }

      const existingId = sku ? skuMap.get(sku) : (name ? nameMap.get(name) : null);

      if (existingId) {
        if (duplicateStrategy === "skip") {
          result.skipped++;
          continue;
        }

        const { error } = await context.adminClient
          .from("products")
          .update({
            name,
            sku: sku || null,
            description: description || null,
            cost_price: costPrice,
            sale_price: salePrice,
            category_id: categoryId,
            track_inventory: trackInventory,
          })
          .eq("id", existingId);

        if (error) {
          result.errors.push({ rowIndex: i + 2, field: "name", message: error.message });
        } else {
          result.updated++;
        }
      } else {
        const { data: insertedProduct, error } = await context.adminClient
          .from("products")
          .insert({
            organization_id: context.organizationId,
            name,
            sku: sku || null,
            description: description || null,
            cost_price: costPrice,
            sale_price: salePrice,
            category_id: categoryId,
            track_inventory: trackInventory,
          })
          .select("id")
          .maybeSingle<{ id: string }>();

        if (error) {
          result.errors.push({ rowIndex: i + 2, field: "name", message: error.message });
        } else {
          result.created++;
          if (insertedProduct?.id) {
            if (sku) skuMap.set(sku, insertedProduct.id);
            nameMap.set(name, insertedProduct.id);
          }
        }
      }
    }
  }

  if (entityType === "services") {
    const { data: existingServices } = await context.adminClient
      .from("services")
      .select("id, name")
      .eq("organization_id", context.organizationId);

    const { data: categories } = await context.adminClient
      .from("categories")
      .select("id, name")
      .eq("organization_id", context.organizationId)
      .eq("type", "service");

    const nameMap = new Map<string, string>();
    const catMap = new Map<string, string>();

    for (const s of existingServices ?? []) {
      nameMap.set(s.name, s.id);
    }
    for (const c of categories ?? []) {
      catMap.set(c.name.toLowerCase(), c.id);
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const name = sanitizeText(row.name);
      const price = parseNumber(row.price);
      const duration = parseNumber(row.duration_minutes ?? row.durationMinutes);
      const description = sanitizeText(row.description);
      const categoryName = sanitizeText(row.category_name ?? row.categoryName);

      if (!name || price === null || duration === null) {
        result.errors.push({
          rowIndex: i + 2,
          field: !name ? "name" : (price === null ? "price" : "duration_minutes"),
          message: !name ? "Nombre obligatorio." : (price === null ? "Precio obligatorio." : "Duracion obligatoria."),
        });
        continue;
      }

      if (duration < 5) {
        result.errors.push({ rowIndex: i + 2, field: "duration_minutes", message: "Duracion minima de 5 minutos." });
        continue;
      }

      let categoryId: string | null = null;
      if (categoryName) {
        categoryId = catMap.get(categoryName.toLowerCase()) ?? null;
      }

      const existingId = nameMap.get(name);

      if (existingId) {
        if (duplicateStrategy === "skip") {
          result.skipped++;
          continue;
        }

        const { error } = await context.adminClient
          .from("services")
          .update({
            name,
            description: description || null,
            price,
            duration_minutes: duration,
            category_id: categoryId,
          })
          .eq("id", existingId);

        if (error) {
          result.errors.push({ rowIndex: i + 2, field: "name", message: error.message });
        } else {
          result.updated++;
        }
      } else {
        const { data: insertedService, error } = await context.adminClient
          .from("services")
          .insert({
            organization_id: context.organizationId,
            name,
            description: description || null,
            price,
            duration_minutes: duration,
            category_id: categoryId,
          })
          .select("id")
          .maybeSingle<{ id: string }>();

        if (error) {
          result.errors.push({ rowIndex: i + 2, field: "name", message: error.message });
        } else {
          result.created++;
          if (insertedService?.id) {
            nameMap.set(name, insertedService.id);
          }
        }
      }
    }
  }

  return result;
};
