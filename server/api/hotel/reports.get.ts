import { requireStaffTenantContext } from "../../utils/tenant-context";
import {
  getLodgingDailyGuestControlReport,
  getLodgingOccupancyReport,
  getLodgingRevenueReport,
  getLodgingSummaryReport,
} from "../../services/reports/lodging";

export default defineEventHandler(async (event) => {
  const context = await requireStaffTenantContext(event);
  const query = getQuery(event);
  const type = query.type as string;

  if (type === "summary") {
    return await getLodgingSummaryReport(context);
  }

  if (type === "occupancy") {
    return await getLodgingOccupancyReport(context);
  }

  if (type === "revenue") {
    const from = (query.from as string) ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = (query.to as string) ?? new Date().toISOString().slice(0, 10);
    return await getLodgingRevenueReport(context, from, to);
  }

  if (type === "daily-control") {
    const date = typeof query.date === "string" && query.date.length > 0
      ? query.date
      : new Date().toISOString().slice(0, 10);

    return await getLodgingDailyGuestControlReport(context, date);
  }

  throw createError({ statusCode: 400, statusMessage: "Tipo de reporte invalido. Usa: summary, occupancy, revenue, daily-control." });
});
