import { getQuery } from "h3";

import { requirePOSContext } from "../../utils/pos";

import type { Database } from "@/types/database.types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export default defineEventHandler(async (event) => {
  const context = await requirePOSContext(event);
  const query = getQuery(event);
  const search = typeof query.q === "string" ? query.q.trim() : "";

  let request = context.adminClient
    .from("profiles")
    .select("id, full_name, email, phone, organization_id, role, is_active")
    .eq("role", "client")
    .eq("is_active", true)
    .or(`organization_id.eq.${context.organizationId},organization_id.is.null`)
    .order("created_at", { ascending: false })
    .limit(search ? 15 : 8);

  if (search) {
    request = request.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data, error } = await request.returns<Array<Pick<ProfileRow, "id" | "full_name" | "email" | "phone" | "organization_id" | "role" | "is_active">>>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  return {
    customers: data ?? [],
  };
});
