import { getRouterParam } from "h3";
import { getSalesOrderById } from "../../../services/pos/sales-orders";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Debes indicar la orden de venta." });
  }
  return getSalesOrderById(event, id);
});
