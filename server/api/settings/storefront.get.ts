import { setCacheHeaders } from "../../utils/cache";
import { requireStaffTenantContext } from "../../utils/tenant-context";
import { getStorefrontSettings } from "../../services/storefront-settings";

export default defineEventHandler(async (event) => {
  const context = await requireStaffTenantContext(event);
  const response = await getStorefrontSettings(context);
  setCacheHeaders(event, { sMaxAge: 0, staleWhileRevalidate: 0, visibility: "private" });
  return response;
});
