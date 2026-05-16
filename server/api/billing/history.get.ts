import { throwApiError } from "../../utils/http-error";
import { requireTenantContext } from "../../utils/tenant-context";
import { setCacheHeaders } from "../../utils/cache";

export default defineEventHandler(async (event) => {
  const context = await requireTenantContext(event);

  const query = getQuery(event);
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100);
  const offset = Math.max(Number(query.offset) || 0, 0);

  const { data, error, count } = await (context.adminClient as any)
    .from("billing_ledger")
    .select(
      `
      id,
      event_type,
      amount,
      currency,
      billing_mode,
      description,
      metadata,
      created_at,
      plan:subscription_plans(id, name, slug)
    `,
      { count: "exact" },
    )
    .eq("organization_id", context.organizationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throwApiError(500, "BILLING_HISTORY_ERROR", error.message);
  }

  setCacheHeaders(event, { sMaxAge: 60, staleWhileRevalidate: 30, visibility: "private" });
  return {
    entries: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  };
});
