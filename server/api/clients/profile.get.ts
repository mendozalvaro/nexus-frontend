import { getClientProfile } from "../../services/clientProfile";
import { requireClientTenantContext } from "../../utils/tenant-context";

export default defineEventHandler(async (event) => {
  const context = await requireClientTenantContext(event);
  const profile = await getClientProfile(event, context.userId, context.organizationId);
  return { profile };
});
