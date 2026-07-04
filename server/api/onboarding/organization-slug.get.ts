import { throwApiError } from "../../utils/http-error";
import { requireStaffTenantContext } from "../../utils/tenant-context";
import { getOrganizationSlug } from "../../services/onboarding";

export default defineEventHandler(async (event) => {
  const context = await requireStaffTenantContext(event);
  const query = getQuery(event);
  const organizationId = typeof query.organizationId === "string" ? query.organizationId : context.organizationId;

  if (!organizationId) {
    throwApiError(403, "NO_ORGANIZATION", "No se encontro organizacion.");
  }

  const slug = await getOrganizationSlug(event, organizationId);
  return { slug };
});
