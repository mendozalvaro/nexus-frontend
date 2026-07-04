import { createClient } from "@supabase/supabase-js";
import { createError, getHeader, readBody } from "h3";
import { z } from "zod";

import type { H3Event } from "h3";

import type { Database, Json } from "@/types/database.types";
import type { ReceiptFormat } from "../services/receipts/verification";
import { buildReceiptVerificationUrl, sanitizeReceiptFormat } from "../services/receipts/verification";
import { assertTenantModuleAccess, type TenantModuleAction } from "./tenant-module-access";

type UserRole = Database["public"]["Enums"]["user_role"];
type PaymentMethod = Database["public"]["Enums"]["payment_method"];
type BranchRow = Database["public"]["Tables"]["branches"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type InventoryStockRow = Database["public"]["Tables"]["inventory_stock"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["employee_branch_assignments"]["Row"];
type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];
type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"];

type AdminClient = ReturnType<typeof createClient<Database>>;

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const ACTIVE_APPOINTMENT_STATUSES: Database["public"]["Enums"]["appointment_status"][] = ["pending", "confirmed", "in_progress"];

const existingCustomerSchema = z.object({
  mode: z.literal("existing"),
  customerId: z.string().uuid("El cliente seleccionado es invÃ¡lido."),
});

const walkInCustomerSchema = z.object({
  mode: z.literal("walk_in"),
  fullName: z.string().trim().min(3, "El nombre del cliente es obligatorio."),
  phone: z.string().trim().min(7, "El telÃ©fono del cliente es obligatorio."),
});

const customerSchema = z.union([existingCustomerSchema, walkInCustomerSchema]);

const productItemSchema = z.object({
  itemType: z.literal("product"),
  productId: z.string().uuid("El producto seleccionado es invÃ¡lido."),
  quantity: z.number().int("La cantidad debe ser entera.").positive("La cantidad debe ser mayor a cero."),
});

const serviceItemSchema = z.object({
  itemType: z.literal("service"),
  serviceId: z.string().uuid("El servicio seleccionado es invÃ¡lido."),
  employeeId: z.string().uuid("El colaborador seleccionado es invÃ¡lido."),
  scheduledDate: z.string().regex(LOCAL_DATE_PATTERN, "La fecha del servicio es invÃ¡lida."),
  scheduledTime: z.string().regex(LOCAL_TIME_PATTERN, "La hora del servicio es invÃ¡lida."),
  quantity: z.number().int().positive().default(1),
}).superRefine((value, context) => {
  if (value.quantity !== 1) {
    context.addIssue({
      code: "custom",
      path: ["quantity"],
      message: "Cada servicio debe venderse con una sola agenda por Ã­tem.",
    });
  }
});

const discountSchema = z.object({
  type: z.enum(["none", "percentage", "fixed"]),
  value: z.number().min(0, "El descuento no puede ser negativo.").default(0),
});

export const checkoutSchema = z.object({
  branchId: z.string().uuid("La sucursal seleccionada es invÃ¡lida."),
  customer: customerSchema,
  paymentMethod: z.enum(["cash", "card", "transfer", "mixed", "digital_wallet"] satisfies PaymentMethod[]),
  discount: discountSchema,
  note: z.string().trim().max(240, "La nota no puede superar 240 caracteres.").optional().default(""),
  items: z.array(z.union([productItemSchema, serviceItemSchema])).min(1, "Debes agregar al menos un producto o servicio al carrito."),
  createAppointments: z.boolean().optional().default(true),
  appointmentId: z.string().uuid().optional().nullable(),
  receiptFormatOverride: z.enum(["thermal", "half_letter"]).optional().nullable(),
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
  formatUsed: ReceiptFormat;
  verificationUrl: string;
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
      statusMessage: "No se recibiÃ³ un token de autenticaciÃ³n vÃ¡lido.",
    });
  }

  return header.slice("Bearer ".length);
};

const getSupabaseServerConfig = (event: H3Event) => {
  const config = useRuntimeConfig(event);
  const url = process.env.NUXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = config.supabaseServiceRoleKey as string | undefined;

  if (!url || !anonKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "La configuraciÃ³n pÃºblica de Supabase estÃ¡ incompleta.",
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

const toDateTimeIso = (date: string, time: string): string => {
  const parsed = new Date(`${date}T${time}:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw createError({
      statusCode: 400,
      statusMessage: "La fecha u hora del servicio es invÃ¡lida.",
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

  const authClient = createClient<Database, "public">(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    throw createError({
      statusCode: 401,
      statusMessage: "No se pudo validar la sesiÃ³n del usuario.",
    });
  }

  const adminClient = createClient<Database, "public">(url, serviceRoleKey, {
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

  let allowedBranchIds: string[] = [];

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

    const uniqueBranchIds = new Set<string>();
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

export const requirePOSContextStrict = async (
  event: H3Event,
  action: TenantModuleAction = "can_view",
): Promise<POSContext> => {
  const context = await requirePOSContext(event);

  await assertTenantModuleAccess({
    adminClient: context.adminClient,
    organizationId: context.organizationId,
    role: context.role,
    roleId: context.profile.role_id,
    moduleKey: "pos.sales",
    action,
  });

  return context;
};

export const assertPOSModuleAccess = async (
  context: POSContext,
  action: TenantModuleAction,
) => {
  await assertTenantModuleAccess({
    adminClient: context.adminClient,
    organizationId: context.organizationId,
    role: context.role,
    roleId: context.profile.role_id,
    moduleKey: "pos.sales",
    action,
  });
};

export const readValidatedPOSBody = async <T>(event: H3Event, schema: z.ZodSchema<T>): Promise<T> => {
  const body = await readBody(event);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? "Payload invÃ¡lido.",
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
      statusMessage: "La sucursal seleccionada no estÃ¡ disponible para tu organizaciÃ³n.",
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
    .in("role", ["admin", "manager", "employee"] satisfies UserRole[])
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
      statusMessage: "El colaborador seleccionado no estÃ¡ disponible.",
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
      statusMessage: "El servicio seleccionado no estÃ¡ disponible.",
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
      statusMessage: "El producto seleccionado no estÃ¡ disponible.",
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
  const employeePrimaryBranchId = assignments.find((assignment) => assignment.is_primary)?.branch_id
    ?? null;
  const operatesInBranch = employeePrimaryBranchId === branchId || Boolean(assignmentForBranch);

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
  excludeAppointmentId?: string | null,
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

  const conflicts = (data ?? []).filter((apt) => apt.id !== excludeAppointmentId);

  if (conflicts.length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: "El colaborador ya tiene una cita asignada que se solapa con ese horario.",
    });
  }
};

export const getCustomerOrThrow = async (
  context: POSContext,
  customerId: string,
): Promise<ClientRow> => {
  const { data, error } = await context.adminClient
    .from("client_org")
    .select("client_id, status, clients!inner(*)")
    .eq("organization_id", context.organizationId)
    .eq("client_id", customerId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo validar el cliente seleccionado.",
    });
  }

  const row = data as unknown as { clients: ClientRow | null } | null;
  if (!row?.clients) {
    throw createError({
      statusCode: 404,
      statusMessage: "El cliente seleccionado no estÃ¡ disponible para la venta.",
    });
  }

  return row.clients;
};

export const getPOSAnonymousTemplateCustomerOrThrow = async (
  context: POSContext,
): Promise<ClientRow> => {
  const { data, error } = await context.adminClient
    .from("client_org")
    .select("client_id, clients!inner(*)")
    .eq("organization_id", context.organizationId)
    .eq("status", "active")
    .eq("is_anonymous_template", true)
    .maybeSingle();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo resolver el cliente anónimo template de la organización.",
    });
  }

  const row = data as unknown as { clients: ClientRow | null } | null;
  if (!row?.clients) {
    throw createError({
      statusCode: 409,
      statusMessage: "La organización no tiene un cliente anónimo template activo configurado.",
    });
  }

  return row.clients;
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
      statusMessage: "No se pudieron cargar las categorÃ­as del POS.",
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
      statusMessage: "No se encontrÃ³ la transacciÃ³n solicitada para el recibo.",
    });
  }

  if (!context.allowedBranchIds.includes(transaction.branch_id) && context.role !== "admin") {
    throw createError({
      statusCode: 403,
      statusMessage: "No tienes acceso a esta transacciÃ³n para reimprimir el recibo.",
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
        .from("clients")
        .select("id, first_name, last_name, phone, email")
        .eq("id", transaction.customer_id)
        .maybeSingle<Pick<ClientRow, "id" | "first_name" | "last_name" | "phone" | "email">>()
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
      fullName: typeof customerRecord.fullName === "string" ? customerRecord.fullName : "Cliente",
      phone: typeof customerRecord.phone === "string" ? customerRecord.phone : null,
      email: typeof customerRecord.email === "string" ? customerRecord.email : null,
    } satisfies CustomerSnapshot;
  })();

  const resolvedCustomer: CustomerSnapshot = parsedCustomerFromSnapshot
    ?? (customer
      ? {
          mode: "existing",
          customerId: customer.id,
          fullName: [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() || "Cliente",
          phone: customer.phone,
          email: customer.email,
        }
      : {
          mode: "walk_in",
          customerId: null,
          fullName: "Cliente walk-in",
          phone: null,
        });

  const formatFromSnapshot = (() => {
    const firstSnapshot = (items ?? [])[0]?.snapshot_data;
    if (!firstSnapshot || typeof firstSnapshot !== "object" || Array.isArray(firstSnapshot)) {
      return null;
    }
    const snapshotRecord = firstSnapshot as Record<string, Json>;
    const raw = typeof snapshotRecord.receiptFormatUsed === "string" ? snapshotRecord.receiptFormatUsed : null;
    return sanitizeReceiptFormat(raw);
  })();

  const formatUsed: ReceiptFormat = formatFromSnapshot ?? "thermal";

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
    formatUsed,
    verificationUrl: buildReceiptVerificationUrl(transaction.id),
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

export const buildAppointmentInsert = (
  context: POSContext,
  branchId: string,
  customerId: string | null,
  customerName: string | null,
  customerPhone: string | null,
  employeeId: string,
  serviceId: string,
  startIso: string,
  endIso: string,
  notes?: string,
): Database["public"]["Tables"]["appointments"]["Insert"] => ({
  organization_id: context.organizationId,
  branch_id: branchId,
  customer_id: customerId,
  customer_name: customerName,
  customer_phone: customerPhone,
  employee_id: employeeId,
  service_id: serviceId,
  start_time: startIso,
  end_time: endIso,
  status: "confirmed",
  source: "pos_checkout",
  notes: notes ?? null,
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



