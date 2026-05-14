import { getRouterParam } from "h3";

import { serviceCoverageSchema, readValidatedServiceCoverageBody } from "../../../../utils/service-assignment";

import { updateServiceCoverage } from "../../../../services/service-assignment/coverage";

export default defineEventHandler(async (event) => {
  const serviceId = getRouterParam(event, "id");

  if (!serviceId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debes indicar el servicio a actualizar.",
    });
  }

  const body = await readValidatedServiceCoverageBody(event, serviceCoverageSchema);
  return updateServiceCoverage(event, serviceId, body.coverage);
});
