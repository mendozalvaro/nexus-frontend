import { readValidatedPOSBody } from "../../utils/pos";
import { chargeSalesOrderSchema } from "../../utils/pos-sales";
import { chargeSalesOrder } from "../../services/pos/charge";

export default defineEventHandler(async (event) => {
  const body = await readValidatedPOSBody(event, chargeSalesOrderSchema);
  return chargeSalesOrder(event, body);
});
