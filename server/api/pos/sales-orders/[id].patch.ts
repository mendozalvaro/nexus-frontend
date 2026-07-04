import { getRouterParam } from "h3";
import { readValidatedPOSBody } from "../../../utils/pos";
import { updateSalesOrderSchema } from "../../../utils/pos-sales";
import { updateSalesOrder } from "../../../services/pos/sales-orders";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Debes indicar la orden de venta." });
  }
  const body = await readValidatedPOSBody(event, updateSalesOrderSchema);
  return updateSalesOrder(event, id, body);
});
