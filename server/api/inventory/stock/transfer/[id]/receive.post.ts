import { getRouterParam } from "h3";

import { receiveInventoryTransfer } from "../../../../../services/inventory/transfer-cancel";
import {
  assertInventoryModuleAccess,
} from "../../../../../utils/inventory";
import { requireInventoryContextStrict } from "../../../../../utils/inventory-access";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContextStrict(event, "can_edit");
  await assertInventoryModuleAccess(context, "can_edit");

  const transferId = getRouterParam(event, "id");
  if (!transferId) {
    throw createError({
      statusCode: 400,
      statusMessage: "La transferencia no es válida.",
    });
  }

  return await receiveInventoryTransfer(context, transferId);
});

