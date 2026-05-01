import type { Database } from "@/types/database.types";
import { requirePOSContext } from "../../utils/pos";

type BranchRow = Database["public"]["Tables"]["branches"]["Row"];

export default defineEventHandler(async (event) => {
  const context = await requirePOSContext(event);

  const baseQuery = context.adminClient
    .from("branches")
    .select("id, name, code, address")
    .eq("organization_id", context.organizationId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  const { data, error } = context.role === "admin"
    ? await baseQuery.returns<Array<Pick<BranchRow, "id" | "name" | "code" | "address">>>()
    : await baseQuery
      .in("id", context.allowedBranchIds)
      .returns<Array<Pick<BranchRow, "id" | "name" | "code" | "address">>>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  return {
    branches: (data ?? []).map((branch) => ({
      id: branch.id,
      name: branch.name,
      code: branch.code ?? null,
      address: branch.address ?? null,
    })),
  };
});

