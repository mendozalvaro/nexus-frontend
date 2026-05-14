import { getQuery } from "h3";

import { getAppointmentCatalog } from "../../services/appointments/catalog";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const scopeRole = typeof query.scopeRole === "string" ? query.scopeRole : "admin";
  const currentProfileId = typeof query.currentProfileId === "string" ? query.currentProfileId : "";

  if (!currentProfileId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debes indicar el perfil actual para cargar el catalogo.",
    });
  }

  return getAppointmentCatalog(event, scopeRole as "admin" | "manager" | "employee", currentProfileId);
});
