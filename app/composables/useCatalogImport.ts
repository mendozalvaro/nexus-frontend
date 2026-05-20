import * as XLSX from "xlsx";

export type ImportEntityType = "categories" | "products" | "services";
export type DuplicateStrategy = "upsert" | "skip";
export type ImportStep = "select" | "upload" | "preview" | "summary";

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

export interface ImportPreviewResult {
  validRows: number;
  invalidRows: number;
  duplicates: ImportDuplicateInfo[];
  validationErrors: ImportValidationError[];
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: ImportValidationError[];
}

export interface ParsedImportData {
  headers: string[];
  rows: Record<string, unknown>[];
  rawRows: unknown[][];
}

export interface ImportSummary {
  result: ImportResult;
  entityType: ImportEntityType;
  totalRows: number;
}

const TEMPLATE_COLUMNS: Record<ImportEntityType, string[]> = {
  categories: ["name", "type", "parent_name"],
  products: ["name", "sku", "cost_price", "sale_price", "category_name", "track_inventory", "description"],
  services: ["name", "price", "duration_minutes", "category_name", "description"],
};

const TEMPLATE_SAMPLE_DATA: Record<ImportEntityType, Record<string, unknown>[]> = {
  categories: [
    { name: "Bebidas", type: "product", parent_name: "" },
    { name: "Cortes de cabello", type: "service", parent_name: "" },
  ],
  products: [
    { name: "Coca Cola 600ml", sku: "COC-600", cost_price: 8, sale_price: 15, category_name: "Bebidas", track_inventory: true, description: "Refresco 600ml" },
    { name: "Agua Mineral 1L", sku: "AGU-1000", cost_price: 3, sale_price: 7, category_name: "Bebidas", track_inventory: true, description: "" },
  ],
  services: [
    { name: "Corte clasico", price: 50, duration_minutes: 30, category_name: "Cortes de cabello", description: "Corte de cabello clasico" },
    { name: "Barba completa", price: 30, duration_minutes: 20, category_name: "", description: "Afeitado y arreglo de barba" },
  ],
};

export const useCatalogImport = () => {
  const step = ref<ImportStep>("select");
  const entityType = ref<ImportEntityType>("products");
  const duplicateStrategy = ref<DuplicateStrategy>("skip");
  const parsedData = ref<ParsedImportData | null>(null);
  const previewResult = ref<ImportPreviewResult | null>(null);
  const importSummary = ref<ImportSummary | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const downloadTemplate = (type: ImportEntityType) => {
    const columns = TEMPLATE_COLUMNS[type];
    const sampleData = TEMPLATE_SAMPLE_DATA[type];

    const ws = XLSX.utils.json_to_sheet(sampleData, { header: columns });

    const colWidths = columns.map((col) => ({
      wch: Math.max(col.length + 2, 15),
    }));
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");

    XLSX.writeFile(wb, `plantilla_${type}.xlsx`);
  };

  const parseExcel = (file: File): Promise<ParsedImportData> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });

          const firstSheet = workbook.SheetNames[0];
          if (!firstSheet) {
            reject(new Error("El archivo no contiene hojas."));
            return;
          }

          const worksheet = workbook.Sheets[firstSheet]!;
          const rawRows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as unknown[][];

          if (rawRows.length < 2) {
            reject(new Error("El archivo debe tener al menos una fila de encabezados y una fila de datos."));
            return;
          }

          const headers = (rawRows[0] as string[]).map((h) => String(h).trim().toLowerCase());
          const rows: Record<string, unknown>[] = [];

          for (let i = 1; i < rawRows.length; i++) {
            const row = rawRows[i] as unknown[];
            if (row.every((cell) => cell === "" || cell === null || cell === undefined)) continue;

            const record: Record<string, unknown> = {};
            headers.forEach((header, idx) => {
              record[header] = row[idx] ?? "";
            });
            rows.push(record);
          }

          if (rows.length === 0) {
            reject(new Error("No se encontraron filas de datos en el archivo."));
            return;
          }

          resolve({ headers, rows, rawRows });
        } catch {
          reject(new Error("No se pudo leer el archivo Excel. Verifica el formato."));
        }
      };

      reader.onerror = () => reject(new Error("Error al leer el archivo."));
      reader.readAsArrayBuffer(file);
    });
  };

  const requestPreview = async () => {
    if (!parsedData.value) {
      error.value = "No hay datos para previsualizar.";
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{ preview: ImportPreviewResult }>("/api/catalog/import", {
        method: "POST",
        body: {
          entityType: entityType.value,
          rows: parsedData.value.rows,
          duplicateStrategy: duplicateStrategy.value,
          mode: "preview",
        },
      });

      previewResult.value = response.preview;
      step.value = "preview";
    } catch (e) {
      error.value = e instanceof Error ? e.message : "No se pudo obtener la previsualizacion.";
    } finally {
      loading.value = false;
    }
  };

  const executeImport = async () => {
    if (!parsedData.value) {
      error.value = "No hay datos para importar.";
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{ result: ImportResult }>("/api/catalog/import", {
        method: "POST",
        body: {
          entityType: entityType.value,
          rows: parsedData.value.rows,
          duplicateStrategy: duplicateStrategy.value,
          mode: "execute",
        },
      });

      importSummary.value = {
        result: response.result,
        entityType: entityType.value,
        totalRows: parsedData.value.rows.length,
      };
      step.value = "summary";
    } catch (e) {
      error.value = e instanceof Error ? e.message : "No se pudo completar la importacion.";
    } finally {
      loading.value = false;
    }
  };

  const reset = () => {
    step.value = "select";
    entityType.value = "products";
    duplicateStrategy.value = "skip";
    parsedData.value = null;
    previewResult.value = null;
    importSummary.value = null;
    loading.value = false;
    error.value = null;
  };

  return {
    step,
    entityType,
    duplicateStrategy,
    parsedData,
    previewResult,
    importSummary,
    loading,
    error,
    downloadTemplate,
    parseExcel,
    requestPreview,
    executeImport,
    reset,
  };
};
