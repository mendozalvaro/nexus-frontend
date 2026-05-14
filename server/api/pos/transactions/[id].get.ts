import { getRouterParam } from "h3";

import { getPOSReceipt } from "../../../services/pos/transactions";

export default defineEventHandler(async (event) => {
  const transactionId = getRouterParam(event, "id");

  if (!transactionId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debes indicar la transaccion a reimprimir.",
    });
  }

  return getPOSReceipt(event, transactionId);
});
