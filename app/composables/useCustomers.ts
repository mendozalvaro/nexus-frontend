export interface CustomerRow {
  clientId: string;
  fullName: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  status: "active" | "inactive" | "blocked";
  billingName: string | null;
  billingEmail: string | null;
  billingPhone: string | null;
  documentType: CustomerDocumentType | null;
  documentNumber: string | null;
  isAnonymousTemplate: boolean;
  updatedAt: string;
}

export type CustomerDocumentType = "CI" | "NIT" | "Pasaporte" | "Otro";

export interface CustomersFilters {
  search: string;
  status: "all" | "active" | "inactive" | "blocked";
  includeAnonymous: boolean;
}

export interface CustomersSummary {
  total: number;
  active: number;
  blocked: number;
  inactive: number;
  anonymousTemplates: number;
}

export interface CustomerMutationPayload {
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  billingName?: string | null;
  billingEmail?: string | null;
  billingPhone?: string | null;
  documentType?: CustomerDocumentType | null;
  documentNumber?: string | null;
  billingData?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
}

export const useCustomers = () => {
  const { resolveAccessToken } = useSessionAccess();
  const { profile, ensureContext } = useUserContext();

  const getAuthHeaders = async () => {
    const token = await resolveAccessToken();
    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage: "La sesión no está disponible para gestionar clientes.",
      });
    }

    return { Authorization: `Bearer ${token}` };
  };

  const assertAccess = async () => {
    const context = await ensureContext({ requireProfile: true });
    const currentProfile = context.profile ?? profile.value;
    const allowed = currentProfile?.role === "admin" || currentProfile?.role === "manager";
    if (!allowed) {
      throw createError({
        statusCode: 403,
        statusMessage: "Solo admin o manager pueden gestionar clientes.",
      });
    }
  };

  const getDefaultFilters = (): CustomersFilters => ({
    search: "",
    status: "all",
    includeAnonymous: false,
  });

  const statusOptions: Array<{ label: string; value: CustomersFilters["status"] }> = [
    { label: "Todos", value: "all" },
    { label: "Activos", value: "active" },
    { label: "Inactivos", value: "inactive" },
    { label: "Bloqueados", value: "blocked" },
  ];

  const documentTypeOptions: Array<{ label: string; value: CustomerDocumentType }> = [
    { label: "CI", value: "CI" },
    { label: "NIT", value: "NIT" },
    { label: "Pasaporte", value: "Pasaporte" },
    { label: "Otro", value: "Otro" },
  ];

  const loadCustomers = async (options?: { page?: number; perPage?: number; filters?: CustomersFilters }) => {
    await assertAccess();
    const page = options?.page ?? 1;
    const perPage = options?.perPage ?? 20;
    const filters = options?.filters ?? getDefaultFilters();

    const response = await $fetch<{
      rows: CustomerRow[];
      total: number;
      page: number;
      perPage: number;
      summary: CustomersSummary;
    }>("/api/customers", {
      method: "GET",
      headers: await getAuthHeaders(),
      query: {
        q: filters.search.trim() || undefined,
        status: filters.status === "all" ? undefined : filters.status,
        includeAnonymous: filters.includeAnonymous,
        page,
        perPage,
      },
    });

    return response;
  };

  const createCustomer = async (payload: CustomerMutationPayload) => {
    await assertAccess();
    return await $fetch("/api/customers", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: payload,
    });
  };

  const updateCustomer = async (clientId: string, payload: CustomerMutationPayload) => {
    await assertAccess();
    return await $fetch(`/api/customers/${clientId}`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: payload,
    });
  };

  const setCustomerStatus = async (
    clientId: string,
    status: "active" | "inactive" | "blocked",
  ) => {
    await assertAccess();
    return await $fetch(`/api/customers/${clientId}/status`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: { status },
    });
  };

  const mergeCustomers = async (targetClientId: string, sourceClientId: string) => {
    await assertAccess();
    return await $fetch("/api/customers/merge", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: { targetClientId, sourceClientId },
    });
  };

  return {
    statusOptions,
    documentTypeOptions,
    getDefaultFilters,
    loadCustomers,
    createCustomer,
    updateCustomer,
    setCustomerStatus,
    mergeCustomers,
  };
};
