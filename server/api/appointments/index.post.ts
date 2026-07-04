import {
  assertBranchScope,
  assertAppointmentModuleAccess,
  assertEmployeeCanDeliverAppointmentService,
  assertEmployeeSelectionAllowed,
  assertRoleAccess,
  buildAppointmentWindow,
  createAppointmentSchema,
  getAppointmentBranchOrThrow,
  getAppointmentEmployeeOrThrow,
  resolveClientIdByUserOrThrow,
  getAppointmentServiceOrThrow,
  insertAuditLog,
  mapAppointmentMutationError,
  requireAppointmentContextStrict,
  validateEmployeeAvailability,
} from "../../utils/appointments";
import { sendAppointmentConfirmationNotification } from "../../utils/notifications";
import { createOrganizationCustomer } from "../../services/orgCustomers";

export default defineEventHandler(async (event) => {
  const context = await requireAppointmentContextStrict(event);
  await assertAppointmentModuleAccess(context, "can_create");
  const rawBody = await readBody<Record<string, unknown> | null>(event);
  const parsedBody = createAppointmentSchema.safeParse(rawBody);

  if (!parsedBody.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsedBody.error.issues[0]?.message ?? "Payload invÃ¡lido.",
    });
  }

  const body = parsedBody.data;
  const customerMode = rawBody && typeof rawBody === "object" && "customerMode" in rawBody && typeof rawBody.customerMode === "string"
    ? rawBody.customerMode
    : (body.walkIn ? "new" : "anonymous");
  const customerIdInput = rawBody && typeof rawBody === "object" && "customerId" in rawBody && typeof rawBody.customerId === "string"
    ? rawBody.customerId
    : null;
  const newCustomerInput = rawBody && typeof rawBody === "object" && "newCustomer" in rawBody && rawBody.newCustomer && typeof rawBody.newCustomer === "object"
    ? rawBody.newCustomer as {
        fullName?: string;
        lastName?: string | null;
        phone?: string | null;
        email?: string | null;
        billingName?: string | null;
        billingEmail?: string | null;
        billingPhone?: string | null;
        documentType?: "CI" | "NIT" | "Pasaporte" | "Otro" | null;
        documentNumber?: string | null;
      }
    : null;

  assertRoleAccess(context, ["admin", "manager", "employee", "client"]);

  if (context.role === "client" && (body.walkIn || customerMode !== "anonymous")) {
    throw createError({
      statusCode: 403,
      statusMessage: "Los clientes no pueden crear citas walk-in desde su portal.",
    });
  }

  const branch = await getAppointmentBranchOrThrow(context, body.branchId);
  const service = await getAppointmentServiceOrThrow(context, body.serviceId);
  const employee = await getAppointmentEmployeeOrThrow(context, body.employeeId);

  await assertBranchScope(context, branch.id);
  assertEmployeeSelectionAllowed(context, employee.id);
  await assertEmployeeCanDeliverAppointmentService(context, employee, service, branch.id);

  const { startIso, endIso } = buildAppointmentWindow(body.date, body.startTimeLocal, service.duration_minutes);
  await validateEmployeeAvailability(context, employee.id, startIso, endIso);

  let customerId: string | null = null;
  let customerName: string | null = null;
  let customerPhone: string | null = null;
  let guestCustomerId: string | null = null;

  if (context.role === "client") {
    customerId = await resolveClientIdByUserOrThrow(context, context.userId);
    customerName = context.profile.full_name;
    customerPhone = context.profile.phone;
  } else if (customerMode === "registered") {
    if (!customerIdInput) {
      throw createError({
        statusCode: 400,
        statusMessage: "Debes seleccionar un cliente registrado.",
      });
    }

    const { data: registeredLink, error: registeredError } = await context.adminClient
      .from("client_org")
      .select("client_id, clients!inner(first_name, last_name, phone)")
      .eq("organization_id", context.organizationId)
      .eq("client_id", customerIdInput)
      .eq("status", "active")
      .eq("is_anonymous_template", false)
      .maybeSingle();

    if (registeredError) {
      throw createError({
        statusCode: 500,
        statusMessage: "No se pudo validar el cliente registrado seleccionado.",
      });
    }

    const registeredClient = Array.isArray(registeredLink?.clients) ? registeredLink.clients[0] : registeredLink?.clients;

    if (!registeredLink || !registeredClient) {
      throw createError({
        statusCode: 404,
        statusMessage: "El cliente registrado seleccionado no estÃ¡ disponible.",
      });
    }

    customerId = registeredLink.client_id;
    customerName = [registeredClient.first_name, registeredClient.last_name].filter(Boolean).join(" ").trim() || "Cliente";
    customerPhone = registeredClient.phone;
  } else if (customerMode === "new") {
    if (!newCustomerInput?.fullName) {
      throw createError({
        statusCode: 400,
        statusMessage: "Debes indicar los datos del nuevo cliente.",
      });
    }

    const fullNameParts = newCustomerInput.fullName.trim().split(/\s+/).filter(Boolean);
    const [firstName, ...restLastName] = fullNameParts;
    const explicitLastName = newCustomerInput.lastName?.trim() ?? "";
    const resolvedLastName = explicitLastName || restLastName.join(" ");

    const created = await createOrganizationCustomer(context as never, {
      firstName: firstName || "Cliente",
      lastName: resolvedLastName || null,
      phone: newCustomerInput.phone?.trim() || null,
      email: newCustomerInput.email?.trim() || null,
      billingName: newCustomerInput.billingName?.trim() || null,
      billingEmail: newCustomerInput.billingEmail?.trim() || null,
      billingPhone: newCustomerInput.billingPhone?.trim() || null,
      documentType: newCustomerInput.documentType ?? null,
      documentNumber: newCustomerInput.documentNumber?.trim() || null,
    });

    const { data: createdClient, error: createdClientError } = await context.adminClient
      .from("clients")
      .select("id, first_name, last_name, phone")
      .eq("id", created.clientId)
      .maybeSingle();

    if (createdClientError || !createdClient) {
      throw createError({
        statusCode: 500,
        statusMessage: "No se pudo recuperar el cliente recien creado.",
      });
    }

    customerId = createdClient.id;
    guestCustomerId = createdClient.id;
    customerName = [createdClient.first_name, createdClient.last_name].filter(Boolean).join(" ").trim() || newCustomerInput.fullName.trim();
    customerPhone = createdClient.phone;
  } else {
    const { data: anonymousLink, error: anonymousError } = await context.adminClient
      .from("client_org")
      .select("client_id, clients!inner(first_name, last_name, phone)")
      .eq("organization_id", context.organizationId)
      .eq("status", "active")
      .eq("is_anonymous_template", true)
      .maybeSingle();

    if (anonymousError) {
      throw createError({
        statusCode: 500,
        statusMessage: "No se pudo resolver el cliente anÃ³nimo de la organizaciÃ³n.",
      });
    }

    const anonymousClient = Array.isArray(anonymousLink?.clients) ? anonymousLink.clients[0] : anonymousLink?.clients;

    if (!anonymousLink || !anonymousClient) {
      throw createError({
        statusCode: 409,
        statusMessage: "La organizaciÃ³n no tiene configurado un cliente anÃ³nimo activo.",
      });
    }

    customerId = anonymousLink.client_id;
    customerName = [anonymousClient.first_name, anonymousClient.last_name].filter(Boolean).join(" ").trim() || "Cliente anÃ³nimo";
    customerPhone = anonymousClient.phone;
  }

  try {
    const { data, error } = await context.adminClient
      .from("appointments")
      .insert({
        organization_id: context.organizationId,
        branch_id: branch.id,
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: customerPhone,
        employee_id: employee.id,
        service_id: service.id,
        start_time: startIso,
        end_time: endIso,
        status: context.role === "client" ? "pending" : "confirmed",
        notes: body.notes.trim() || null,
      })
      .select("id")
      .single<{ id: string }>();

    if (error || !data) {
      throw error ?? new Error("No se pudo crear la cita.");
    }

    await insertAuditLog(context, {
      recordId: data.id,
      action: "INSERT",
      event: customerMode === "new" ? "APPOINTMENT_CREATED_WALK_IN" : "APPOINTMENT_CREATED",
      newData: {
        branchId: branch.id,
        employeeId: employee.id,
        serviceId: service.id,
        startTime: startIso,
        endTime: endIso,
        status: context.role === "client" ? "pending" : "confirmed",
      },
      extraContext: {
        reminder_channels: body.reminderChannels,
        guest_customer_id: guestCustomerId,
        customer_mode: customerMode,
      },
    });

    // Enviar notificacion de confirmacion de cita por WhatsApp (no bloqueante)
    if (customerPhone && context.organizationId) {
      const dateStr = new Date(startIso).toLocaleDateString("es-BO", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      const timeStr = new Date(startIso).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });

      sendAppointmentConfirmationNotification({
        organizationId: context.organizationId,
        customerName: customerName ?? "Cliente",
        customerPhone,
        serviceName: service.name,
        date: dateStr,
        time: timeStr,
        employeeName: employee.full_name ?? "Empleado",
        appointmentId: data.id,
      }).catch((err) => {
        console.error("[Appointments] WhatsApp confirmation notification failed:", err);
      });
    }

    return {
      success: true,
      appointmentId: data.id,
      guestCustomerId,
    };
  } catch (error) {
    return mapAppointmentMutationError(error, "No se pudo crear la cita.");
  }
});
