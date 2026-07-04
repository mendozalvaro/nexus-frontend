import {
  assertAppointmentMutationScope,
  getAppointmentOrThrow,
  requireAppointmentContextStrict,
} from "../../utils/appointments";

import type { H3Event } from "h3";

export interface AppointmentDetailResult {
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
  status: string | null;
  notes: string | null;
  transactionId: string | null;
}

export async function getAppointmentDetail(
  event: H3Event,
  appointmentId: string,
): Promise<AppointmentDetailResult> {
  const context = await requireAppointmentContextStrict(event);
  const appointment = await getAppointmentOrThrow(context, appointmentId);
  await assertAppointmentMutationScope(context, appointment);

  const { data, error } = await context.adminClient
    .from("appointments")
    .select(`
      *,
      branches!inner (id, name),
      services!inner (id, name, duration_minutes, price),
      profiles!appointments_employee_id_fkey (id, full_name)
    `)
    .eq("id", appointment.id)
    .eq("organization_id", context.organizationId)
    .single();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "No se pudo cargar la cita.",
    });
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: "Cita no encontrada.",
    });
  }

  return {
    id: data.id,
    branchId: data.branch_id,
    branchName: (data.branches as any)?.name ?? "",
    employeeId: data.employee_id,
    employeeName: (data.profiles as any)?.full_name ?? "",
    serviceId: data.service_id,
    serviceName: (data.services as any)?.name ?? "",
    serviceDurationMinutes: (data.services as any)?.duration_minutes ?? 0,
    servicePrice: (data.services as any)?.price ?? 0,
    customerId: data.customer_id,
    customerName: data.customer_name ?? "",
    customerPhone: data.customer_phone,
    isWalkIn: !data.customer_id,
    startTime: data.start_time,
    endTime: data.end_time,
    status: data.status,
    notes: data.notes,
    transactionId: data.transaction_id,
  };
}
