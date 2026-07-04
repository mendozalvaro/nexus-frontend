import {
  assertCatalogEntityAccess,
  requireCatalogContext,
  getRoomOrThrow,
} from "../../../utils/catalog";
import { deleteCatalogRoom } from "../../../services/catalog/rooms";

export default defineEventHandler(async (event) => {
  const roomId = getRouterParam(event, "id");
  if (!roomId) throw createError({ statusCode: 400, statusMessage: "ID de habitacion requerido." });

  const context = await requireCatalogContext(event);
  await assertCatalogEntityAccess(context, "lodging", "can_edit");
  await getRoomOrThrow(context, roomId);
  await deleteCatalogRoom(context, roomId);

  return { success: true, roomId };
});
