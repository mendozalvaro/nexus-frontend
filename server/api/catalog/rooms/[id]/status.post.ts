import { z } from "zod";
import {
  assertCatalogEntityAccess,
  requireCatalogContext,
  readValidatedCatalogBody,
  getRoomOrThrow,
} from "../../../../utils/catalog";
import { updateCatalogRoomStatus } from "../../../../services/catalog/rooms";

export default defineEventHandler(async (event) => {
  const roomId = getRouterParam(event, "id");
  if (!roomId) throw createError({ statusCode: 400, statusMessage: "ID de habitacion requerido." });

  const context = await requireCatalogContext(event);
  await assertCatalogEntityAccess(context, "lodging", "can_edit");
  await getRoomOrThrow(context, roomId);

  const schema = z.object({ isActive: z.boolean() });
  const body = await readValidatedCatalogBody(event, schema);
  await updateCatalogRoomStatus(context, roomId, body.isActive);

  return { success: true, roomId };
});
