import {
  readValidatedServiceCoverageBody,
  replaceServiceCoverage,
  requireServiceAssignmentContext,
  serviceCoverageSchema,
} from "../../../../utils/service-assignment";

export default defineEventHandler(async (event) => {
  const context = await requireServiceAssignmentContext(event);
  const serviceId = getRouterParam(event, "id");

  if (!serviceId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debes indicar el servicio a actualizar.",
    });
  }

  const body = await readValidatedServiceCoverageBody(event, serviceCoverageSchema);
  await replaceServiceCoverage(context, serviceId, body.coverage);

  return {
    success: true,
    serviceId,
  };
});
