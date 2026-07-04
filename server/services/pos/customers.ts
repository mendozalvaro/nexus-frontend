import { createError } from "h3";
import { requirePOSContextStrict } from "../../utils/pos";
import { resolveOrLinkClient } from "../clientLinking";

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
  const context = await requirePOSContextStrict(event, "can_view");

  let request = context.adminClient
    .from("client_org")
    .select("client_id, status, clients!inner(id, first_name, last_name, email, phone)")
    .eq("organization_id", context.organizationId)
    .eq("status", "active")
    .eq("is_anonymous_template", false)
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

export async function createPOSCustomer(
  event: H3Event,
  input: {
    firstName: string;
    lastName?: string | null;
    phone?: string | null;
    email?: string | null;
    billingName?: string | null;
    billingEmail?: string | null;
    billingPhone?: string | null;
    documentType?: string | null;
    documentNumber?: string | null;
    billingData?: Record<string, unknown>;
    preferences?: Record<string, unknown>;
  },
) {
  const context = await requirePOSContextStrict(event, "can_create");

  const resolved = await resolveOrLinkClient(context.adminClient, {
    organizationId: context.organizationId,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    email: input.email,
    billingData: input.billingData,
    preferences: input.preferences,
  });

  const { error } = await context.adminClient
    .from("client_org")
    .update({
      billing_name: input.billingName?.trim() || null,
      billing_email: input.billingEmail?.trim() || null,
      billing_phone: input.billingPhone?.trim() || null,
      document_type: input.documentType?.trim() || null,
      document_number: input.documentNumber?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", resolved.client.id)
    .eq("organization_id", context.organizationId);

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return {
    customer: {
      id: resolved.client.id,
      fullName: [resolved.client.first_name, resolved.client.last_name].filter(Boolean).join(" ").trim() || "Cliente",
      email: resolved.client.email,
      phone: resolved.client.phone,
    },
  };
}
