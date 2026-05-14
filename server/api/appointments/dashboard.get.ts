import { getQuery } from "h3";

import { getAppointmentDashboard } from "../../services/appointments/dashboard";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const targetDate = typeof query.date === "string" ? query.date : new Date().toISOString().slice(0, 10);
  const scopeRole = typeof query.scopeRole === "string" ? query.scopeRole : "admin";
  const currentProfileId = typeof query.currentProfileId === "string" ? query.currentProfileId : "";
  const managerBranchId = typeof query.managerBranchId === "string" ? query.managerBranchId : null;

  if (!currentProfileId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debes indicar el perfil actual para cargar el dashboard.",
    });
  }

  return getAppointmentDashboard(event, targetDate, scopeRole as "admin" | "manager" | "employee", currentProfileId, managerBranchId);
});
