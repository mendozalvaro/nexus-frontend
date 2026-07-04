import { assertCatalogEntityAccess, requireCatalogContext } from "../../../utils/catalog";
import { getCatalogRooms } from "../../../services/catalog/rooms";

export default defineEventHandler(async (event) => {
  const context = await requireCatalogContext(event);
  await assertCatalogEntityAccess(context, "lodging", "can_view");
  const query = getQuery(event);

  const checkIn = query.checkIn as string;
  const checkOut = query.checkOut as string;
  const branchId = query.branchId as string | undefined;

  if (!checkIn || !checkOut) {
    throw createError({ statusCode: 400, statusMessage: "checkIn y checkOut son requeridos." });
  }

  const rooms = await getCatalogRooms(context, {
    branchId,
    availableOnly: true,
    checkIn,
    checkOut,
  });

  return rooms;
});
