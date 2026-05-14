import { getRouterParam } from "h3";
import { getAppointmentDetail } from "../../services/appointments/detail";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "ID de cita requerido.",
    });
  }

  const appointment = await getAppointmentDetail(event, id);

  return { appointment };
});
