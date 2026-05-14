import { getQuery } from "h3";

import { getAppointmentsList, type AppointmentFilters } from "../../services/appointments/list";
import { getAppointmentCatalog } from "../../services/appointments/catalog";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);

  const view = typeof query.view === "string" ? query.view : "week";
  const anchorDate = typeof query.anchorDate === "string" ? query.anchorDate : new Date().toISOString().slice(0, 10);
  const branchId = typeof query.branchId === "string" && query.branchId.length > 0 ? query.branchId : null;
  const employeeId = typeof query.employeeId === "string" && query.employeeId.length > 0 ? query.employeeId : null;
  const serviceId = typeof query.serviceId === "string" && query.serviceId.length > 0 ? query.serviceId : null;
  const status = typeof query.status === "string" ? query.status : "all";
  const scopeRole = typeof query.scopeRole === "string" ? query.scopeRole : "admin";
  const currentProfileId = typeof query.currentProfileId === "string" ? query.currentProfileId : "";
  const managerBranchId = typeof query.managerBranchId === "string" && query.managerBranchId.length > 0 ? query.managerBranchId : null;

  if (!currentProfileId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debes indicar el perfil actual para cargar las citas.",
    });
  }

  const catalog = await getAppointmentCatalog(event, scopeRole as "admin" | "manager" | "employee", currentProfileId);

  const filters: AppointmentFilters = {
    view: view as "day" | "week" | "month",
    anchorDate,
    branchId,
    employeeId,
    serviceId,
    status: status as AppointmentFilters["status"],
    scopeRole: scopeRole as AppointmentFilters["scopeRole"],
    currentProfileId,
    managerBranchId,
  };

  return getAppointmentsList(event, filters, {
    organizationId: catalog.organizationId,
    branches: catalog.branches.map((b) => ({ id: b.id, name: b.name })),
    services: catalog.services.map((s) => ({ id: s.id, name: s.name })),
    employees: catalog.employees.map((e) => ({ id: e.id, fullName: e.fullName })),
  });
});
