import { setCacheHeaders } from "../utils/cache";
import { requireTenantContext } from "../utils/tenant-context";
import { getTenantProfile, type TenantProfileData } from "../services/profile";

export default defineEventHandler(async (event) => {
  const context = await requireTenantContext(event);

  const profile = await getTenantProfile(event, context.userId);

  setCacheHeaders(event, { sMaxAge: 120, staleWhileRevalidate: 30, visibility: "private" });
  return profile as TenantProfileData;
});
