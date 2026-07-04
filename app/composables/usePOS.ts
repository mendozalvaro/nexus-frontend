import type { Database, Json } from "@/types/database.types";
import type { POSSalesOrderItem } from "@/composables/usePOSSales";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type InventoryStockRow = Database["public"]["Tables"]["inventory_stock"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["employee_branch_assignments"]["Row"];
type PaymentMethod = Database["public"]["Enums"]["payment_method"];
export type ReceiptFormat = "thermal" | "half_letter";

export interface POSBranchOption {
  id: string;
  name: string;
  code: string;
}

export interface POSCategoryOption {
  id: string;
  name: string;
  type: string;
}

export interface POSProductItem {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  price: number;
  categoryId: string | null;
  categoryName: string | null;
  trackInventory: boolean;
  stockByBranch: Record<string, number>;
}

export interface POSEmployeeItem {
  id: string;
  fullName: string;
  branchId: string | null;
  role: Database["public"]["Enums"]["user_role"] | null;
  assignedBranchIds: string[];
  serviceIds: string[];
}

export interface POSServiceItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationMinutes: number;
  categoryId: string | null;
  categoryName: string | null;
}

export interface POSCustomerOption {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
}

export interface POSCustomerCreatePayload {
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  billingName?: string | null;
  billingEmail?: string | null;
  billingPhone?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
}

export interface POSCatalog {
  organizationId: string;
  currentBranchId: string | null;
  defaultReceiptFormat: ReceiptFormat;
  branches: POSBranchOption[];
  categories: POSCategoryOption[];
  products: POSProductItem[];
  services: POSServiceItem[];
  employees: POSEmployeeItem[];
}

export interface POSCartProductItem {
  id: string;
  itemType: "product";
  productId: string;
  name: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  branchId: string;
  categoryName: string | null;
  stockAvailable: number | null;
}

export interface POSCartServiceItem {
  id: string;
  itemType: "service";
  serviceId: string;
  name: string;
  quantity: 1;
  unitPrice: number;
  subtotal: number;
  branchId: string;
  employeeId: string;
  employeeName: string;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  categoryName: string | null;
}

export type POSCartItem = POSCartProductItem | POSCartServiceItem;

export interface POSCheckoutCustomerExisting {
  mode: "existing";
  customerId: string;
}

export interface POSCheckoutCustomerWalkIn {
  mode: "walk_in";
  fullName: string;
  phone: string;
}

export type POSCheckoutCustomer = POSCheckoutCustomerExisting | POSCheckoutCustomerWalkIn;

export interface POSDiscountInput {
  type: "none" | "percentage" | "fixed";
  value: number;
}

export interface POSCheckoutPayload {
  branchId: string;
  customer: POSCheckoutCustomer;
  paymentMethod: PaymentMethod;
  discount: POSDiscountInput;
  note: string;
  createAppointments?: boolean;
  appointmentId?: string | null;
  receiptFormatOverride?: ReceiptFormat | null;
}

export interface POSReceiptLineItem {
  id: string;
  itemType: "product" | "service";
  quantity: number;
  unitPrice: number;
  subtotal: number;
  title: string;
  subtitle: string | null;
  snapshotData: Json | null;
}

export interface POSReceipt {
  transactionId: string;
  invoiceNumber: number;
  createdAt: string;
  branchId: string;
  branchName: string;
  employeeId: string;
  employeeName: string;
  customer: {
    mode: "existing" | "walk_in";
    customerId: string | null;
    guestCustomerId?: string | null;
    fullName: string;
    phone: string | null;
    email?: string | null;
  };
  paymentMethod: PaymentMethod;
  totalAmount: number;
  discountAmount: number;
  taxAmount: number;
  finalAmount: number;
  formatUsed: ReceiptFormat;
  verificationUrl: string;
  items: POSReceiptLineItem[];
}

export interface POSTransactionHistoryItem {
  id: string;
  invoiceNumber: number;
  createdAt: string | null;
  branchId: string;
  branchName: string;
  employeeId: string;
  employeeName: string;
  customerName: string;
  customerPhone: string | null;
  finalAmount: number;
  paymentMethod: PaymentMethod;
  status: string;
  itemsCount: number;
}

interface POSCatalogResponse {
  organizationId: string;
  currentBranchId: string | null;
  defaultReceiptFormat: ReceiptFormat;
  branches: BranchRow[];
  categories: CategoryRow[];
  products: ProductRow[];
  services: ServiceRow[];
  employees: ProfileRow[];
  assignments: AssignmentRow[];
  inventory: InventoryStockRow[];
}

const createCartItemId = () => {
  return `cart-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const roundCurrency = (value: number): number => {
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

const parseSkills = (value: Json | null): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
};

export const usePOS = () => {
  const { resolveAccessToken } = useSessionAccess();
  const { profile, fetchProfile } = useAuth();

  const cart = useState<POSCartItem[]>("pos:cart", () => []);
  const hydrated = useState<boolean>("pos:hydrated", () => false);
  const lastCatalog = useState<POSCatalog | null>("pos:catalog", () => null);
  const appointmentContext = useState<{
    appointmentId: string | null;
    customerName: string | null;
    serviceName: string | null;
    employeeName: string | null;
    dateTime: string | null;
  }>("pos:appointmentContext", () => ({
    appointmentId: null,
    customerName: null,
    serviceName: null,
    employeeName: null,
    dateTime: null,
  }));

  const getAuthHeaders = async () => {
    const token = await resolveAccessToken();
    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage: "La sesión no está disponible para operar el POS.",
      });
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  };

  const getStorageKey = () => {
    const organizationId = profile.value?.organization_id ?? "anonymous";
    const userId = profile.value?.id ?? "user";
    return `nexuspos:cart:${organizationId}:${userId}`;
  };

  const ensureProfile = async () => {
    const currentProfile = profile.value ?? await fetchProfile();
    if (!currentProfile?.organization_id || !currentProfile.role || currentProfile.role === "client") {
      throw createError({
        statusCode: 403,
        statusMessage: "Solo personal operativo puede usar el POS.",
      });
    }

    return currentProfile;
  };

  const hydrateCart = async () => {
    await ensureProfile();

    if (!import.meta.client || hydrated.value) {
      return;
    }

    try {
      const raw = window.localStorage.getItem(getStorageKey());
      if (!raw) {
        hydrated.value = true;
        return;
      }

      const parsed = JSON.parse(raw) as POSCartItem[];
      cart.value = Array.isArray(parsed) ? parsed : [];
    } catch {
      cart.value = [];
    } finally {
      hydrated.value = true;
    }
  };

  watch(
    () => cart.value,
    (value) => {
      if (!import.meta.client || !hydrated.value) {
        return;
      }

      window.localStorage.setItem(getStorageKey(), JSON.stringify(value));
    },
    { deep: true },
  );

  const mapCatalog = (payload: POSCatalogResponse): POSCatalog => {
    const categoriesMap = new Map(payload.categories.map((category) => [category.id, category]));
    const stockByProduct = payload.inventory.reduce<Map<string, Record<string, number>>>((accumulator, item) => {
      const current = accumulator.get(item.product_id) ?? {};
      current[item.branch_id] = Math.max(0, (item.quantity ?? 0) - (item.reserved_quantity ?? 0));
      accumulator.set(item.product_id, current);
      return accumulator;
    }, new Map<string, Record<string, number>>());

    const assignmentsByEmployee = payload.assignments.reduce<Map<string, AssignmentRow[]>>((accumulator, assignment) => {
      const row = accumulator.get(assignment.user_id) ?? [];
      row.push(assignment);
      accumulator.set(assignment.user_id, row);
      return accumulator;
    }, new Map<string, AssignmentRow[]>());

    return {
      organizationId: payload.organizationId,
      currentBranchId: payload.currentBranchId,
      defaultReceiptFormat: payload.defaultReceiptFormat ?? "thermal",
      branches: payload.branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
        code: branch.code,
      })),
      categories: payload.categories.map((category) => ({
        id: category.id,
        name: category.name,
        type: category.type,
      })),
      products: payload.products.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        description: product.description,
        price: Number(product.sale_price),
        categoryId: product.category_id,
        categoryName: product.category_id ? (categoriesMap.get(product.category_id)?.name ?? null) : null,
        trackInventory: product.track_inventory ?? true,
        stockByBranch: stockByProduct.get(product.id) ?? {},
      })),
      services: payload.services.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        price: Number(service.price),
        durationMinutes: service.duration_minutes,
        categoryId: service.category_id,
        categoryName: service.category_id ? (categoriesMap.get(service.category_id)?.name ?? null) : null,
      })),
      employees: payload.employees.map((employee) => {
        const assignments = assignmentsByEmployee.get(employee.id) ?? [];
        const primaryAssignment = assignments.find((assignment) => assignment.is_primary) ?? assignments[0] ?? null;
        return {
          id: employee.id,
          fullName: employee.full_name,
          branchId: primaryAssignment?.branch_id ?? null,
          role: employee.role,
          assignedBranchIds: Array.from(new Set(assignments.map((assignment) => assignment.branch_id))),
          serviceIds: Array.from(new Set(assignments.flatMap((assignment) => parseSkills(assignment.skills)))),
        };
      }),
    };
  };

  const loadCatalog = async (): Promise<POSCatalog> => {
    await hydrateCart();
    const response = await $fetch<POSCatalogResponse>("/api/pos/catalog", {
      headers: await getAuthHeaders(),
    });

    const catalog = mapCatalog(response);
    lastCatalog.value = catalog;
    return catalog;
  };

  const searchCustomers = async (query: string): Promise<POSCustomerOption[]> => {
    await ensureProfile();

    const response = await $fetch<{ customers: Array<Pick<ProfileRow, "id" | "full_name" | "email" | "phone">> }>("/api/pos/customers", {
      headers: await getAuthHeaders(),
      query: {
        q: query.trim(),
      },
    });

    return (response.customers ?? []).map((customer) => ({
      id: customer.id,
      fullName: customer.full_name,
      email: customer.email,
      phone: customer.phone,
    }));
  };

  const createPOSCustomer = async (payload: POSCustomerCreatePayload): Promise<POSCustomerOption> => {
    await ensureProfile();

    const response = await $fetch<{ customer: { id: string; fullName: string; email: string | null; phone: string | null } }>("/api/pos/customers", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: payload,
    });

    return {
      id: response.customer.id,
      fullName: response.customer.fullName,
      email: response.customer.email ?? "",
      phone: response.customer.phone ?? null,
    };
  };

  const addProductToCart = (
    product: POSProductItem,
    branchId: string,
    quantity = 1,
  ) => {
    const existing = cart.value.find((item) => {
      return item.itemType === "product" && item.productId === product.id && item.branchId === branchId;
    });

    const nextAvailable = product.trackInventory ? (product.stockByBranch[branchId] ?? 0) : null;

    if (existing && existing.itemType === "product") {
      const nextQuantity = existing.quantity + quantity;
      if (nextAvailable !== null && nextQuantity > nextAvailable) {
        throw createError({
          statusCode: 409,
          statusMessage: `Stock insuficiente para ${product.name}. Disponible: ${nextAvailable}.`,
        });
      }

      existing.quantity = nextQuantity;
      existing.subtotal = roundCurrency(existing.unitPrice * existing.quantity);
      return;
    }

    if (nextAvailable !== null && quantity > nextAvailable) {
      throw createError({
        statusCode: 409,
        statusMessage: `Stock insuficiente para ${product.name}. Disponible: ${nextAvailable}.`,
      });
    }

    cart.value = [
      ...cart.value,
      {
        id: createCartItemId(),
        itemType: "product",
        productId: product.id,
        name: product.name,
        sku: product.sku,
        quantity,
        unitPrice: product.price,
        subtotal: roundCurrency(product.price * quantity),
        branchId,
        categoryName: product.categoryName,
        stockAvailable: nextAvailable,
      },
    ];
  };

  const addServiceToCart = (
    service: POSServiceItem,
    branchId: string,
    employee: POSEmployeeItem,
    scheduledDate: string,
    scheduledTime: string,
  ) => {
    cart.value = [
      ...cart.value,
      {
        id: createCartItemId(),
        itemType: "service",
        serviceId: service.id,
        name: service.name,
        quantity: 1,
        unitPrice: service.price,
        subtotal: roundCurrency(service.price),
        branchId,
        employeeId: employee.id,
        employeeName: employee.fullName,
        scheduledDate,
        scheduledTime,
        durationMinutes: service.durationMinutes,
        categoryName: service.categoryName,
      },
    ];
  };

  const updateProductQuantity = (cartItemId: string, quantity: number) => {
    cart.value = cart.value.map((item) => {
      if (item.id !== cartItemId || item.itemType !== "product") {
        return item;
      }

      if (quantity <= 0) {
        return item;
      }

      if (item.stockAvailable !== null && quantity > item.stockAvailable) {
        throw createError({
          statusCode: 409,
          statusMessage: `Stock insuficiente para ${item.name}. Disponible: ${item.stockAvailable}.`,
        });
      }

      return {
        ...item,
        quantity,
        subtotal: roundCurrency(item.unitPrice * quantity),
      };
    });
  };

  const removeCartItem = (cartItemId: string) => {
    cart.value = cart.value.filter((item) => item.id !== cartItemId);
  };

  const clearCart = () => {
    cart.value = [];
  };

  const replaceCartFromSalesOrderItems = (items: POSSalesOrderItem[]) => {
    const currentCatalog = lastCatalog.value;

    cart.value = items.map((item) => {
      const snapshot = asRecord(item.snapshot_data);
      const title = typeof snapshot?.title === "string" ? snapshot.title : (item.item_type === "product" ? "Producto" : "Servicio");
      const subtitle = typeof snapshot?.subtitle === "string" ? snapshot.subtitle : null;

      if (item.item_type === "product") {
        const catalogProduct = currentCatalog?.products.find((product) => product.id === item.product_id) ?? null;
        const stockAvailable = catalogProduct
          ? (catalogProduct.stockByBranch[item.branch_id] ?? 0)
          : null;

        return {
          id: createCartItemId(),
          itemType: "product" as const,
          productId: item.product_id ?? "",
          name: title,
          sku: typeof snapshot?.sku === "string" ? snapshot.sku : subtitle,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unit_price),
          subtotal: Number(item.subtotal),
          branchId: item.branch_id,
          categoryName: typeof snapshot?.categoryName === "string" ? snapshot.categoryName : null,
          stockAvailable,
        };
      }

      const catalogService = currentCatalog?.services.find((service) => service.id === item.service_id) ?? null;

      return {
        id: createCartItemId(),
        itemType: "service" as const,
        serviceId: item.service_id ?? "",
        name: title,
        quantity: 1,
        unitPrice: Number(item.unit_price),
        subtotal: Number(item.subtotal),
        branchId: item.branch_id,
        employeeId: item.employee_id ?? "",
        employeeName: typeof snapshot?.employeeName === "string" ? snapshot.employeeName : (subtitle?.split("·")[0]?.trim() ?? "Colaborador"),
        scheduledDate: item.scheduled_date ?? new Date().toISOString().slice(0, 10),
        scheduledTime: item.scheduled_time ?? "09:00",
        durationMinutes: catalogService?.durationMinutes ?? 60,
        categoryName: typeof snapshot?.categoryName === "string" ? snapshot.categoryName : null,
      };
    });
  };

  const getCartSubtotal = () => {
    return roundCurrency(cart.value.reduce((sum, item) => sum + item.subtotal, 0));
  };

  const getDiscountAmountPreview = (discount: POSDiscountInput) => {
    const subtotal = getCartSubtotal();
    if (discount.type === "none" || discount.value <= 0) {
      return 0;
    }

    if (discount.type === "percentage") {
      return roundCurrency(Math.min(subtotal, subtotal * (discount.value / 100)));
    }

    return roundCurrency(Math.min(subtotal, discount.value));
  };

  const getCheckoutPreview = (discount: POSDiscountInput) => {
    const subtotal = getCartSubtotal();
    const discountAmount = getDiscountAmountPreview(discount);
    const finalAmount = roundCurrency(Math.max(0, subtotal - discountAmount));

    return {
      subtotal,
      discountAmount,
      taxAmount: 0,
      finalAmount,
    };
  };

  const checkout = async (payload: POSCheckoutPayload): Promise<POSReceipt> => {
    await ensureProfile();

    const response = await $fetch<{ receipt: POSReceipt; transactionId: string; createdAppointments: Array<{ id: string; serviceId: string; employeeId: string }> }>("/api/pos/checkout", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: {
        ...payload,
        createAppointments: payload.createAppointments ?? true,
        appointmentId: payload.appointmentId ?? null,
        receiptFormatOverride: payload.receiptFormatOverride ?? null,
        items: cart.value.map((item) => {
          if (item.itemType === "product") {
            return {
              itemType: "product",
              productId: item.productId,
              quantity: item.quantity,
            };
          }

          return {
            itemType: "service",
            serviceId: item.serviceId,
            employeeId: item.employeeId,
            scheduledDate: item.scheduledDate,
            scheduledTime: item.scheduledTime,
            quantity: 1,
          };
        }),
      },
    });

    clearCart();
    return response.receipt;
  };

  const loadTransactions = async (
    date: string,
    branchId?: string | null,
  ): Promise<POSTransactionHistoryItem[]> => {
    await ensureProfile();

    const response = await $fetch<{ transactions: POSTransactionHistoryItem[] }>("/api/pos/transactions", {
      headers: await getAuthHeaders(),
      query: {
        date,
        branchId: branchId ?? undefined,
      },
    });

    return response.transactions ?? [];
  };

  const loadReceipt = async (transactionId: string): Promise<POSReceipt> => {
    await ensureProfile();

    const response = await $fetch<{ receipt: POSReceipt }>(`/api/pos/transactions/${transactionId}`, {
      headers: await getAuthHeaders(),
    });

    return response.receipt;
  };

  const loadAppointmentForPOS = async (appointmentId: string) => {
    await ensureProfile();

    const response = await $fetch<{
      appointment: {
        id: string;
        branchId: string;
        branchName: string;
        employeeId: string;
        employeeName: string;
        serviceId: string;
        serviceName: string;
        serviceDurationMinutes: number;
        servicePrice: number;
        customerId: string | null;
        customerName: string;
        customerPhone: string | null;
        isWalkIn: boolean;
        startTime: string;
        endTime: string;
        status: string;
        notes: string | null;
      };
    }>(`/api/appointments/${appointmentId}`, {
      headers: await getAuthHeaders(),
    });

    const apt = response.appointment;
    const startDateTime = new Date(apt.startTime);
    const dateStr = startDateTime.toISOString().slice(0, 10);
    const timeStr = startDateTime.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    appointmentContext.value = {
      appointmentId: apt.id,
      customerName: apt.customerName,
      serviceName: apt.serviceName,
      employeeName: apt.employeeName,
      dateTime: apt.startTime,
    };

    cart.value = [
      {
        id: createCartItemId(),
        itemType: "service",
        serviceId: apt.serviceId,
        name: apt.serviceName,
        quantity: 1,
        unitPrice: apt.servicePrice,
        subtotal: roundCurrency(apt.servicePrice),
        branchId: apt.branchId,
        employeeId: apt.employeeId,
        employeeName: apt.employeeName,
        scheduledDate: dateStr,
        scheduledTime: timeStr,
        durationMinutes: apt.serviceDurationMinutes,
        categoryName: null,
      },
    ];

    return {
      branchId: apt.branchId,
      customerId: apt.customerId,
      customerName: apt.customerName,
      customerPhone: apt.customerPhone,
      isWalkIn: apt.isWalkIn,
    };
  };

  const canEmployeeDeliverService = (
    employee: POSEmployeeItem,
    serviceId: string,
    branchId: string,
  ) => {
    const operatesInBranch = employee.branchId === branchId || employee.assignedBranchIds.includes(branchId);
    if (!operatesInBranch) {
      return false;
    }

    if (employee.serviceIds.length === 0) {
      return true;
    }

    return employee.serviceIds.includes(serviceId);
  };

  return {
    cart,
    lastCatalog,
    appointmentContext,
    hydrateCart,
    loadCatalog,
    searchCustomers,
    createPOSCustomer,
    addProductToCart,
    addServiceToCart,
    updateProductQuantity,
    removeCartItem,
    clearCart,
    replaceCartFromSalesOrderItems,
    getCartSubtotal,
    getDiscountAmountPreview,
    getCheckoutPreview,
    checkout,
    loadTransactions,
    loadReceipt,
    loadAppointmentForPOS,
    canEmployeeDeliverService,
  };
};

