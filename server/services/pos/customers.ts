import { requirePOSContext } from "../../utils/pos";

import type { Database } from "@/types/database.types";

import type { H3Event } from "h3";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type ClientOrgRow = Database["public"]["Tables"]["client_org"]["Row"];

export interface POSCustomerSearchResult {
  customers: Array<{
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
  }>;
}

export async function searchPOSCustomers(
  event: H3Event,
  search: string,
): Promise<POSCustomerSearchResult> {
  const context = await requirePOSContext(event);

  let request = context.adminClient
    .from("client_org")
    .select("client_id, status, clients!inner(id, first_name, last_name, email, phone)")
    .eq("organization_id", context.organizationId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(search ? 20 : 10);

  if (search) {
    request = request.or(`billing_name.ilike.%${search}%,billing_email.ilike.%${search}%,billing_phone.ilike.%${search}%`);
  }

  const { data, error } = await request;

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  const rows = (data ?? []) as unknown as Array<{
    client_id: string;
    status: ClientOrgRow["status"];
    clients: Pick<ClientRow, "id" | "first_name" | "last_name" | "email" | "phone"> | null;
  }>;

  return {
    customers: rows
      .map((row) => {
        const client = row.clients;
        if (!client) {
          return null;
        }

        const fullName = [client.first_name, client.last_name].filter(Boolean).join(" ").trim() || "Cliente";
        return {
          id: client.id,
          full_name: fullName,
          email: client.email ?? "",
          phone: client.phone,
        };
      })
      .filter((row): row is { id: string; full_name: string; email: string; phone: string | null } => Boolean(row)),
  };
}
