import { getRouterParam } from "h3";

import { cancelInventoryTransfer } from "../../../../../services/inventory/transfer-cancel";
import {
  assertInventoryModuleAccess,
  requireInventoryContext,
} from "../../../../../utils/inventory";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContext(event);
  await assertInventoryModuleAccess(context, "can_edit");

  const transferId = getRouterParam(event, "id");
  if (!transferId) {
    throw createError({
      statusCode: 400,
      statusMessage: "La transferencia no es valida.",
    });
  }
  return await cancelInventoryTransfer(context, transferId);
});
