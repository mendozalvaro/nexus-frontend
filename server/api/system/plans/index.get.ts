import type { Database } from "@/types/database.types";
import {
  assertSystemModuleAccess,
  requireSystemAdminContext,
} from "../../../utils/system-admin";

type SubscriptionPlanRow = Database["public"]["Tables"]["subscription_plans"]["Row"];

export default defineEventHandler(async (event) => {
  const context = await requireSystemAdminContext(event);
  await assertSystemModuleAccess(context, "plans", "can_view");

  const { data, error } = await context.adminClient
    .from("subscription_plans")
    .select("*")
    .order("created_at", { ascending: true })
    .returns<SubscriptionPlanRow[]>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudieron cargar los planes de suscripcion.",
    });
  }

  return {
    rows: data ?? [],
  };
});
