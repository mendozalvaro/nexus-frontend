import { createError } from "h3";

import type { Database, Json } from "@/types/database.types";
import type { TenantContext } from "../utils/tenant-context";
import { assertTenantModuleAccess } from "../utils/tenant-module-access";
import { resolveOrLinkClient } from "./clientLinking";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type ClientOrgRow = Database["public"]["Tables"]["client_org"]["Row"];

const sanitize = (value: string | null | undefined): string | null => {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
};

const sanitizeRecordString = (value: Record<string, unknown> | undefined) => {
  if (!value) return {};
  return value;
};

const assertCanMutateCustomers = async (context: TenantContext) => {
  await assertTenantModuleAccess({
    adminClient: context.adminClient,
    organizationId: context.organizationId,
    role: context.role,
    roleId: context.profile.role_id,
    moduleKey: "clients",
    action: "can_edit",
  });
};

const assertCanViewCustomers = async (context: TenantContext) => {
  await assertTenantModuleAccess({
    adminClient: context.adminClient,
    organizationId: context.organizationId,
    role: context.role,
    roleId: context.profile.role_id,
    moduleKey: "clients",
    action: "can_view",
  });
};

export interface OrgCustomerRow {
  clientId: string;
  fullName: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  billingName: string | null;
  billingEmail: string | null;
  billingPhone: string | null;
  documentType: string | null;
  documentNumber: string | null;
  isAnonymousTemplate: boolean;
  updatedAt: string;
}

export interface OrgCustomerSummary {
  total: number;
  active: number;
  blocked: number;
  inactive: number;
  anonymousTemplates: number;
}

const resolveMatchedClientIds = async (
  context: TenantContext,
  query?: string,
) => {
  const search = query?.trim() ?? "";
  if (search.length === 0) {
    return [] as string[];
  }

  const { data: customers, error: customersError } = await context.adminClient
    .from("clients")
    .select("id")
    .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);

  if (customersError) {
    throw createError({ statusCode: 500, statusMessage: customersError.message });
  }

  return (customers ?? []).map((row) => row.id);
};

export async function listOrganizationCustomers(
  context: TenantContext,
  options: {
    query?: string;
    status?: string;
    includeAnonymous?: boolean;
    page?: number;
    perPage?: number;
  },
): Promise<{ rows: OrgCustomerRow[]; total: number; page: number; perPage: number; summary: OrgCustomerSummary }> {
  await assertCanViewCustomers(context);

  const page = Math.max(1, options.page ?? 1);
  const perPage = Math.min(100, Math.max(1, options.perPage ?? 20));
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  const search = options.query?.trim() ?? "";
  const matchedClientIds = await resolveMatchedClientIds(context, search);
  const buildRequest = (includeStatusFilter: boolean) => {
    let request = context.adminClient
      .from("client_org")
      .select("client_id, status, billing_name, billing_email, billing_phone, document_type, document_number, is_anonymous_template, updated_at, clients!inner(id, first_name, last_name, email, phone)", { count: "exact" })
      .eq("organization_id", context.organizationId)
      .order("updated_at", { ascending: false });

    if (!options.includeAnonymous) {
      request = request.eq("is_anonymous_template", false);
    }

    if (includeStatusFilter && options.status) {
      request = request.eq("status", options.status);
    }

    if (search.length > 0) {
      const billingFilter = `billing_name.ilike.%${search}%,billing_email.ilike.%${search}%,billing_phone.ilike.%${search}%,document_type.ilike.%${search}%,document_number.ilike.%${search}%`;
      request = matchedClientIds.length > 0
        ? request.or(`${billingFilter},client_id.in.(${matchedClientIds.join(",")})`)
        : request.or(billingFilter);
    }

    return request;
  };

  const { data, count, error } = await buildRequest(true).range(from, to);
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  const { data: summaryRows, error: summaryError } = await buildRequest(false);
  if (summaryError) {
    throw createError({ statusCode: 500, statusMessage: summaryError.message });
  }

  const rows = ((data ?? []) as Array<{
    client_id: string;
    status: string;
    billing_name: string | null;
    billing_email: string | null;
    billing_phone: string | null;
    document_type: string | null;
    document_number: string | null;
    is_anonymous_template: boolean;
    updated_at: string;
    clients: Pick<ClientRow, "id" | "first_name" | "last_name" | "email" | "phone"> | null;
  }>).flatMap((row) => {
    if (!row.clients) return [];
    return [{
      clientId: row.client_id,
      fullName: [row.clients.first_name, row.clients.last_name].filter(Boolean).join(" ").trim() || "Cliente",
      firstName: row.clients.first_name,
      lastName: row.clients.last_name,
      email: row.clients.email,
      phone: row.clients.phone,
      status: row.status,
      billingName: row.billing_name,
      billingEmail: row.billing_email,
      billingPhone: row.billing_phone,
      documentType: row.document_type,
      documentNumber: row.document_number,
      isAnonymousTemplate: row.is_anonymous_template,
      updatedAt: row.updated_at,
    }];
  });

  return {
    rows,
    total: Number(count ?? 0),
    page,
    perPage,
    summary: {
      total: (summaryRows ?? []).length,
      active: (summaryRows ?? []).filter((row) => row.status === "active").length,
      blocked: (summaryRows ?? []).filter((row) => row.status === "blocked").length,
      inactive: (summaryRows ?? []).filter((row) => row.status === "inactive").length,
      anonymousTemplates: (summaryRows ?? []).filter((row) => row.is_anonymous_template === true).length,
    },
  };
}

export async function createOrganizationCustomer(
  context: TenantContext,
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
  await assertCanMutateCustomers(context);

  const resolved = await resolveOrLinkClient(context.adminClient, {
    organizationId: context.organizationId,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    email: input.email,
    billingData: sanitizeRecordString(input.billingData),
    preferences: sanitizeRecordString(input.preferences),
  });

  const { error } = await context.adminClient
    .from("client_org")
    .update({
      billing_name: sanitize(input.billingName),
      billing_email: sanitize(input.billingEmail),
      billing_phone: sanitize(input.billingPhone),
      document_type: sanitize(input.documentType),
      document_number: sanitize(input.documentNumber),
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", resolved.client.id)
    .eq("organization_id", context.organizationId);

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return {
    clientId: resolved.client.id,
    orgStatus: resolved.orgStatus,
  };
}

export async function updateOrganizationCustomer(
  context: TenantContext,
  clientId: string,
  input: {
    firstName?: string;
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
  await assertCanMutateCustomers(context);

  const { data: clientOrg, error: clientOrgError } = await context.adminClient
    .from("client_org")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("client_id", clientId)
    .maybeSingle<ClientOrgRow>();

  if (clientOrgError) throw createError({ statusCode: 500, statusMessage: clientOrgError.message });
  if (!clientOrg) throw createError({ statusCode: 404, statusMessage: "Cliente no vinculado a la organización." });
  if (clientOrg.is_anonymous_template) throw createError({ statusCode: 409, statusMessage: "No se puede editar el cliente anónimo template." });

  const { data: client, error: clientError } = await context.adminClient
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle<ClientRow>();
  if (clientError) throw createError({ statusCode: 500, statusMessage: clientError.message });
  if (!client) throw createError({ statusCode: 404, statusMessage: "Cliente no encontrado." });

  const { error: updateClientError } = await context.adminClient
    .from("clients")
    .update({
      first_name: sanitize(input.firstName) ?? client.first_name,
      last_name: sanitize(input.lastName),
      phone: sanitize(input.phone),
      email: sanitize(input.email),
      billing_data: (input.billingData ?? client.billing_data ?? {}) as Json,
      preferences: (input.preferences ?? client.preferences ?? {}) as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId);
  if (updateClientError) throw createError({ statusCode: 500, statusMessage: updateClientError.message });

  const { error: updateOrgError } = await context.adminClient
    .from("client_org")
    .update({
      billing_name: sanitize(input.billingName),
      billing_email: sanitize(input.billingEmail),
      billing_phone: sanitize(input.billingPhone),
      document_type: sanitize(input.documentType),
      document_number: sanitize(input.documentNumber),
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", context.organizationId)
    .eq("client_id", clientId);

  if (updateOrgError) throw createError({ statusCode: 500, statusMessage: updateOrgError.message });
}

export async function setOrganizationCustomerStatus(
  context: TenantContext,
  clientId: string,
  status: "active" | "inactive" | "blocked",
) {
  await assertCanMutateCustomers(context);

  const { data: clientOrg, error: clientOrgError } = await context.adminClient
    .from("client_org")
    .select("is_anonymous_template")
    .eq("organization_id", context.organizationId)
    .eq("client_id", clientId)
    .maybeSingle<{ is_anonymous_template: boolean }>();

  if (clientOrgError) throw createError({ statusCode: 500, statusMessage: clientOrgError.message });
  if (!clientOrg) throw createError({ statusCode: 404, statusMessage: "Cliente no vinculado a la organización." });
  if (clientOrg.is_anonymous_template) throw createError({ statusCode: 409, statusMessage: "No se puede bloquear el cliente anónimo template." });

  const { error } = await context.adminClient
    .from("client_org")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", context.organizationId)
    .eq("client_id", clientId);

  if (error) throw createError({ statusCode: 500, statusMessage: error.message });
}

export async function mergeOrganizationCustomers(
  context: TenantContext,
  targetClientId: string,
  sourceClientId: string,
) {
  await assertCanMutateCustomers(context);

  if (targetClientId === sourceClientId) {
    throw createError({ statusCode: 400, statusMessage: "El cliente origen y destino no pueden ser el mismo." });
  }

  const { data: links, error: linksError } = await context.adminClient
    .from("client_org")
    .select("client_id, is_anonymous_template")
    .eq("organization_id", context.organizationId)
    .in("client_id", [targetClientId, sourceClientId]);

  if (linksError) throw createError({ statusCode: 500, statusMessage: linksError.message });
  if (!links || links.length !== 2) throw createError({ statusCode: 404, statusMessage: "Ambos clientes deben estar vinculados a la organización." });
  if (links.some((link) => link.is_anonymous_template)) throw createError({ statusCode: 409, statusMessage: "No se puede fusionar el cliente anónimo template." });

  const now = new Date().toISOString();

  const { error: txError } = await context.adminClient
    .from("transactions")
    .update({ customer_id: targetClientId })
    .eq("organization_id", context.organizationId)
    .eq("customer_id", sourceClientId);
  if (txError) throw createError({ statusCode: 500, statusMessage: txError.message });

  const { error: aptError } = await context.adminClient
    .from("appointments")
    .update({ customer_id: targetClientId })
    .eq("organization_id", context.organizationId)
    .eq("customer_id", sourceClientId);
  if (aptError) throw createError({ statusCode: 500, statusMessage: aptError.message });

  const { error: salesOrderError } = await (context.adminClient as any)
    .from("sales_orders")
    .update({ customer_id: targetClientId })
    .eq("organization_id", context.organizationId)
    .eq("customer_id", sourceClientId);
  if (salesOrderError) throw createError({ statusCode: 500, statusMessage: salesOrderError.message });

  const { error: profileClientMapError } = await context.adminClient
    .from("profile_client_map")
    .update({ client_id: targetClientId })
    .eq("client_id", sourceClientId);
  if (profileClientMapError) throw createError({ statusCode: 500, statusMessage: profileClientMapError.message });

  const { error: deactivateLinkError } = await context.adminClient
    .from("client_org")
    .update({ status: "inactive", updated_at: now })
    .eq("organization_id", context.organizationId)
    .eq("client_id", sourceClientId);
  if (deactivateLinkError) throw createError({ statusCode: 500, statusMessage: deactivateLinkError.message });

  const { data: orgLinks, error: orgLinksError } = await context.adminClient
    .from("client_org")
    .select("client_id")
    .eq("client_id", sourceClientId)
    .neq("status", "inactive")
    .limit(1);

  if (orgLinksError) throw createError({ statusCode: 500, statusMessage: orgLinksError.message });

  if (!orgLinks || orgLinks.length === 0) {
    const { error: deleteClientError } = await context.adminClient
      .from("clients")
      .delete()
      .eq("id", sourceClientId);
    if (deleteClientError) throw createError({ statusCode: 500, statusMessage: deleteClientError.message });
  }
}
