import { getQuery } from "h3";

import { requireReportsContext, getReportsFilterSupport } from "../../services/reports/context";
import { getReportsAppointments } from "../../services/reports/appointments";

export default defineEventHandler(async (event) => {
  const context = await requireReportsContext(event);
  const query = getQuery(event);
  const support = await getReportsFilterSupport(event, context);

  const filters = {
    startDate: typeof query.startDate === "string" ? query.startDate : "",
    endDate: typeof query.endDate === "string" ? query.endDate : "",
    branchIds: typeof query.branchIds === "string" ? query.branchIds.split(",").filter(Boolean) : [],
    employeeId: typeof query.employeeId === "string" && query.employeeId.length > 0 ? query.employeeId : null,
    paymentMethod: typeof query.paymentMethod === "string" ? query.paymentMethod : "all",
    categoryIds: typeof query.categoryIds === "string" ? query.categoryIds.split(",").filter(Boolean) : [],
  };

  return getReportsAppointments(event, context, filters, support.filterOptions);
});
