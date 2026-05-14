import { checkoutSchema, readValidatedPOSBody, requirePOSContext } from "../../utils/pos";

import { processPOSCheckout } from "../../services/pos/checkout";

export default defineEventHandler(async (event) => {
  const context = await requirePOSContext(event);
  const body = await readValidatedPOSBody(event, checkoutSchema);

  return processPOSCheckout(context, body);
});
