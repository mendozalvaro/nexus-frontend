import { assertCatalogEntityAccess, requireCatalogContext } from "../../utils/catalog";
import { getCatalogRooms } from "../../services/catalog/rooms";

export default defineEventHandler(async (event) => {
  const context = await requireCatalogContext(event);
  await assertCatalogEntityAccess(context, "lodging", "can_view");
  const query = getQuery(event);
  const filters = {
    branchId: query.branchId as string | undefined,
    status: query.status as string | undefined,
    availableOnly: query.availableOnly === "true",
    checkIn: query.checkIn as string | undefined,
    checkOut: query.checkOut as string | undefined,
  };
  const rooms = await getCatalogRooms(context, filters);
  return rooms;
});
