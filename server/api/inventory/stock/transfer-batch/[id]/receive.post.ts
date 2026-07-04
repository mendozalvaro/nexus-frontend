import { getRouterParam } from "h3";

import { receiveInventoryTransferBatch } from "../../../../../services/inventory/transfer-cancel";
import {
  assertInventoryModuleAccess,
} from "../../../../../utils/inventory";
import { requireInventoryContextStrict } from "../../../../../utils/inventory-access";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContextStrict(event, "can_edit");
  await assertInventoryModuleAccess(context, "can_edit");

  const batchId = getRouterParam(event, "id");
  if (!batchId) {
    throw createError({
      statusCode: 400,
      statusMessage: "El lote de transferencia no es válido.",
    });
  }

  return await receiveInventoryTransferBatch(context, batchId);
});

