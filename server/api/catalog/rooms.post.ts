import {
  assertCatalogEntityAccess,
  requireCatalogContext,
  readValidatedCatalogBody,
  roomSchema,
} from "../../utils/catalog";
import { createCatalogRoom } from "../../services/catalog/rooms";

export default defineEventHandler(async (event) => {
  const context = await requireCatalogContext(event);
  await assertCatalogEntityAccess(context, "lodging", "can_create");
  const body = await readValidatedCatalogBody(event, roomSchema);
  const roomId = await createCatalogRoom(context, body);
  return { success: true, roomId };
});
