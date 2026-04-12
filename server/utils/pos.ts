import { createClient } from "@supabase/supabase-js";
import { createError, getHeader, readBody } from "h3";
import { z } from "zod";

import type { H3Event } from "h3";

import type { Database, Json } from "@/types/database.types";

type UserRole = Database["public"]["Enums"]["user_role"];
type PaymentMethod = Database["public"]["Enums"]["payment_method"];
type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type InventoryStockRow = Database["public"]["Tables"]["inventory_stock"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["employee_branch_assignments"]["Row"];
type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];
type GuestCustomerRow = Database["public"]["Tables"]["guest_customers"]["Row"];
type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"];

type AdminClient = ReturnType<typeof createClient<Database>>;

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const ACTIVE_APPOINTMENT_STATUSES: Database["public"]["Enums"]["appointment_status"][] = ["pending", "confirmed", "in_progress"];

const existingCustomerSchema = z.object({
  mode: z.literal("existing"),
  customerId: z.string().uuid("El cliente seleccionado es inválido."),
});

const walkInCustomerSchema = z.object({
  mode: z.literal("walk_in"),
  fullName: z.string().trim().min(3, "El nombre del cliente es obligatorio."),
  phone: z.string().trim().min(7, "El teléfono del cliente es obligatorio."),
});

const customerSchema = z.union([existingCustomerSchema, walkInCustomerSchema]);

const productItemSchema = z.object({
  itemType: z.literal("product"),
  productId: z.string().uuid("El producto seleccionado es inválido."),
  quantity: z.number().int("La cantidad debe ser entera.").positive("La cantidad debe ser mayor a cero."),
});

const serviceItemSchema = z.object({
  itemType: z.literal("service"),
  serviceId: z.string().uuid("El servicio seleccionado es inválido."),
  employeeId: z.string().uuid("El colaborador seleccionado es inválido."),
  scheduledDate: z.string().regex(LOCAL_DATE_PATTERN, "La fecha del servicio es inválida."),
  scheduledTime: z.string().regex(LOCAL_TIME_PATTERN, "La hora del servicio es inválida."),
  quantity: z.number().int().positive().default(1),
}).superRefine((value, context) => {
  if (value.quantity !== 1) {
    context.addIssue({
      code: "custom",
      path: ["quantity"],
      message: "Cada servicio debe venderse con una sola agenda por ítem.",
    });
  }
});

const discountSchema = z.object({
  type: z.enum(["none", "percentage", "fixed"]),
  value: z.number().min(0, "El descuento no puede ser negativo.").default(0),
});

export const checkoutSchema = z.object({
  branchId: z.string().uuid("La sucursal seleccionada es inválida."),
  customer: customerSchema,
  paymentMethod: z.enum(["cash", "card", "transfer", "mixed", "digital_wallet"] satisfies PaymentMethod[]),
  discount: discountSchema,
  note: z.string().trim().max(240, "La nota no puede superar 240 caracteres.").optional().default(""),
  items: z.array(z.union([productItemSchema, serviceItemSchema])).min(1, "Debes agregar al menos un producto o servicio al carrito."),
});

export interface POSContext {
  adminClient: AdminClient;
  organizationId: string;
  userId: string;
  role: Exclude<UserRole, "client">;
  profile: ProfileRow & {
    organization_id: string;
    role: Exclude<UserRole, "client">;
  };
  allowedBranchIds: string[];
}

export interface CustomerSnapshot {
  mode: "existing" | "walk_in";
  customerId: string | null;
  guestCustomerId?: string | null;
  fullName: string;
  phone: string | null;
  email?: string | null;
}

export interface ReceiptLineItem {
  id: string;
  itemType: "product" | "service";
  quantity: number;
  unitPrice: number;
  subtotal: number;
  title: string;
  subtitle: string | null;
  snapshotData: Json | null;
}

export interface ReceiptPayload {
  transactionId: string;
  invoiceNumber: number;
  createdAt: string;
  branchId: string;
  branchName: string;
  employeeId: string;
  employeeName: string;
  customer: CustomerSnapshot;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  discountAmount: number;
  taxAmount: number;
  finalAmount: number;
  items: ReceiptLineItem[];
}

const roundCurrency = (value: number): number => {
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

const getBearerToken = (event: H3Event): string => {
  const header = getHeader(event, "authorization");
  if (!header?.startsWith("Bearer ")) {
    throw createError({
      statusCode: 401,
      statusMessage: "No se recibió un token de autenticación válido.",
    });
  }

  return header.slice("Bearer ".length);
};

const getSupabaseServerConfig = (event: H3Event) => {
  const config = useRuntimeConfig(event);
  const url = process.env.NUXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = config.supabaseServiceRoleKey;

  if (!url || !anonKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "La configuración pública de Supabase está incompleta.",
    });
  }

  if (!serviceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "Falta NUXT_SUPABASE_SERVICE_ROLE_KEY para operar el POS desde el servidor.",
    });
  }

  return { url, anonKey, serviceRoleKey };
};

const parseSkills = (value: Json | null): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
};

const sanitizeNullableString = (value: string | null | undefined): string | null => {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
};

const toDateTimeIso = (date: string, time: string): string => {
  const parsed = new Date(`${date}T${time}:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw createError({
      statusCode: 400,
      statusMessage: "La fecha u hora del servicio es inválida.",
    });
  }

  return parsed.toISOString();
};

const ensureStaffRole = (role: UserRole | null): Exclude<UserRole, "client"> => {
  if (role === "admin" || role === "manager" || role === "employee") {
    return role;
  }

  throw createError({
    statusCode: 403,
    statusMessage: "Solo personal operativo puede acceder al POS.",
  });
};

export const requirePOSContext = async (event: H3Event): Promise<POSContext> => {
  const { url, anonKey, serviceRoleKey } = getSupabaseServerConfig(event);
  const token = getBearerToken(event);

  const authClient = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    throw createError({
      statusCode: 401,
      statusMessage: "No se pudo validar la sesión del usuario.",
    });
  }

  const adminClient = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("*")
    .eq("id", authData.user.id)
    .maybeSingle<ProfileRow>();

  if (profileError || !profile?.organization_id || profile.is_active === false) {
    throw createError({
      statusCode: 403,
      statusMessage: "No se pudo validar el perfil operativo para el POS.",
    });
  }

  const role = ensureStaffRole(profile.role);

  let allowedBranchIds = profile.branch_id ? [profile.branch_id] : [];

  if (role === "admin") {
    const { data: branches, error: branchesError } = await adminClient
      .from("branches")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true);

    if (branchesError) {
      throw createError({
        statusCode: 500,
        statusMessage: "No se pudieron cargar las sucursales accesibles para el POS.",
      });
    }

    allowedBranchIds = (branches ?? []).map((branch) => branch.id);
  } else {
    const { data: assignments, error: assignmentsError } = await adminClient
      .from("employee_branch_assignments")
      .select("branch_id")
      .eq("user_id", profile.id);

    if (assignmentsError) {
      throw createError({
        statusCode: 500,
        statusMessage: "No se pudieron cargar las sucursales asignadas para el POS.",
      });
    }

    const uniqueBranchIds = new Set<string>(allowedBranchIds);
    for (const assignment of assignments ?? []) {
      uniqueBranchIds.add(assignment.branch_id);
    }

    allowedBranchIds = Array.from(uniqueBranchIds);
  }

  return {
    adminClient,
    organizationId: profile.organization_id,
    userId: profile.id,
    role,
    profile: {
      ...profile,
      organization_id: profile.organization_id,
      role,
    },
    allowedBranchIds,
  };
};

export const readValidatedPOSBody = async <T>(event: H3Event, schema: z.ZodSchema<T>): Promise<T> => {
  const body = await readBody(event);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Payload inválido.",
    });
  }

  return parsed.data;
};

export const getPOSBranchOrThrow = async (context: POSContext, branchId: string): Promise<BranchRow> => {
  const { data, error } = await context.adminClient
    .from("branches")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("id", branchId)
    .eq("is_active", true)
    .maybeSingle<BranchRow>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar la sucursal seleccionada.",
    });
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: "La sucursal seleccionada no está disponible para tu organización.",
    });
  }

  return data;
};

export const assertBranchAccess = (context: POSContext, branchId: string) => {
  if (!context.allowedBranchIds.includes(branchId)) {
    throw createError({
      statusCode: 403,
      statusMessage: "No tienes acceso operativo a la sucursal seleccionada para vender.",
    });
  }
};

export const getPOSEmployeeOrThrow = async (
  context: POSContext,
  employeeId: string,
): Promise<ProfileRow> => {
  const { data, error } = await context.adminClient
    .from("profiles")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("id", employeeId)
    .in("role", ["manager", "employee"] satisfies UserRole[])
    .eq("is_active", true)
    .maybeSingle<ProfileRow>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar al colaborador seleccionado.",
    });
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: "El colaborador seleccionado no está disponible.",
    });
  }

  return data;
};

export const getPOSServiceOrThrow = async (
  context: POSContext,
  serviceId: string,
): Promise<ServiceRow> => {
  const { data, error } = await context.adminClient
    .from("services")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("id", serviceId)
    .eq("is_active", true)
    .maybeSingle<ServiceRow>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar el servicio seleccionado.",
    });
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: "El servicio seleccionado no está disponible.",
    });
  }

  return data;
};

export const getProductOrThrow = async (
  context: POSContext,
  productId: string,
): Promise<ProductRow> => {
  const { data, error } = await context.adminClient
    .from("products")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("id", productId)
    .eq("is_active", true)
    .maybeSingle<ProductRow>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar el producto seleccionado.",
    });
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: "El producto seleccionado no está disponible.",
    });
  }

  return data;
};

const getEmployeeAssignments = async (
  context: POSContext,
  employeeId: string,
): Promise<AssignmentRow[]> => {
  const { data, error } = await context.adminClient
    .from("employee_branch_assignments")
    .select("*")
    .eq("user_id", employeeId)
    .returns<AssignmentRow[]>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudieron validar las asignaciones del colaborador.",
    });
  }

  return data ?? [];
};

export const assertEmployeeCanDeliverService = async (
  context: POSContext,
  employee: ProfileRow,
  service: ServiceRow,
  branchId: string,
) => {
  const assignments = await getEmployeeAssignments(context, employee.id);
  const assignmentForBranch = assignments.find((assignment) => assignment.branch_id === branchId) ?? null;
  const operatesInBranch = employee.branch_id === branchId || Boolean(assignmentForBranch);

  if (!operatesInBranch) {
    throw createError({
      statusCode: 409,
      statusMessage: "El colaborador seleccionado no opera en la sucursal indicada.",
    });
  }

  const skills = parseSkills(assignmentForBranch?.skills ?? null);
  if (skills.length > 0 && !skills.includes(service.id)) {
    throw createError({
      statusCode: 409,
      statusMessage: "El colaborador seleccionado no tiene permiso para prestar ese servicio.",
    });
  }
};

export const validateServiceAvailability = async (
  context: POSContext,
  employeeId: string,
  startIso: string,
  endIso: string,
) => {
  const { data, error } = await context.adminClient
    .from("appointments")
    .select("id, start_time, end_time, status")
    .eq("organization_id", context.organizationId)
    .eq("employee_id", employeeId)
    .in("status", ACTIVE_APPOINTMENT_STATUSES)
    .lt("start_time", endIso)
    .gt("end_time", startIso)
    .limit(1)
    .returns<Pick<AppointmentRow, "id" | "start_time" | "end_time" | "status">[]>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar la disponibilidad del colaborador para el servicio.",
    });
  }

  if ((data ?? []).length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: "El colaborador ya tiene una cita asignada que se solapa con ese horario.",
    });
  }
};

export const getCustomerOrThrow = async (
  context: POSContext,
  customerId: string,
): Promise<ProfileRow> => {
  const { data, error } = await context.adminClient
    .from("profiles")
    .select("*")
    .eq("id", customerId)
    .eq("role", "client")
    .eq("is_active", true)
    .or(`organization_id.eq.${context.organizationId},organization_id.is.null`)
    .maybeSingle<ProfileRow>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar el cliente seleccionado.",
    });
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: "El cliente seleccionado no está disponible para la venta.",
    });
  }

  return data;
};

export const createPOSGuestCustomer = async (
  context: POSContext,
  branchId: string,
  payload: z.output<typeof walkInCustomerSchema>,
): Promise<GuestCustomerRow> => {
  const { data, error } = await context.adminClient
    .from("guest_customers")
    .insert({
      organization_id: context.organizationId,
      branch_id: branchId,
      created_by: context.userId,
      full_name: payload.fullName.trim(),
      phone: sanitizeNullableString(payload.phone),
      notes: null,
    })
    .select("*")
    .single<GuestCustomerRow>();

  if (error || !data) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo registrar el cliente walk-in para la venta.",
    });
  }

  return data;
};

export const getInventoryForBranch = async (
  context: POSContext,
  branchId: string,
  productIds: string[],
): Promise<Map<string, InventoryStockRow>> => {
  if (productIds.length === 0) {
    return new Map<string, InventoryStockRow>();
  }

  const { data, error } = await context.adminClient
    .from("inventory_stock")
    .select("*")
    .eq("branch_id", branchId)
    .in("product_id", productIds)
    .returns<InventoryStockRow[]>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar el stock disponible para la venta.",
    });
  }

  return new Map((data ?? []).map((item) => [item.product_id, item]));
};

export const computeDiscountAmount = (
  subtotal: number,
  discount: z.output<typeof discountSchema>,
): number => {
  if (discount.type === "none" || discount.value <= 0) {
    return 0;
  }

  if (discount.type === "percentage") {
    return roundCurrency(Math.min(subtotal, subtotal * (discount.value / 100)));
  }

  return roundCurrency(Math.min(subtotal, discount.value));
};

export const getCategoriesMap = async (
  context: POSContext,
): Promise<Map<string, CategoryRow>> => {
  const { data, error } = await context.adminClient
    .from("categories")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("is_active", true)
    .returns<CategoryRow[]>();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudieron cargar las categorías del POS.",
    });
  }

  return new Map((data ?? []).map((category) => [category.id, category]));
};

export const buildReceiptFromTransaction = async (
  context: POSContext,
  transactionId: string,
): Promise<ReceiptPayload> => {
  const { data: transaction, error: transactionError } = await context.adminClient
    .from("transactions")
    .select("*")
    .eq("organization_id", context.organizationId)
    .eq("id", transactionId)
    .maybeSingle();

  if (transactionError || !transaction) {
    throw createError({
      statusCode: 404,
      statusMessage: "No se encontró la transacción solicitada para el recibo.",
    });
  }

  if (!context.allowedBranchIds.includes(transaction.branch_id) && context.role !== "admin") {
    throw createError({
      statusCode: 403,
      statusMessage: "No tienes acceso a esta transacción para reimprimir el recibo.",
    });
  }

  const [{ data: items, error: itemsError }, { data: branch, error: branchError }, { data: employee, error: employeeError }, { data: customer, error: customerError }] = await Promise.all([
    context.adminClient
      .from("transaction_items")
      .select("*")
      .eq("transaction_id", transaction.id)
      .returns<Database["public"]["Tables"]["transaction_items"]["Row"][]>(),
    context.adminClient
      .from("branches")
      .select("id, name")
      .eq("id", transaction.branch_id)
      .maybeSingle<Pick<BranchRow, "id" | "name">>(),
    context.adminClient
      .from("profiles")
      .select("id, full_name")
      .eq("id", transaction.employee_id)
      .maybeSingle<Pick<ProfileRow, "id" | "full_name">>(),
    transaction.customer_id
      ? context.adminClient
        .from("profiles")
        .select("id, full_name, phone, email")
        .eq("id", transaction.customer_id)
        .maybeSingle<Pick<ProfileRow, "id" | "full_name" | "phone" | "email">>()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const firstError = itemsError ?? branchError ?? employeeError ?? customerError;
  if (firstError) {
    throw createError({
      statusCode: 500,
      statusMessage: firstError.message,
    });
  }

  const parsedCustomerFromSnapshot = (() => {
    const firstSnapshot = (items ?? [])[0]?.snapshot_data;
    if (!firstSnapshot || typeof firstSnapshot !== "object" || Array.isArray(firstSnapshot)) {
      return null;
    }

    const customerValue = (firstSnapshot as Record<string, Json>).customer;
    if (!customerValue || typeof customerValue !== "object" || Array.isArray(customerValue)) {
      return null;
    }

    const customerRecord = customerValue as Record<string, Json>;
    return {
      mode: customerRecord.mode === "walk_in" ? "walk_in" : "existing",
      customerId: typeof customerRecord.customerId === "string" ? customerRecord.customerId : null,
      guestCustomerId: typeof customerRecord.guestCustomerId === "string" ? customerRecord.guestCustomerId : null,
      fullName: typeof customerRecord.fullName === "string" ? customerRecord.fullName : "Cliente",
      phone: typeof customerRecord.phone === "string" ? customerRecord.phone : null,
      email: typeof customerRecord.email === "string" ? customerRecord.email : null,
    } satisfies CustomerSnapshot;
  })();

  const resolvedCustomer: CustomerSnapshot = customer
    ? {
        mode: "existing",
        customerId: customer.id,
        fullName: customer.full_name,
        phone: customer.phone,
        email: customer.email,
      }
    : parsedCustomerFromSnapshot ?? {
        mode: "walk_in",
        customerId: null,
        fullName: "Cliente walk-in",
        phone: null,
      };

  return {
    transactionId: transaction.id,
    invoiceNumber: transaction.invoice_number,
    createdAt: transaction.created_at ?? new Date().toISOString(),
    branchId: transaction.branch_id,
    branchName: branch?.name ?? "Sucursal",
    employeeId: transaction.employee_id,
    employeeName: employee?.full_name ?? "Equipo",
    customer: resolvedCustomer,
    paymentMethod: transaction.payment_method ?? "cash",
    totalAmount: Number(transaction.total_amount ?? 0),
    discountAmount: Number(transaction.discount_amount ?? 0),
    taxAmount: Number(transaction.tax_amount ?? 0),
    finalAmount: Number(transaction.final_amount ?? 0),
    items: (items ?? []).map((item) => {
      const snapshotObject = item.snapshot_data && typeof item.snapshot_data === "object" && !Array.isArray(item.snapshot_data)
        ? item.snapshot_data as Record<string, Json>
        : null;

      const title = typeof snapshotObject?.title === "string"
        ? snapshotObject.title
        : item.item_type === "product"
          ? "Producto"
          : "Servicio";

      const subtitle = typeof snapshotObject?.subtitle === "string"
        ? snapshotObject.subtitle
        : null;

      return {
        id: item.id,
        itemType: item.item_type as "product" | "service",
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        subtotal: Number(item.subtotal),
        title,
        subtitle,
        snapshotData: item.snapshot_data,
      };
    }),
  };
};

export const mapPOSError = (error: unknown, fallbackMessage: string): never => {
  const message = error instanceof Error ? error.message : fallbackMessage;
  const knownConflict = typeof message === "string" && (
    message.includes("stock")
    || message.includes("solapa")
    || message.includes("permiso")
    || message.includes("no opera")
  );

  throw createError({
    statusCode: knownConflict ? 409 : 500,
    statusMessage: message,
  });
};

export const buildServiceWindow = (scheduledDate: string, scheduledTime: string, durationMinutes: number) => {
  const startIso = toDateTimeIso(scheduledDate, scheduledTime);
  const startDate = new Date(startIso);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60_000);

  return {
    startIso,
    endIso: endDate.toISOString(),
  };
};

export const buildTransactionInsert = (
  context: POSContext,
  branchId: string,
  customerId: string | null,
  totalAmount: number,
  discountAmount: number,
  finalAmount: number,
  paymentMethod: PaymentMethod,
): TransactionInsert => ({
  organization_id: context.organizationId,
  branch_id: branchId,
  customer_id: customerId,
  employee_id: context.userId,
  total_amount: roundCurrency(totalAmount),
  discount_amount: roundCurrency(discountAmount),
  tax_amount: 0,
  final_amount: roundCurrency(finalAmount),
  payment_method: paymentMethod,
  type: "sale",
  status: "completed",
});

export const withTitleAndSubtitle = (
  itemType: "product" | "service",
  values: {
    title: string;
    subtitle: string | null;
    customer: CustomerSnapshot;
    extra: Record<string, Json>;
  },
): Json => ({
  itemType,
  title: values.title,
  subtitle: values.subtitle,
  customer: values.customer as unknown as Json,
  ...values.extra,
});
