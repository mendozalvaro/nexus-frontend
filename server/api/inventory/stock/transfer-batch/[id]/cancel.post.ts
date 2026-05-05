import { getRouterParam } from "h3";

import { cancelInventoryTransferBatch } from "../../../../../services/inventory/transfer-cancel";
import {
  assertInventoryModuleAccess,
  requireInventoryContext,
} from "../../../../../utils/inventory";

export default defineEventHandler(async (event) => {
  const context = await requireInventoryContext(event);
  await assertInventoryModuleAccess(context, "can_edit");

  const batchId = getRouterParam(event, "id");
  if (!batchId) {
    throw createError({
      statusCode: 400,
      statusMessage: "El lote de transferencia no es valido.",
    });
  }
  return await cancelInventoryTransferBatch(context, batchId);
});
