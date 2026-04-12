import { getRouterParam } from "h3";

import {
  buildReceiptFromTransaction,
  requirePOSContext,
} from "../../../utils/pos";

export default defineEventHandler(async (event) => {
  const context = await requirePOSContext(event);
  const transactionId = getRouterParam(event, "id");

  if (!transactionId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debes indicar la transacción a reimprimir.",
    });
  }

  const receipt = await buildReceiptFromTransaction(context, transactionId);

  return {
    receipt,
  };
});
