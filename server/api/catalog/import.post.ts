import { z } from "zod";

import {
  assertCatalogCategoryAccess,
  assertCatalogEntityAccess,
  requireCatalogContext,
} from "../../utils/catalog";
import { previewImport, executeImport } from "../../services/catalog/import";

const importSchema = z.object({
  entityType: z.enum(["categories", "products", "services"]),
  rows: z
    .array(z.record(z.string(), z.unknown()))
    .min(1, "Se requiere al menos una fila.")
    .max(1000, "Solo se permiten hasta 1000 filas por importacion."),
  duplicateStrategy: z.enum(["upsert", "skip"]).default("skip"),
  mode: z.enum(["preview", "execute"]).default("preview"),
});

export default defineEventHandler(async (event) => {
  const context = await requireCatalogContext(event);
  const body = await readBody(event);

  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Payload invalido.",
    });
  }

  const { entityType, rows, duplicateStrategy, mode } = parsed.data;

  if (entityType === "products") {
    await assertCatalogEntityAccess(context, "product", "can_edit");
  } else if (entityType === "services") {
    await assertCatalogEntityAccess(context, "service", "can_edit");
  } else {
    const categoryTypes = new Set(
      rows
        .map((row) => typeof row.type === "string" ? row.type : null)
        .filter((value): value is "product" | "service" | "lodging" =>
          value === "product" || value === "service" || value === "lodging"),
    );

    if (categoryTypes.size === 0) {
      await assertCatalogCategoryAccess(context, "product", "can_edit");
      await assertCatalogCategoryAccess(context, "service", "can_edit");
    } else {
      for (const categoryType of categoryTypes) {
        await assertCatalogCategoryAccess(context, categoryType, "can_edit");
      }
    }
  }

  if (mode === "preview") {
    const preview = await previewImport(context, entityType, rows);
    return { preview };
  }

  const result = await executeImport(context, entityType, rows, duplicateStrategy);
  return { result };
});
