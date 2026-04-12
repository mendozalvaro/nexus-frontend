import {
  assertAppointmentMutationScope,
  assertRoleAccess,
  cancelAppointmentSchema,
  getAppointmentOrThrow,
  insertAuditLog,
  readValidatedAppointmentBody,
  requireAppointmentContext,
} from "../../../utils/appointments";

export default defineEventHandler(async (event) => {
  const appointmentId = getRouterParam(event, "id");
  if (!appointmentId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debes indicar la cita a cancelar.",
    });
  }

  const context = await requireAppointmentContext(event);
  const body = await readValidatedAppointmentBody(event, cancelAppointmentSchema);

  assertRoleAccess(context, ["admin", "manager", "employee", "client"]);

  const appointment = await getAppointmentOrThrow(context, appointmentId);
  await assertAppointmentMutationScope(context, appointment);

  if (appointment.status === "cancelled") {
    throw createError({
      statusCode: 409,
      statusMessage: "La cita ya está cancelada.",
    });
  }

  if (appointment.status === "completed") {
    throw createError({
      statusCode: 409,
      statusMessage: "No puedes cancelar una cita ya completada.",
    });
  }

  const { error } = await context.adminClient
    .from("appointments")
    .update({
      status: "cancelled",
      cancelled_by: context.userId,
      cancellation_reason: body.reason.trim(),
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
    event: "APPOINTMENT_CANCELLED",
    oldData: {
      status: appointment.status,
      cancellationReason: appointment.cancellation_reason,
    },
    newData: {
      status: "cancelled",
      cancellationReason: body.reason.trim(),
    },
    extraContext: {
      cancelled_by: context.userId,
    },
  });

  return {
    success: true,
    appointmentId: appointment.id,
  };
});
