import {
  assertBranchScope,
  assertEmployeeCanDeliverAppointmentService,
  assertEmployeeSelectionAllowed,
  assertRoleAccess,
  buildAppointmentWindow,
  createAppointmentSchema,
  createAppointmentWalkInCustomer,
  getAppointmentBranchOrThrow,
  getAppointmentEmployeeOrThrow,
  resolveClientIdByUserOrThrow,
  getAppointmentServiceOrThrow,
  insertAuditLog,
  mapAppointmentMutationError,
  readValidatedAppointmentBody,
  requireAppointmentContext,
  validateEmployeeAvailability,
} from "../../utils/appointments";
import { sendAppointmentConfirmationNotification } from "../../utils/notifications";

export default defineEventHandler(async (event) => {
  const context = await requireAppointmentContext(event);
  const body = await readValidatedAppointmentBody(event, createAppointmentSchema);

  assertRoleAccess(context, ["admin", "manager", "employee", "client"]);

  if (context.role === "client" && body.walkIn) {
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
  } else if (body.walkIn) {
    const guest = await createAppointmentWalkInCustomer(context, body.walkIn);
    customerId = guest.id;
    guestCustomerId = guest.id;
    customerName = [guest.first_name, guest.last_name].filter(Boolean).join(" ").trim() || body.walkIn.fullName.trim();
    customerPhone = guest.phone;
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
      event: body.walkIn ? "APPOINTMENT_CREATED_WALK_IN" : "APPOINTMENT_CREATED",
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
