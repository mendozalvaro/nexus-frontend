import { checkoutSchema, readValidatedPOSBody, requirePOSContextStrict } from "../../utils/pos";

import { processPOSCheckout } from "../../services/pos/checkout";

export default defineEventHandler(async (event) => {
  const context = await requirePOSContextStrict(event, "can_create");
  const body = await readValidatedPOSBody(event, checkoutSchema);

  return processPOSCheckout(context, body);
});
