import {
  assertCatalogEntityAccess,
  requireCatalogContext,
  readValidatedCatalogBody,
  roomUpdateSchema,
  getRoomOrThrow,
} from "../../../utils/catalog";
import { updateCatalogRoom } from "../../../services/catalog/rooms";

export default defineEventHandler(async (event) => {
  const roomId = getRouterParam(event, "id");
  if (!roomId) throw createError({ statusCode: 400, statusMessage: "ID de habitacion requerido." });

  const context = await requireCatalogContext(event);
  await assertCatalogEntityAccess(context, "lodging", "can_edit");
  await getRoomOrThrow(context, roomId);
  const body = await readValidatedCatalogBody(event, roomUpdateSchema);
  await updateCatalogRoom(context, roomId, body);

  return { success: true, roomId };
});
