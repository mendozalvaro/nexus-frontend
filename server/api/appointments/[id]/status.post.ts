import {
  assertAppointmentMutationScope,
  assertRoleAccess,
  getAppointmentOrThrow,
  insertAuditLog,
  readValidatedAppointmentBody,
  requireAppointmentContext,
  updateAppointmentStatusSchema,
} from "../../../utils/appointments";
import { sendAppointmentStatusChangeNotification } from "../../../utils/notifications";

export default defineEventHandler(async (event) => {
  const appointmentId = getRouterParam(event, "id");
  if (!appointmentId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debes indicar la cita a actualizar.",
    });
  }

  const context = await requireAppointmentContext(event);
  const body = await readValidatedAppointmentBody(event, updateAppointmentStatusSchema);

  assertRoleAccess(context, ["admin", "manager", "employee"]);

  const appointment = await getAppointmentOrThrow(context, appointmentId);
  await assertAppointmentMutationScope(context, appointment);

  const nextStatus = body.status;
  const currentStatus = appointment.status ?? "pending";

  const isValidTransition =
    ((currentStatus === "pending" || currentStatus === "confirmed") && nextStatus === "in_progress")
    || (currentStatus === "in_progress" && nextStatus === "completed")
    || (currentStatus === "pending" || currentStatus === "confirmed") && nextStatus === "no_show";

  if (!isValidTransition) {
    throw createError({
      statusCode: 409,
      statusMessage: "La transición de estado solicitada no es válida para esta cita.",
    });
  }

  const { error } = await context.adminClient
    .from("appointments")
    .update({
      status: nextStatus,
    })
    .eq("id", appointment.id)
    .eq("organization_id", context.organizationId);

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    });
  }

  await insertAuditLog(context, {
    recordId: appointment.id,
    action: "UPDATE",
    event: "APPOINTMENT_STATUS_UPDATED",
    oldData: {
      status: currentStatus,
    },
    newData: {
      status: nextStatus,
    },
  });

  // Enviar notificacion de cambio de estado por WhatsApp (no bloqueante)
  const customerPhone = appointment.customer_phone;
  if (customerPhone && context.organizationId) {
    const dateStr = new Date(appointment.start_time).toLocaleDateString("es-BO", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const timeStr = new Date(appointment.start_time).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });

    sendAppointmentStatusChangeNotification({
      organizationId: context.organizationId,
      customerName: appointment.customer_name ?? "Cliente",
      customerPhone,
      serviceName: appointment.service_id ?? "Servicio",
      date: dateStr,
      time: timeStr,
      employeeName: appointment.employee_id ?? "Empleado",
      appointmentId: appointment.id,
      status: nextStatus,
    }).catch((err) => {
      console.error("[Appointments] WhatsApp status change notification failed:", err);
    });
  }

  return {
    success: true,
    appointmentId: appointment.id,
    status: nextStatus,
  };
});
