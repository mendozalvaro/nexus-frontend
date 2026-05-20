import { createError } from "h3";
import { z } from "zod";

import { requireCatalogContext } from "../../utils/catalog";
import { getCatalogProducts, type CatalogProduct } from "../../services/catalog/products";
import { getCatalogServices, type CatalogService } from "../../services/catalog/services";
import { getCatalogCategories, type CatalogCategory } from "../../services/catalog/categories";

const escapeCsvValue = (value: unknown): string => {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const buildCsv = (headers: string[], rows: unknown[][]): string => {
  const headerRow = headers.map(escapeCsvValue).join(",");
  const dataRows = rows.map((row) => row.map(escapeCsvValue).join(","));
  return [headerRow, ...dataRows].join("\n");
};

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const parsedType = z.enum(["all", "categories", "products", "services"]).safeParse(
    String(query.type ?? "all"),
  );
  if (!parsedType.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Parametro 'type' invalido.",
    });
  }
  const type = parsedType.data;

  const context = await requireCatalogContext(event);
  const csvParts: string[] = [];

  if (type === "categories" || type === "all") {
    const categories = await getCatalogCategories(context);
    const headers = ["name", "type", "parent_name", "is_active"];
    const rows = categories.map((c: CatalogCategory) => [c.name, c.type, c.parentName ?? "", c.isActive ? "true" : "false"]);
    csvParts.push(`[Categorias]\n${buildCsv(headers, rows)}`);
  }

  if (type === "products" || type === "all") {
    const products = await getCatalogProducts(context);
    const headers = ["name", "sku", "cost_price", "sale_price", "track_inventory", "description", "is_active"];
    const rows = products.map((p: CatalogProduct) => [
      p.name,
      p.sku ?? "",
      p.costPrice,
      p.salePrice,
      p.trackInventory ? "true" : "false",
      p.description ?? "",
      p.isActive ? "true" : "false",
    ]);
    csvParts.push(`[Productos]\n${buildCsv(headers, rows)}`);
  }

  if (type === "services" || type === "all") {
    const services = await getCatalogServices(context);
    const headers = ["name", "price", "duration_minutes", "description", "is_active"];
    const rows = services.map((s: CatalogService) => [
      s.name,
      s.price,
      s.durationMinutes,
      s.description ?? "",
      s.isActive ? "true" : "false",
    ]);
    csvParts.push(`[Servicios]\n${buildCsv(headers, rows)}`);
  }

  const csvContent = csvParts.join("\n\n");
  const fileName = `catalogo_${type}_${new Date().toISOString().slice(0, 10)}.csv`;

  setHeader(event, "Content-Type", "text/csv; charset=utf-8");
  setHeader(event, "Content-Disposition", `attachment; filename="${fileName}"`);

  return csvContent;
});
