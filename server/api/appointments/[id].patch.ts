import {
  assertAppointmentMutationScope,
  assertBranchScope,
  assertEmployeeCanDeliverAppointmentService,
  assertEmployeeSelectionAllowed,
  assertRoleAccess,
  buildAppointmentWindow,
  getAppointmentBranchOrThrow,
  getAppointmentEmployeeOrThrow,
  getAppointmentOrThrow,
  getAppointmentServiceOrThrow,
  insertAuditLog,
  mapAppointmentMutationError,
  readValidatedAppointmentBody,
  requireAppointmentContext,
  updateAppointmentSchema,
  validateEmployeeAvailability,
} from "../../utils/appointments";

export default defineEventHandler(async (event) => {
  const appointmentId = getRouterParam(event, "id");
  if (!appointmentId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Debes indicar la cita a actualizar.",
    });
  }

  const context = await requireAppointmentContext(event);
  const body = await readValidatedAppointmentBody(event, updateAppointmentSchema);

  assertRoleAccess(context, ["admin", "manager", "employee", "client"]);

  const appointment = await getAppointmentOrThrow(context, appointmentId);
  await assertAppointmentMutationScope(context, appointment);

  if (appointment.status === "completed" || appointment.status === "cancelled") {
    throw createError({
      statusCode: 409,
      statusMessage: "No puedes editar una cita ya completada o cancelada.",
    });
  }

  const branch = await getAppointmentBranchOrThrow(context, body.branchId);
  const service = await getAppointmentServiceOrThrow(context, body.serviceId);
  const employee = await getAppointmentEmployeeOrThrow(context, body.employeeId);

  await assertBranchScope(context, branch.id);
  assertEmployeeSelectionAllowed(context, employee.id);
  await assertEmployeeCanDeliverAppointmentService(context, employee, service, branch.id);

  const { startIso, endIso } = buildAppointmentWindow(body.date, body.startTimeLocal, service.duration_minutes);
  await validateEmployeeAvailability(context, employee.id, startIso, endIso, appointment.id);

  try {
    const { error } = await context.adminClient
      .from("appointments")
      .update({
        branch_id: branch.id,
        employee_id: employee.id,
        service_id: service.id,
        start_time: startIso,
        end_time: endIso,
        notes: body.notes.trim() || null,
        status: body.status ?? appointment.status,
      })
      .eq("id", appointment.id)
      .eq("organization_id", context.organizationId);

    if (error) {
      throw error;
    }

    await insertAuditLog(context, {
      recordId: appointment.id,
      action: "UPDATE",
      event: "APPOINTMENT_UPDATED",
      oldData: {
        branchId: appointment.branch_id,
        employeeId: appointment.employee_id,
        serviceId: appointment.service_id,
        startTime: appointment.start_time,
        endTime: appointment.end_time,
        status: appointment.status,
      },
      newData: {
        branchId: branch.id,
        employeeId: employee.id,
        serviceId: service.id,
        startTime: startIso,
        endTime: endIso,
        status: body.status ?? appointment.status,
      },
    });

    return {
      success: true,
      appointmentId: appointment.id,
    };
  } catch (error) {
    return mapAppointmentMutationError(error, "No se pudo actualizar la cita.");
  }
});
