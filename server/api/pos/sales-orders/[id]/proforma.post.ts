import { getRouterParam } from "h3";
import { issueProforma } from "../../../../services/pos/proformas";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Debes indicar la orden de venta." });
  }
  return issueProforma(event, id);
});
