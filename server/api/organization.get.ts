import { getOrganization } from "../services/organization";
import { setCacheHeaders } from "../utils/cache";
import { requireStaffTenantContext } from "../utils/tenant-context";

export default defineEventHandler(async (event) => {
  const context = await requireStaffTenantContext(event);
  const data = await getOrganization(context);

  setCacheHeaders(event, { sMaxAge: 300, staleWhileRevalidate: 60, visibility: "private" });
  return data;
});
