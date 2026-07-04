import { readValidatedPOSBody } from "../../../utils/pos";
import { createSalesOrderSchema } from "../../../utils/pos-sales";
import { createSalesOrder } from "../../../services/pos/sales-orders";

export default defineEventHandler(async (event) => {
  const body = await readValidatedPOSBody(event, createSalesOrderSchema);
  return createSalesOrder(event, body);
});
