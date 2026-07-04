import { requireStaffTenantContext } from "../../utils/tenant-context";

export default defineEventHandler(async (event) => {
  const context = await requireStaffTenantContext(event);
  const requestedOrganizationId = getQuery(event).organizationId;
  const organizationId =
    typeof requestedOrganizationId === "string" && requestedOrganizationId.length > 0
      ? requestedOrganizationId
      : context.organizationId;

  if (organizationId !== context.organizationId) {
    throw createError({
      statusCode: 403,
      statusMessage: "No puedes consultar capacidades de otra organizacion.",
    });
  }

  const { data, error } = await context.adminClient.rpc("get_organization_capabilities", {
    input_org_id: organizationId,
  });

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  return { capabilities: data };
});
