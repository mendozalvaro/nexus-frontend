import { getQuery } from "h3";

import { setCacheHeaders } from "../utils/cache";
import { requireStaffTenantContext } from "../utils/tenant-context";
import { getDashboardStats } from "../services/dashboard/stats";

const UUID_V4_RELAXED_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeBranchId = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return UUID_V4_RELAXED_REGEX.test(trimmed) ? trimmed : null;
};

export default defineEventHandler(async (event) => {
  const context = await requireStaffTenantContext(event);
  const query = getQuery(event);

  const period = typeof query.period === "string" ? query.period : "30d";
  const branchId = normalizeBranchId(query.branchId);

  const result = await getDashboardStats(context, {
    period,
    branchId,
  });

  setCacheHeaders(event, { sMaxAge: 60, staleWhileRevalidate: 30, visibility: "private" });

  return result;
});
